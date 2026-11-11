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

const BEGIN: string = "<!-- nexus:context-begin -->";
const END: string = "<!-- nexus:context-end -->";
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
 */
export function renderInitiativeBody(summary: string, context: string): Rendered {
    const head: string = summary.trimEnd();
    const record: string = JSON.stringify({ kind: "inline", digest: recordDigest(context) });
    const inline: string =
        `${head}\n\n<!-- nexus:context-record ${record} -->\n<details>\n<summary>Full planning context</summary>\n\n${BEGIN}\n${context}\n${END}\n\n</details>\n`;
    if (bytes(inline) + BODY_HEADROOM <= BODY_LIMIT) return { body: inline, parts: [] };

    const slices: string[] = splitText(context, PART_BUDGET - 64);
    const parts: string[] = slices.map((s, i) => `${partMarker(i + 1, slices.length)}\n${s}`);
    const partsRecord: string = JSON.stringify({ kind: "parts", count: parts.length, digests: parts.map((p) => recordDigest(p)) });
    const body: string =
        `${head}\n\n<!-- nexus:context-record ${partsRecord} -->\n` +
        `The full planning context of this initiative is kept in ${parts.length} numbered comments on this issue.\n`;
    return { body, parts };
}

export type BodyContext =
    | { kind: "none" }
    | { kind: "inline"; text: string; matches: boolean }
    | { kind: "parts"; count: number; digests: string[] };

/** Read the context kept in a body: the collapsed block, the part record, or neither. */
export function parseContextFromBody(body: string): BodyContext {
    const text: string = body.replace(/\r\n?/g, "\n");
    const begin: number = text.indexOf(`${BEGIN}\n`);
    const end: number = text.lastIndexOf(`\n${END}`);
    const outside: string = begin !== -1 && end > begin ? text.slice(0, begin) + text.slice(end + END.length + 1) : text;
    const recorded: RegExpExecArray | null = RECORD_PATTERN.exec(outside);
    let record: { kind?: string; digest?: string; count?: number; digests?: string[] } | null = null;
    if (recorded !== null) {
        try {
            record = JSON.parse(recorded[1]);
        } catch {
            record = null;
        }
    }
    if (begin !== -1 && end > begin) {
        const inner: string = text.slice(begin + BEGIN.length + 1, end);
        return { kind: "inline", text: inner, matches: record?.kind === "inline" && record.digest === recordDigest(inner) };
    }
    if (record?.kind === "parts" && typeof record.count === "number" && Array.isArray(record.digests)) {
        return { kind: "parts", count: record.count, digests: record.digests };
    }
    return { kind: "none" };
}

/** The body with its collapsed context block and its hidden record removed. */
export function withoutContext(body: string): string {
    const text: string = body.replace(/\r\n?/g, "\n");
    const begin: number = text.indexOf(`${BEGIN}\n`);
    const end: number = text.lastIndexOf(`\n${END}`);
    let out: string = text;
    if (begin !== -1 && end > begin) {
        const open: number = text.lastIndexOf("<details>", begin);
        const close: number = text.indexOf("</details>", end);
        out = text.slice(0, open === -1 ? begin : open) + (close === -1 ? "" : text.slice(close + "</details>".length));
    }
    return out.replace(RECORD_PATTERN, "").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
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

const TRUSTED: readonly string[] = ["OWNER", "MEMBER", "COLLABORATOR"];
export const isTrustedAssociation = (association: string): boolean => TRUSTED.includes(association.toUpperCase());

const landed = (comments: IssueComment[], part: string): boolean =>
    comments.some((c) => isTrustedAssociation(c.association) && recordDigest(c.body) === recordDigest(part));

/**
 * Post each part once, in order. Before a part, the issue's comments are read and a part already
 * carried by a trusted comment with the same digest is skipped; after it, the part is read back.
 */
export function postParts(run: Runner, cwd: string, slug: RepoSlug, issue: number, parts: string[]): { ok: true; posted: number } | { ok: false; message: string } {
    let posted: number = 0;
    for (let i = 0; i < parts.length; i++) {
        const before = fetchComments(run, cwd, slug, issue);
        if (!before.ok) return before;
        if (landed(before.comments, parts[i])) continue;
        const file: string = path.join(fs.mkdtempSync(path.join(cwd, ".ctx-part-")), "part.md");
        fs.writeFileSync(file, parts[i]);
        const r = run("gh", ["issue", "comment", String(issue), "--repo", `${slug.owner}/${slug.repo}`, "--body-file", file], { cwd });
        fs.rmSync(path.dirname(file), { recursive: true, force: true });
        if (r.status !== 0) return { ok: false, message: `posting part ${i + 1} of ${parts.length} on #${issue} failed: ${r.stderr.trim() || "unknown gh error"}` };
        const after = fetchComments(run, cwd, slug, issue);
        if (!after.ok) return after;
        if (!landed(after.comments, parts[i])) return { ok: false, message: `part ${i + 1} of ${parts.length} on #${issue} did not read back as posted` };
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
    if (bodyFile === undefined || contextFile === undefined || dir === undefined) {
        io.stderr("usage: nexus initiative-context render --body <file> --context <file> --dir <folder>");
        return 2;
    }
    const rendered: Rendered = renderInitiativeBody(fs.readFileSync(path.resolve(io.cwd, bodyFile), "utf8"), fs.readFileSync(path.resolve(io.cwd, contextFile), "utf8"));
    const out: string = path.resolve(io.cwd, dir);
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, "body.md"), rendered.body);
    rendered.parts.forEach((p, i) => fs.writeFileSync(path.join(out, `part-${i + 1}.md`), p));
    io.stdout(JSON.stringify({ body: path.join(out, "body.md"), parts: rendered.parts.length, where: rendered.parts.length === 0 ? "body" : "comments" }));
    return 0;
}
