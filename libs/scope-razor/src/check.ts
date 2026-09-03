/**
 * The razor's one mechanical enforcer (epic #284, story #287).
 *
 * Four stages apply the same rules, and one of them — the decision-record stage — has no gate agent
 * at all, so a check that lived in a gate's prompt would mean either a second implementation or an
 * unchecked rule somewhere else. Everything here is a count, a presence test, or normalized
 * substring containment. Nothing here is a judgment: the one razor rule that needs one —
 * whether a phrase names a mechanism — is prevented at drafting time and reported by the reviewer's
 * gate as an observation, never decided here.
 */

import { citationHolds, citations, MINIMUM_FRAGMENT_WORDS, type Citation } from "./citations.js";

/** Blocking findings stop a run before the reviewer sees a digest; advisory ones are carried to them. */
export type Severity = "blocking" | "advisory";

/** One razor violation, named by where it is so the caller can fix it without hunting. */
export interface RazorFinding {
    severity: Severity;
    /** The rule that failed, as a stable slug the caller may group on. */
    rule: "acceptance-criteria-ceiling" | "section-limit" | "citation" | "personas-table";
    /** The story title or section heading the finding belongs to. */
    where: string;
    message: string;
}

/** The ceiling on acceptance criteria for one story. Above it, the story states a reason. */
const AC_CEILING: number = 5;
/** The limit on Assumptions and on Out of Scope. No escape; either section may be empty. */
const SECTION_LIMIT: number = 5;

/** A `## ` section of the draft, from its heading to the next one. */
interface Section {
    heading: string;
    lines: string[];
}

function sections(draft: string, depth: string): Section[] {
    const found: Section[] = [];
    let open: Section | undefined;
    for (const line of draft.split("\n")) {
        const heading: RegExpMatchArray | null = line.match(/^(#+) /);
        if (heading === null) {
            open?.lines.push(line);
        } else if (heading[1] === depth) {
            open = { heading: line.slice(depth.length + 1).trim(), lines: [] };
            found.push(open);
        } else if (heading[1].length > depth.length) {
            // A deeper heading is content of the open section, not a boundary.
            open?.lines.push(line);
        } else {
            open = undefined;
        }
    }
    return found;
}

/** Top-level list items — a nested continuation line is part of its item, not a second one. */
function bullets(lines: string[]): string[] {
    return lines.filter((line: string) => /^- /.test(line));
}

function checkStories(draft: string): RazorFinding[] {
    const findings: RazorFinding[] = [];
    for (const story of sections(draft, "###")) {
        const criteria: string[] = story.lines.filter((line: string) => /^- \[[ x]\] /.test(line));
        const reason: boolean = story.lines.some((line: string) => /^\*\*Reason for /.test(line.trim()));
        if (criteria.length > AC_CEILING && !reason) {
            findings.push({
                severity: "blocking",
                rule: "acceptance-criteria-ceiling",
                where: story.heading,
                message: `${criteria.length} acceptance criteria, above the ceiling of ${AC_CEILING}, with no stated reason.`,
            });
        }
    }
    return findings;
}

function checkSections(draft: string): RazorFinding[] {
    const findings: RazorFinding[] = [];
    for (const section of sections(draft, "##")) {
        const name: string = section.heading.replace(/\s*<!--.*$/, "").trim();
        if (name !== "Assumptions" && name !== "Out of Scope") continue;
        const items: string[] = bullets(section.lines);
        if (items.length > SECTION_LIMIT) {
            findings.push({
                severity: "blocking",
                rule: "section-limit",
                where: name,
                message: `${items.length} items, above the limit of ${SECTION_LIMIT}. This limit admits no stated reason.`,
            });
        }
    }
    return findings;
}

function checkPersonas(draft: string): RazorFinding[] {
    for (const section of sections(draft, "##")) {
        const name: string = section.heading.replace(/\s*<!--.*$/, "").trim();
        if (name !== "Personas") continue;
        if (section.lines.some((line: string) => line.trim().startsWith("|"))) {
            return [{
                severity: "blocking",
                rule: "personas-table",
                where: "Personas",
                message: "A table under the personas heading. Tabulate only a persona specific to this epic or a deviation from the canonical set.",
            }];
        }
    }
    return [];
}

function checkCitations(draft: string, sourceText: string): RazorFinding[] {
    return citations(draft)
        .filter((cited: Citation) => !citationHolds(cited.fragment, sourceText))
        .map((cited: Citation) => ({
            severity: "blocking" as const,
            rule: "citation" as const,
            where: cited.item,
            message: `Labelled asked, but "${cited.fragment}" is not in the run's source text, or is shorter than ${MINIMUM_FRAGMENT_WORDS} words.`,
        }));
}

/**
 * Every mechanically decidable razor rule, over one draft and the source text that run was given.
 * An empty result is a draft that breaks none of them.
 */
export function checkDraft(draft: string, sourceText: string): RazorFinding[] {
    return [...checkStories(draft), ...checkSections(draft), ...checkPersonas(draft), ...checkCitations(draft, sourceText)];
}
