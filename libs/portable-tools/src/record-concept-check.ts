/**
 * `nexus record-concept-check` — the record checkpoint's concept-store rules (epic #896, story #899).
 *
 * A declared change names a page, quotes one of its current statements exactly, gives the statement
 * that replaces it and cites the decision that causes it. The conformance gate later decides whether
 * an invariant is covered by matching that quote against the invariant's text, so a paraphrased quote
 * would flag an approved change. This check catches the paraphrase while the draft can still be fixed:
 * each quote must appear on the named page, with whitespace normalised because pages hard-wrap their
 * lines. A decision a change cites must state a trade-off, so the reversed reasoning always reaches
 * the approval brief, whose rule already lists every decision with a trade-off.
 *
 * The command writes nothing. A record with no Concept-store changes section is left alone: records
 * approved before the section was always present are read as before.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { recordSections, type SectionConceptChange, type SectionDecision } from "@nexus/scope-razor/record";
import type { CliIo } from "./nexus-cli.js";
import { loadStore, type StorePage } from "./reading-list.js";

export interface ConceptProblem {
    /** 1-indexed line of the draft, or 0 for a section-level problem. */
    line: number;
    message: string;
}

const NO_CHANGE = "No concept-store change.";

function squash(text: string): string {
    return text.replace(/\s+/g, " ").trim();
}

/** The plain (non-list) lines of the Concept-store changes section, or undefined when it is absent. */
function sectionPlainLines(body: string): Array<{ line: number; text: string }> | undefined {
    const lines: string[] = body.split("\n");
    const start: number = lines.findIndex((l: string) => /^##\s+Concept-store changes\s*$/i.test(l));
    if (start === -1) return undefined;
    const plain: Array<{ line: number; text: string }> = [];
    for (let i = start + 1; i < lines.length; i++) {
        if (/^##\s/.test(lines[i])) break;
        const text: string = lines[i].trim();
        if (text !== "" && !/^[-*]\s/.test(text) && !/^<!--/.test(text)) plain.push({ line: i + 1, text });
    }
    return plain;
}

export function checkConceptSection(body: string, pages: StorePage[], readPage: (name: string) => string | undefined): ConceptProblem[] {
    const plain = sectionPlainLines(body);
    if (plain === undefined) return [];
    const problems: ConceptProblem[] = [];
    const { conceptChanges, decisions } = recordSections(body);

    if (!plain.some((p) => /^This record read\b/.test(p.text))) {
        problems.push({ line: 0, message: "Concept-store changes does not open with the pages-read sentence (`nexus reading-list --check` prints it)" });
    }
    const noChange: boolean = plain.some((p) => p.text === NO_CHANGE);
    if (conceptChanges.length === 0 && !noChange) {
        problems.push({ line: 0, message: `the design states no concept-store change but the section does not say "${NO_CHANGE}"` });
    }
    if (conceptChanges.length > 0 && noChange) {
        problems.push({ line: plain.find((p) => p.text === NO_CHANGE)?.line ?? 0, message: `"${NO_CHANGE}" contradicts the changes the section lists` });
    }

    for (const change of conceptChanges) {
        if (change.old === undefined || change.new === undefined) {
            problems.push({ line: change.line, message: `change cannot be read as <page> page: "<old>" becomes "<new>" (D<n>), so its quote cannot be checked` });
            continue;
        }
        const page: StorePage | undefined = pages.find((p: StorePage) => p.name === change.page || p.title === change.page);
        const text: string | undefined = page === undefined ? undefined : readPage(page.name);
        if (page === undefined || text === undefined) {
            problems.push({ line: change.line, message: `no page named "${change.page ?? "?"}" was found in the concept store, so a change to it cannot be stated` });
        } else if (!squash(text).includes(squash(change.old))) {
            problems.push({ line: change.line, message: `the quoted statement does not appear on the ${page.name} page: "${change.old}"` });
        }
        if (change.decisions.length === 0) {
            problems.push({ line: change.line, message: "change must cite the decision that causes it, e.g. (D4)" });
        }
        for (const id of change.decisions) {
            const decision: SectionDecision | undefined = decisions.find((d: SectionDecision) => d.id === id);
            if (decision === undefined) {
                problems.push({ line: change.line, message: `cites ${id}, which is not a decision in this record` });
            } else if (decision.tradeOff === undefined) {
                problems.push({ line: decision.line, message: `${id} causes a concept-store change, so its trade-off must name the recorded reasoning it reverses; "none" is refused` });
            }
        }
    }
    return problems;
}

export function runRecordConceptCheck(argv: string[], io: CliIo): number {
    const flags: Record<string, string> = {};
    for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) flags[argv[i].slice(2)] = argv[++i] ?? "";
    if (flags.draft === undefined) {
        io.stderr("usage: nexus record-concept-check --draft <record.md> [--store <dir>]");
        return 2;
    }
    let body: string;
    try {
        body = fs.readFileSync(path.resolve(io.cwd, flags.draft), "utf8");
    } catch {
        io.stderr(`record-concept-check: cannot read ${flags.draft}`);
        return 1;
    }
    const store: string = path.resolve(io.cwd, flags.store ?? path.join(".nexus", "concepts"));
    const read = (name: string): string | undefined => {
        try {
            return fs.readFileSync(path.join(store, `${name}.md`), "utf8");
        } catch {
            return undefined;
        }
    };
    const problems: ConceptProblem[] = checkConceptSection(body, loadStore(store), read);
    if (problems.length === 0) {
        io.stdout("record-concept-check: clean");
        return 0;
    }
    for (const p of problems) io.stderr(`record-concept-check: ${p.line > 0 ? `line ${p.line}: ` : ""}${p.message}`);
    return 1;
}
