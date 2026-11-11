/**
 * Where an initiative keeps its planning context: on its own issue (epic #1011, decision record
 * #1016, D1–D4).
 *
 * The context is kept in one place only. When the whole initiative body, with the context collapsed
 * below the context summary, fits the issue body limit with headroom for the run's later edit, the
 * context stays in the body. Otherwise the body keeps the summary and a sentence giving the part
 * count, and the whole context is posted as numbered comments. Either way the body carries a hidden
 * record of the canonical digest of the context (or of each part), written at filing, so a reader
 * can tell a part that changed after filing.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { CONTEXT_BEGIN as BEGIN, CONTEXT_END as END, CONTEXT_MARKER_TRACE, type ContextBlockBounds, contextBlockBounds, editOutsideContext } from "@nexus/delivery-config/context-block";
import { trustedComment } from "@nexus/epic-verdicts/close-record";
import { recordDigest } from "@nexus/record-digest/digest";
import { type RepoSlug } from "@nexus/epic-resolve/gh";
import { type Runner } from "@nexus/epic-resolve/run";

/** An issue body and an issue comment each hold at most this many characters. */
export const BODY_LIMIT: number = 65536;
export const COMMENT_LIMIT: number = 65536;

/** Room left in the body for the run's own edit that writes the stub numbers in. */
const BODY_HEADROOM: number = 8192;
/** Room a part leaves for its marker line; sizes are measured in bytes, which never undercounts. */
const PART_BUDGET: number = COMMENT_LIMIT - 1024;

const RECORD_PATTERN: RegExp = /^<!-- nexus:context-record (\{.*\}) -->$/m;
const MARKER_PATTERN: RegExp = /^<!-- nexus:context-part (\d+)\/(\d+) -->$/;

const bytes = (s: string): number => Buffer.byteLength(s, "utf8");

export interface Rendered {
    /** The initiative body, ending with the context (inline) or the part-count sentence. */
    body: string;
    /** The comment bodies to post, in order; empty when the context stayed in the body. */
    parts: string[];
}

export function partMarker(number: number, total: number): string {
    return `<!-- nexus:context-part ${number}/${total} -->`;
}

/** The part number and total a comment opens with. Only the first line counts. */
export function parsePartMarker(comment: string): { number: number; total: number } | null {
    const first: string = comment.replace(/\r\n?/g, "\n").split("\n", 1)[0].trimEnd();
    const m: RegExpExecArray | null = MARKER_PATTERN.exec(first);
    return m === null ? null : { number: Number(m[1]), total: Number(m[2]) };
}

/** Split text into slices of at most `budget` bytes, on line boundaries, preferring headings. */
function splitText(text: string, budget: number): string[] {
    const lines: string[] = text.split(/(?<=\n)/);
    const slices: string[] = [];
    let current: string[] = [];
    let size: number = 0;
    const flush = (upTo: number): void => {
        slices.push(current.slice(0, upTo).join(""));
        current = current.slice(upTo);
        size = current.reduce((n, l) => n + bytes(l), 0);
    };
    for (const line of lines) {
        if (bytes(line) > budget) {
            if (current.length > 0) flush(current.length);
            let piece: string = "";
            let pieceSize: number = 0;
            for (const ch of line) {
                const w: number = bytes(ch);
                if (pieceSize + w > budget) {
                    slices.push(piece);
                    piece = "";
                    pieceSize = 0;
                }
                piece += ch;
                pieceSize += w;
            }
            if (piece !== "") {
                current.push(piece);
                size = pieceSize;
            }
            continue;
        }
        if (size + bytes(line) > budget) {
            let cut: number = current.length;
            for (let i = current.length - 1; i > 0; i--) {
                if (current[i].startsWith("## ")) {
                    cut = i;
                    break;
                }
            }
            flush(cut);
            // The kept tail plus this line can still overflow; flush it too.
            if (current.length > 0 && size + bytes(line) > budget) flush(current.length);
        }
        current.push(line);
        size += bytes(line);
    }
    if (current.length > 0) flush(current.length);
    return slices;
}

/**
 * Render the initiative body for `summary` (the body text the lead saw at the gate, ending with the
 * context summary) and the full `context` text, and split the context into parts when it will not fit.
 * `headroom` is the room the body keeps free for what the filer adds when it files the body.
 */
export function renderInitiativeBody(summary: string, context: string, headroom: number = BODY_HEADROOM): Rendered {
    const head: string = summary.trimEnd();
    const record: string = JSON.stringify({ kind: "inline", digest: recordDigest(context) });
    const inline: string =
        `${head}\n\n<!-- nexus:context-record ${record} -->\n<details>\n<summary>Full planning context</summary>\n\n${BEGIN}\n${context}\n${END}\n\n</details>\n`;
    if (bytes(inline) + headroom <= BODY_LIMIT) return { body: inline, parts: [] };

    const slices: string[] = splitText(context, PART_BUDGET - 64);
    const parts: string[] = slices.map((s, i) => `${partMarker(i + 1, slices.length)}\n${s}`);
    // A part cut inside a line has no trailing newline to lose; the reader must not add one.
    const cuts: number[] = slices.flatMap((slice, i) => (i < slices.length - 1 && !slice.endsWith("\n") ? [i + 1] : []));
    const partsRecord: string = JSON.stringify({
        kind: "parts",
        count: parts.length,
        digests: parts.map((p) => recordDigest(p)),
        ...(cuts.length > 0 ? { cuts } : {}),
    });
    const body: string =
        `${head}\n\n<!-- nexus:context-record ${partsRecord} -->\n` +
        `The full planning context of this initiative is kept in ${parts.length} numbered comments on this issue.\n`;
    return { body, parts };
}

export type BodyContext =
    | { kind: "none" }
    | { kind: "inline"; text: string; matches: boolean }
    | { kind: "parts"; count: number; digests: string[]; cuts: number[] }
    /**
     * The body shows a context was filed, but what is left of it cannot be read: `missing` when the
     * record names an inline context whose block is gone, `changed` when a marker or the record is garbled.
     */
    | { kind: "damaged"; damage: "missing" | "changed" };

/** Any trace of a context record line, garbled or not. */
const RECORD_TRACE: RegExp = /<!--\s*nexus:context-record\b/;

/** Read the context kept in a body: the collapsed block, the part record, neither, or a damaged one. */
export function parseContextFromBody(body: string): BodyContext {
    // The reader works on LF text, so the text it returns and digests has one line-break style.
    const text: string = body.replace(/\r\n?/g, "\n");
    const block: ContextBlockBounds | null = contextBlockBounds(text);
    const outside: string = block === null ? text : text.slice(0, block.start) + text.slice(block.stop);
    const recorded: RegExpExecArray | null = RECORD_PATTERN.exec(outside);
    let record: { kind?: string; digest?: string; count?: number; digests?: string[]; cuts?: number[] } | null = null;
    if (recorded !== null) {
        try {
            record = JSON.parse(recorded[1]);
        } catch {
            record = null;
        }
    }
    if (block !== null) {
        const inner: string = text.slice(block.innerStart, block.innerEnd);
        return { kind: "inline", text: inner, matches: record?.kind === "inline" && record.digest === recordDigest(inner) };
    }
    if (record?.kind === "parts" && Number.isInteger(record.count) && (record.count as number) > 0 && Array.isArray(record.digests)) {
        return { kind: "parts", count: record.count as number, digests: record.digests, cuts: Array.isArray(record.cuts) ? record.cuts : [] };
    }
    // Outside the (absent) block, a surviving marker or record line means a context was filed here.
    if (record?.kind === "inline" && !CONTEXT_MARKER_TRACE.test(outside)) return { kind: "damaged", damage: "missing" };
    if (record !== null || RECORD_TRACE.test(outside) || CONTEXT_MARKER_TRACE.test(outside)) return { kind: "damaged", damage: "changed" };
    return { kind: "none" };
}

/** The body with its collapsed context block and its hidden record removed. */
export function withoutContext(body: string): string {
    // The reader works on LF text, so the text it returns and digests has one line-break style.
    const text: string = body.replace(/\r\n?/g, "\n");
    const block: ContextBlockBounds | null = contextBlockBounds(text);
    let out: string = text;
    if (block !== null) {
        const open: number = text.lastIndexOf("<details>", block.start);
        const close: number = text.indexOf("</details>", block.stop);
        out = text.slice(0, open === -1 ? block.start : open) + (close === -1 ? "" : text.slice(close + "</details>".length));
    }
    return out.replace(RECORD_PATTERN, "").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/**
 * Write each stub's issue number into the body in place of its `STUB-<NN>` reference, everywhere
 * except inside the collapsed context, whose text is digest-checked and must stay as filed. A stub
 * with no number yet keeps its reference. A `STUB-` inside a story ref in any case (`STORY-STUB-01`,
 * `story-STUB-01`), a word in any script (`MY_STUB-01`, `éSTUB-01`, `issue#STUB-01`, `STUB-01_notes`) or a
 * path (`issues/STUB-01`, `STUB-01/x`) or a sub-key (`STUB-01.02`, `STUB-01-02`) is left alone; one in a
 * range (`STUB-01-STUB-02`) is named, and a `#STUB-01` keeps one `#`.
 */
export function replaceStubRefs(body: string, numbers: Record<string, number>): string {
    const swap: (text: string) => string = (text: string): string =>
        text.replace(/(?<![\p{L}\p{N}_#/]|(?<![A-Za-z])[Ss][Tt][Oo][Rr][Yy]-)#?STUB-(\d+)(?![\p{L}\p{N}_/]|[.-]\d)/gu, (whole: string, nn: string): string => {
            const n: number | undefined = numbers[`stub-${nn}`];
            return n === undefined ? whole : `#${n}`;
        });
    return editOutsideContext(body, swap);
}

export interface IssueComment {
    id: number;
    body: string;
    author: string;
    association: string;
}

/** Every comment on an issue. A failed read is an error, never an empty list. */
export function fetchComments(run: Runner, cwd: string, slug: RepoSlug, issue: number): { ok: true; comments: IssueComment[] } | { ok: false; message: string } {
    const r = run("gh", ["api", `repos/${slug.owner}/${slug.repo}/issues/${issue}/comments`, "--paginate", "--slurp"], { cwd });
    if (r.status !== 0) return { ok: false, message: `reading the comments of #${issue} failed: ${r.stderr.trim() || "unknown gh error"}` };
    try {
        const raw: unknown = JSON.parse(r.stdout);
        const flat: Record<string, unknown>[] = (Array.isArray(raw) ? raw : []).flat() as Record<string, unknown>[];
        return {
            ok: true,
            comments: flat.map((c) => ({
                id: Number(c.id),
                body: String(c.body ?? ""),
                author: String((c.user as { login?: string } | undefined)?.login ?? ""),
                association: String(c.author_association ?? ""),
            })),
        };
    } catch {
        return { ok: false, message: `the comments of #${issue} were not readable JSON` };
    }
}

/** Whether a comment's author can speak for the repository, by the one rule close applies (record #1016, D5). */
export const isTrustedAssociation = (association: string): boolean => trustedComment({ authorAssociation: association });

const landed = (comments: IssueComment[], part: string): boolean =>
    comments.some((c) => isTrustedAssociation(c.association) && recordDigest(c.body) === recordDigest(part));

/**
 * Post each part once, in order. The issue's comments are read once at the start and again after
 * each post, to read the part back; a part already carried by a trusted comment with the same
 * digest is skipped.
 */
export function postParts(run: Runner, cwd: string, slug: RepoSlug, issue: number, parts: string[]): { ok: true; posted: number } | { ok: false; message: string } {
    let posted: number = 0;
    const first: ReturnType<typeof fetchComments> = fetchComments(run, cwd, slug, issue);
    if (!first.ok) return first;
    // The comments as last read: a part's read-back is the next part's starting point.
    let known: IssueComment[] = first.comments;
    for (let i = 0; i < parts.length; i++) {
        if (landed(known, parts[i])) continue;
        // The part goes to gh on standard input, so nothing is staged on disk and an interrupted run
        // leaves no context file in the checkout.
        const r: ReturnType<Runner> = run("gh", ["issue", "comment", String(issue), "--repo", `${slug.owner}/${slug.repo}`, "--body-file", "-"], { cwd, input: parts[i] });
        if (r.status !== 0) return { ok: false, message: `posting part ${i + 1} of ${parts.length} on #${issue} failed: ${r.stderr.trim() || "unknown gh error"}` };
        const after: ReturnType<typeof fetchComments> = fetchComments(run, cwd, slug, issue);
        if (!after.ok) return after;
        if (!landed(after.comments, parts[i])) return { ok: false, message: `part ${i + 1} of ${parts.length} on #${issue} did not read back as posted` };
        known = after.comments;
        posted++;
    }
    return { ok: true, posted };
}

interface RenderIo {
    cwd: string;
    stdout: (line: string) => void;
    stderr: (line: string) => void;
}

/** `render --body <summary.md> --context <context.md> --dir <out>`: write body.md and part-N.md. */
export function runRender(argv: string[], io: RenderIo): number {
    const arg = (name: string): string | undefined => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
    const bodyFile: string | undefined = arg("--body");
    const contextFile: string | undefined = arg("--context");
    const dir: string | undefined = arg("--dir");
    const headroomRaw: string | undefined = arg("--headroom");
    if (bodyFile === undefined || contextFile === undefined || dir === undefined || (headroomRaw !== undefined && !/^\d+$/.test(headroomRaw))) {
        io.stderr("usage: nexus initiative-context render --body <file> --context <file> --dir <folder> [--headroom <characters>]");
        return 2;
    }
    const rendered: Rendered = renderInitiativeBody(
        fs.readFileSync(path.resolve(io.cwd, bodyFile), "utf8"),
        fs.readFileSync(path.resolve(io.cwd, contextFile), "utf8"),
        headroomRaw === undefined ? BODY_HEADROOM : Number(headroomRaw),
    );
    const out: string = path.resolve(io.cwd, dir);
    fs.mkdirSync(out, { recursive: true });
    for (const f of fs.readdirSync(out)) {
        if (/^part-\d+\.md$/.test(f)) fs.rmSync(path.join(out, f));
    }
    fs.writeFileSync(path.join(out, "body.md"), rendered.body);
    rendered.parts.forEach((p, i) => fs.writeFileSync(path.join(out, `part-${i + 1}.md`), p));
    io.stdout(JSON.stringify({ body: path.join(out, "body.md"), parts: rendered.parts.length, where: rendered.parts.length === 0 ? "body" : "comments" }));
    return 0;
}

/** `stub-numbers --body <body.md> --ledger <.nxs-created.json>`: name the filed stubs in the body, in place. */
export function runStubNumbers(argv: string[], io: RenderIo): number {
    const arg = (name: string): string | undefined => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
    const bodyFile: string | undefined = arg("--body");
    const ledgerFile: string | undefined = arg("--ledger");
    if (bodyFile === undefined || ledgerFile === undefined) {
        io.stderr("usage: nexus initiative-context stub-numbers --body <file> --ledger <file>");
        return 2;
    }
    // The story filer's ledger stores each number as a string; a number is accepted too.
    let ledger: Record<string, { number?: unknown } | null>;
    try {
        ledger = JSON.parse(fs.readFileSync(path.resolve(io.cwd, ledgerFile), "utf8"));
    } catch {
        io.stderr(`initiative-context ledger-unreadable: ${ledgerFile} is not readable JSON. Nothing was changed.`);
        return 1;
    }
    const numbers: Record<string, number> = {};
    for (const [ref, entry] of Object.entries(ledger)) {
        const raw: unknown = entry?.number;
        const text: string = typeof raw === "number" || typeof raw === "string" ? String(raw).trim() : "";
        if (/^[1-9]\d*$/.test(text)) numbers[ref.toLowerCase()] = Number(text);
    }
    const file: string = path.resolve(io.cwd, bodyFile);
    fs.writeFileSync(file, replaceStubRefs(fs.readFileSync(file, "utf8"), numbers));
    io.stdout(JSON.stringify({ body: file, named: Object.keys(numbers).length }));
    return 0;
}
