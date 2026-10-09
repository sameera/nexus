/**
 * `nexus concept-invariants` — the invariant lister analyze runs (epic #896, story #900, D10).
 *
 * The conformance gate checks the code against the invariants on the concept pages the epic lists.
 * This step decides, deterministically, which invariants those are and which of them a declared
 * change in the record covers, so that "was this approved" is a fact and not a judgment. The model
 * judges only the uncovered ones.
 *
 * Pages are read from git at the base the change is diffed from, never from the working tree, so a
 * pull request that edits a concept page cannot change what it is checked against. In a hub
 * workspace the caller passes the hub checkout as `--root`. The command writes nothing.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { recordSections } from "@nexus/scope-razor/record";
import type { CliIo } from "./nexus-cli.js";
import { readListedPages } from "./reading-list.js";

export interface PageInvariant {
    number: number;
    text: string;
}

export interface ListedInvariant extends PageInvariant {
    page: string;
    covered: boolean;
}

export interface InvariantReport {
    invariants: ListedInvariant[];
    /** Listed pages that could not be found at the base. */
    missing: string[];
    /** The line the report carries for a human reader. */
    sentence: string;
}

export interface DeclaredQuote {
    page: string | undefined;
    old: string;
}

function squash(text: string): string {
    return text.replace(/\s+/g, " ").trim();
}

/** The numbered invariants of a page that are not struck through, with wrapped lines joined. */
export function extractInvariants(page: string): PageInvariant[] {
    const lines: string[] = page.split("\n");
    const start: number = lines.findIndex((l: string) => /^##\s+Key Invariants\s*$/.test(l));
    if (start === -1) return [];
    const raw: Array<{ number: number; text: string }> = [];
    for (let i = start + 1; i < lines.length; i++) {
        if (/^##\s/.test(lines[i])) break;
        const item: RegExpMatchArray | null = lines[i].match(/^(\d+)\.\s+(.*)$/);
        if (item !== null) raw.push({ number: Number(item[1]), text: item[2] });
        else if (raw.length > 0 && /^\s+\S/.test(lines[i])) raw[raw.length - 1].text += ` ${lines[i].trim()}`;
    }
    return raw
        .map((r) => ({ number: r.number, text: squash(r.text.replace(/~~.*?~~/g, "")) }))
        .filter((r) => r.text !== "");
}

export function listConceptInvariants(
    listed: string[],
    readPage: (name: string) => string | undefined,
    quotes: DeclaredQuote[],
): InvariantReport {
    const invariants: ListedInvariant[] = [];
    const missing: string[] = [];
    for (const name of listed) {
        const text: string | undefined = readPage(name);
        if (text === undefined) {
            missing.push(name);
            continue;
        }
        for (const inv of extractInvariants(text)) {
            // Covered: a declared change names this page and its quote sits inside the invariant's text.
            const covered: boolean = quotes.some((q: DeclaredQuote) => q.page === name && squash(inv.text).includes(squash(q.old)));
            invariants.push({ page: name, number: inv.number, text: inv.text, covered });
        }
    }
    const coveredCount: number = invariants.filter((i: ListedInvariant) => i.covered).length;
    const notFound: string = missing.length === 0 ? "" : ` Listed but not found at the base: ${missing.join(", ")}.`;
    const sentence: string =
        listed.length === 0
            ? "Concept invariants: none were checked because the epic lists no concept pages."
            : `Concept invariants: ${invariants.length} concept invariants checked from ${listed.filter((n: string) => !missing.includes(n)).join(", ") || "no page"}, ${coveredCount} covered by a stated change.${notFound}`;
    return { invariants, missing, sentence };
}

function git(root: string, args: string[]): string {
    return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

export function runConceptInvariants(argv: string[], io: CliIo): number {
    const flags: Record<string, string> = {};
    for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) flags[argv[i].slice(2)] = argv[++i] ?? "";
    if (flags.epic === undefined || flags.base === undefined) {
        io.stderr("usage: nexus concept-invariants --epic <epic.md> --base <ref> [--record <record-body.md>] [--root <checkout>] [--store <repo-relative dir>]");
        return 2;
    }
    let epic: string;
    try {
        epic = fs.readFileSync(path.resolve(io.cwd, flags.epic), "utf8");
    } catch {
        io.stderr(`concept-invariants: cannot read ${flags.epic}`);
        return 1;
    }
    const listed: string[] = readListedPages(epic);
    const root: string = path.resolve(io.cwd, flags.root ?? ".");
    const store: string = (flags.store ?? ".nexus/concepts").replace(/\/+$/, "");

    if (listed.length > 0) {
        // An unreadable store stops the run, as a record fetch failure does: zero invariants checked
        // must never read as a pass.
        try {
            git(root, ["rev-parse", "--verify", `${flags.base}^{commit}`]);
        } catch {
            io.stderr(`concept-invariants: the concept store cannot be read at base ${flags.base} in ${root}; publish nothing`);
            return 1;
        }
    }
    const readPage = (name: string): string | undefined => {
        try {
            return git(root, ["show", `${flags.base}:${store}/${name}.md`]);
        } catch {
            return undefined;
        }
    };

    let quotes: DeclaredQuote[] = [];
    if (flags.record !== undefined) {
        try {
            const body: string = fs.readFileSync(path.resolve(io.cwd, flags.record), "utf8");
            quotes = recordSections(body)
                .conceptChanges.filter((c) => c.old !== undefined)
                .map((c) => ({ page: c.page, old: c.old as string }));
        } catch {
            io.stderr(`concept-invariants: cannot read ${flags.record}`);
            return 1;
        }
    }
    io.stdout(JSON.stringify(listConceptInvariants(listed, readPage, quotes), null, 4));
    return 0;
}
