/**
 * The reading-list builder (epic #896, story #897).
 *
 * The epic stage proposes the concept pages a later stage should read. The list is built from page
 * frontmatter alone — title, aliases and the `touches` neighbour line — by an exact whole-phrase
 * match, so the same input over the same store always gives the same list and no model chooses
 * pages. The reviewer corrects the list at the approval digest.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { CliIo } from "./nexus-cli.js";
import { parseFrontmatter } from "./validate-concepts.js";

/** The most pages one reading list holds, for the builder and for the reviewer's selection alike. */
export const READING_LIST_CAP = 7;

export interface StorePage {
    /** The page's file name without `.md`: the store's only unique key. */
    name: string;
    title: string;
    aliases: string[];
    touches: string[];
    status: string;
}

export interface ReadingEntry {
    page: string;
    reason: string;
}

export interface ReadingList {
    /** The proposed pages, at most {@link READING_LIST_CAP}, in list order. */
    listed: ReadingEntry[];
    /** Pages that qualified but fell beyond the cap, offered unticked. */
    overflow: ReadingEntry[];
}

export type Selection = { ok: true; pages: string[] } | { ok: false; error: string };

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Where `phrase` first appears in `text` as a whole phrase, ignoring case, or -1. */
function phraseIndex(text: string, phrase: string): number {
    if (phrase.trim() === "") return -1;
    const match: RegExpExecArray | null = new RegExp(`(?<![\\w-])${escapeRegExp(phrase.trim())}(?![\\w-])`, "i").exec(text);
    return match === null ? -1 : match.index;
}

export function buildReadingList(pages: StorePage[], matchText: string): ReadingList {
    const active: StorePage[] = pages.filter((p: StorePage) => p.status === "active");
    const byName: Map<string, StorePage> = new Map(active.map((p: StorePage) => [p.name, p]));

    interface Direct {
        page: StorePage;
        at: number;
        phrase: string;
    }
    const direct: Direct[] = [];
    for (const page of active) {
        let best: Direct | undefined;
        for (const phrase of [page.title, ...page.aliases]) {
            const at: number = phraseIndex(matchText, phrase);
            if (at !== -1 && (best === undefined || at < best.at)) best = { page, at, phrase };
        }
        if (best !== undefined) direct.push(best);
    }
    direct.sort((a: Direct, b: Direct) => a.at - b.at || a.page.name.localeCompare(b.page.name));

    const directNames: Set<string> = new Set(direct.map((d: Direct) => d.page.name));
    const neighbours: Map<string, { count: number; first: number; via: string }> = new Map();
    let sequence = 0;
    for (const d of direct) {
        for (const name of d.page.touches) {
            if (directNames.has(name) || !byName.has(name)) continue;
            const seen = neighbours.get(name);
            if (seen === undefined) neighbours.set(name, { count: 1, first: sequence++, via: d.page.title });
            else seen.count++;
        }
    }
    const ranked: ReadingEntry[] = [...neighbours.entries()]
        .sort(([, a], [, b]) => b.count - a.count || a.first - b.first)
        .map(([name, n]) => ({ page: name, reason: `neighbour of ${n.via}${n.count > 1 ? ` and ${n.count - 1} more matched page(s)` : ""}` }));

    const all: ReadingEntry[] = [
        ...direct.map((d: Direct) => ({ page: d.page.name, reason: `matched "${d.phrase}"` })),
        ...ranked,
    ];
    return { listed: all.slice(0, READING_LIST_CAP), overflow: all.slice(READING_LIST_CAP) };
}

/** The reviewer's final set: only offered pages, at most the cap, kept in offered order. */
export function applySelection(list: ReadingList, keep: string[]): Selection {
    const offered: string[] = [...list.listed, ...list.overflow].map((e: ReadingEntry) => e.page);
    const unknown: string[] = keep.filter((name: string) => !offered.includes(name));
    if (unknown.length > 0) {
        return { ok: false, error: `not offered: ${unknown.join(", ")} — adding a page that was not offered takes a revise` };
    }
    const pages: string[] = offered.filter((name: string) => keep.includes(name));
    if (pages.length > READING_LIST_CAP) {
        return { ok: false, error: `${pages.length} pages ticked; a reading list holds at most ${READING_LIST_CAP}` };
    }
    return { ok: true, pages };
}

/** The checklist group: proposed pages ticked with their reason, overflow pages unticked. */
export function renderReadingGroup(list: ReadingList, startNumber: number): string[] {
    const entries: Array<{ entry: ReadingEntry; ticked: boolean }> = [
        ...list.listed.map((entry: ReadingEntry) => ({ entry, ticked: true })),
        ...list.overflow.map((entry: ReadingEntry) => ({ entry, ticked: false })),
    ];
    if (entries.length === 0) return [];
    const width: number = String(startNumber + entries.length - 1).length;
    return [
        "",
        "Reading list — concept pages the later stages read",
        ...entries.map(({ entry, ticked }, i: number) => `  [${ticked ? "x" : " "}] ${String(startNumber + i).padStart(width, " ")}. ${entry.page} · ${entry.reason}`),
    ];
}

export function loadStore(dir: string): StorePage[] {
    let files: string[];
    try {
        files = fs.readdirSync(dir).filter((f: string) => f.endsWith(".md") && f !== "README.md");
    } catch {
        return [];
    }
    const pages: StorePage[] = [];
    for (const file of files.sort()) {
        const lines: string[] = fs.readFileSync(path.join(dir, file), "utf8").split("\n");
        const fm = parseFrontmatter(lines);
        if (fm === null) continue;
        const list = (key: string): string[] => {
            const value = fm.fields.get(key);
            return Array.isArray(value) ? value : [];
        };
        const title = fm.fields.get("title");
        const status = fm.fields.get("status");
        pages.push({
            name: file.slice(0, -3),
            title: typeof title === "string" ? title : file.slice(0, -3),
            aliases: list("aliases"),
            touches: list("touches"),
            status: typeof status === "string" ? status : "active",
        });
    }
    return pages;
}

const CONCEPTS_LINE: RegExp = /^concepts:.*$/m;

function draftParts(text: string): { front: string; rest: string } | undefined {
    const match: RegExpMatchArray | null = text.match(/^---\n([\s\S]*?)\n---(\n[\s\S]*)?$/);
    return match === null ? undefined : { front: match[1], rest: match[2] ?? "" };
}

function carriedList(draft: string): string[] {
    const parts = draftParts(draft);
    if (parts === undefined) return [];
    const fm = parseFrontmatter(["---", ...parts.front.split("\n").map((l: string) => l.replace(/\s+#.*$/, "")), "---"]);
    const value = fm?.fields.get("concepts");
    return Array.isArray(value) ? value.filter((v: string) => v !== "") : [];
}

/** The page names an epic's `concepts:` field lists; an absent field reads as an empty list. */
export function readListedPages(epic: string): string[] {
    return carriedList(epic);
}

function withConcepts(draft: string, pages: string[]): string {
    const parts = draftParts(draft);
    if (parts === undefined) return draft;
    const line = `concepts: [${pages.map((p: string) => JSON.stringify(p)).join(", ")}]`;
    const front: string = CONCEPTS_LINE.test(parts.front) ? parts.front.replace(CONCEPTS_LINE, line) : `${parts.front}\n${line}`;
    return `---\n${front}\n---${parts.rest}`;
}

/** The title and the Description section: the drafted text a promoted stub or discovery is matched on. */
function draftedText(draft: string): string {
    const title: string = draft.match(/^epic:\s*"?(.*?)"?\s*$/m)?.[1] ?? "";
    const description: string = draft.match(/^## Description[^\n]*\n([\s\S]*?)(?=^## |\n?$(?![\s\S]))/m)?.[1] ?? "";
    return `${title}\n${description}`;
}

/** Where the offered list sits beside its draft, for `razor-offer --reading-list`. */
export function readingListPath(draft: string): string {
    return path.join(path.dirname(draft), "reading-list.json");
}

/** The sentence that opens a record's Concept-store changes section. */
function pagesReadSentence(read: string[], missing: string[]): string {
    const joined = (names: string[]): string => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0]);
    const base: string = read.length === 0 ? "This record read no concept pages." : `This record read the concept page${read.length > 1 ? "s" : ""} ${joined(read)}.`;
    return missing.length === 0 ? base : `${base} Listed but not found, or not active: ${joined(missing)}.`;
}

export function runReadingList(argv: string[], io: CliIo): number {
    const flags: Record<string, string> = {};
    for (let i = 0; i < argv.length; i++) {
        if (argv[i].startsWith("--")) flags[argv[i].slice(2)] = argv[++i] ?? "";
    }
    if (flags.check !== undefined) {
        // The record stage's read: which listed pages exist and are active, so the architect gets
        // each whole, and the sentence that says so. An absent list is an empty list, never an error.
        let epic: string;
        try {
            epic = fs.readFileSync(path.resolve(io.cwd, flags.check), "utf8");
        } catch {
            io.stderr(`reading-list: cannot read ${flags.check}`);
            return 1;
        }
        const store: string = path.resolve(io.cwd, flags.store ?? path.join(".nexus", "concepts"));
        const active: Set<string> = new Set(loadStore(store).filter((p: StorePage) => p.status === "active").map((p: StorePage) => p.name));
        const listed: string[] = carriedList(epic);
        const read: string[] = listed.filter((name: string) => active.has(name));
        const missing: string[] = listed.filter((name: string) => !active.has(name));
        io.stdout(
            JSON.stringify(
                { read: read.map((page: string) => ({ page, path: path.join(store, `${page}.md`) })), missing, sentence: pagesReadSentence(read, missing) },
                null,
                4,
            ),
        );
        return 0;
    }
    if (flags.draft === undefined) {
        io.stderr("usage: nexus reading-list --draft <path> [--input <file>] [--store <dir>] | --draft <path> --apply <page,page,…>");
        return 2;
    }
    const draftPath: string = path.resolve(io.cwd, flags.draft);
    let draft: string;
    try {
        draft = fs.readFileSync(draftPath, "utf8");
    } catch {
        io.stderr(`reading-list: cannot read ${flags.draft}`);
        return 1;
    }
    const offerPath: string = readingListPath(draftPath);

    if (flags.apply !== undefined) {
        let offered: ReadingList;
        try {
            offered = JSON.parse(fs.readFileSync(offerPath, "utf8")) as ReadingList;
        } catch {
            io.stderr("reading-list: no offered list beside the draft; build it first");
            return 1;
        }
        const keep: string[] = flags.apply.split(",").map((s: string) => s.trim()).filter((s: string) => s !== "");
        const result: Selection = applySelection(offered, keep);
        if (!result.ok) {
            io.stderr(`reading-list: ${result.error}`);
            return 1;
        }
        fs.writeFileSync(draftPath, withConcepts(draft, result.pages));
        io.stdout(`reading-list: ${result.pages.length} page(s) approved: ${result.pages.join(", ") || "none"}`);
        return 0;
    }

    const store: string = path.resolve(io.cwd, flags.store ?? path.join(".nexus", "concepts"));
    const input: string = flags.input === undefined ? "" : fs.readFileSync(path.resolve(io.cwd, flags.input), "utf8");
    const built: ReadingList = buildReadingList(loadStore(store), `${input}\n${draftedText(draft)}`);
    const carried: string[] = carriedList(draft);
    let list: ReadingList = built;
    if (carried.length > 0) {
        // A resumed draft keeps the list it carries, hand edits included; the rest of the proposals stay offered.
        const reasonOf = (name: string): string => [...built.listed, ...built.overflow].find((e: ReadingEntry) => e.page === name)?.reason ?? "carried on the draft";
        list = {
            listed: carried.map((page: string) => ({ page, reason: reasonOf(page) })),
            overflow: [...built.listed, ...built.overflow].filter((e: ReadingEntry) => !carried.includes(e.page)),
        };
    } else {
        fs.writeFileSync(draftPath, withConcepts(draft, built.listed.map((e: ReadingEntry) => e.page)));
    }
    fs.writeFileSync(offerPath, JSON.stringify(list, null, 4));
    io.stdout(
        list.listed.length + list.overflow.length === 0
            ? "reading-list: no pages matched; the list is empty"
            : renderReadingGroup(list, 1).join("\n").trimStart(),
    );
    return 0;
}
