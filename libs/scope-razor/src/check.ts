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

import { citationHolds, citations, MINIMUM_FRAGMENT_WORDS, normalize, type Citation } from "./citations.js";
import {
    NECESSITY_HEADING,
    orderedByUnlock,
    ORDERING_HEADING,
    parseOrdering,
    smallestUsableVersion,
    storyTitles,
    unmetBlockers,
    type OrderingEntry,
    type UnmetBlocker,
} from "./ordering.js";

/** Blocking findings stop a run before the reviewer sees a digest; advisory ones are carried to them. */
export type Severity = "blocking" | "advisory";

/** One razor violation, named by where it is so the caller can fix it without hunting. */
export interface RazorFinding {
    severity: Severity;
    /** The rule that failed, as a stable slug the caller may group on. */
    rule: "acceptance-criteria-ceiling" | "section-limit" | "citation" | "personas-table" | "provenance-label" | "ordering" | "closure";
    /** The story title or section heading the finding belongs to. */
    where: string;
    message: string;
}

/**
 * The counted limits. Their normative home is §5 of the `nxs-razor` skill; these constants are the
 * one implementation of it, and a conformance test pins them to that table so a divergence fails a
 * build rather than passing silently. Change the skill and this pair together.
 */

/** The ceiling on acceptance criteria for one story. Above it, the story states a reason. */
export const AC_CEILING: number = 5;
/** The limit on Assumptions and on Out of Scope. No escape; either section may be empty. */
export const SECTION_LIMIT: number = 5;

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

/** The two-valued vocabulary, as a presence test: an item carries one of them or it carries none. */
const LABELLED: RegExp = /`?\[(?:inferred|asked:[ \t]*"[^"]*")\]`?/;

/**
 * The provenance rule (§1), as the presence test invariant 5 permits. Without it an unlabelled item
 * is a third state the vocabulary denies — neither asked nor inferred — and it is the one state the
 * gate cannot see, because every other razor check reads a label that is there.
 */
function unlabelled(items: string[], where: string): RazorFinding[] {
    return items
        .filter((item: string) => !LABELLED.test(item))
        .map((item: string) => ({
            severity: "blocking" as const,
            rule: "provenance-label" as const,
            where,
            message: `"${item.replace(/^- (\[[ x]\] )?/, "").trim()}" carries no provenance label. Every item is \`[asked: "…"]\` or \`[inferred]\`.`,
        }));
}

function checkStories(draft: string): RazorFinding[] {
    const findings: RazorFinding[] = [];
    for (const story of sections(draft, "###")) {
        const criteria: string[] = story.lines.filter((line: string) => /^- \[[ x]\] /.test(line));
        const reason: boolean = story.lines.some((line: string) => /^\*\*Reason for /.test(line.trim()));
        findings.push(...unlabelled(criteria, story.heading));
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
        findings.push(...unlabelled(items, name));
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
 * The ordering block, as a name match and a walk (epic #576, story #577). The gate cannot tell a
 * reviewer what a story waits on unless the graph exists while they are deciding, and it cannot
 * check the approved set against a graph that names stories the draft does not have.
 *
 * A draft that declares no story is not an epic draft — the record and discovery stages share this
 * checker — so it raises nothing there rather than demanding a block those drafts have no use for.
 */
function checkOrdering(draft: string): RazorFinding[] {
    const titles: string[] = storyTitles(draft);
    if (titles.length === 0) return [];

    const entries: OrderingEntry[] = parseOrdering(draft);
    const findings: RazorFinding[] = [];
    const placed = (title: string): boolean => entries.some((entry: OrderingEntry) => normalize(entry.title) === normalize(title));
    const isStory = (title: string): boolean => titles.some((name: string) => normalize(name) === normalize(title));

    for (const title of titles) {
        if (!placed(title)) {
            findings.push({
                severity: "blocking",
                rule: "ordering",
                where: title,
                message: `No row under "${ORDERING_HEADING}" places this story. Every story names what it waits on, or \`none\`.`,
            });
        }
    }
    for (const entry of entries) {
        if (!isStory(entry.title)) {
            findings.push({
                severity: "blocking",
                rule: "ordering",
                where: entry.title,
                message: `Ordered, but no story in this draft carries that title.`,
            });
        }
        for (const blocker of entry.blockedBy.filter((name: string) => !isStory(name))) {
            findings.push({
                severity: "blocking",
                rule: "ordering",
                where: entry.title,
                message: `Waits on "${blocker}", which names no story in this draft.`,
            });
        }
    }

    const order: string[] = orderedByUnlock(entries);
    const cyclic: string[] = entries
        .filter((entry: OrderingEntry) =>
            entry.blockedBy.some(
                (blocker: string) => isStory(blocker) && order.findIndex((t: string) => normalize(t) === normalize(blocker)) > order.findIndex((t: string) => normalize(t) === normalize(entry.title)),
            ),
        )
        .map((entry: OrderingEntry) => entry.title);
    if (cyclic.length > 0) {
        findings.push({
            severity: "blocking",
            rule: "ordering",
            where: cyclic[0],
            message: `A cycle in the ordering block, through ${cyclic.map((t: string) => `"${t}"`).join(", ")}. No order satisfies it.`,
        });
    }
    return findings;
}

/**
 * The closure rule over an arbitrary set of stories (epic #576, story #578): a set that cannot run
 * without a story it excludes is not a usable version.
 *
 * It is one rule applied twice — at drafting time over the named smallest usable version, and at
 * apply time over the set approved for filing after any addition. Both live here rather than in a
 * gate's prose, because a gate instruction is something a model can drop and the point of the rule
 * is that the reviewer is never shown, and never files, a set that will not run.
 */
export function checkFiledSet(entries: OrderingEntry[], chosen: string[]): RazorFinding[] {
    return unmetBlockers(entries, chosen).map((unmet: UnmetBlocker) => ({
        severity: "blocking" as const,
        rule: "closure" as const,
        where: unmet.story,
        message: `Waits on "${unmet.blocker}", which this set excludes. A set that cannot run without an excluded story is not a usable version.`,
    }));
}

/** The same rule at drafting time, over the necessity answer, before the gate renders. */
function checkNecessity(draft: string): RazorFinding[] {
    const named: string[] | undefined = smallestUsableVersion(draft);
    if (named === undefined) return [];

    const titles: string[] = storyTitles(draft);
    const unknown: RazorFinding[] = named
        .filter((name: string) => !titles.some((title: string) => normalize(title) === normalize(name)))
        .map((name: string) => ({
            severity: "blocking" as const,
            rule: "closure" as const,
            where: NECESSITY_HEADING,
            message: `Names "${name}", which is no story in this draft.`,
        }));

    return [...unknown, ...checkFiledSet(parseOrdering(draft), named)];
}

/**
 * Every mechanically decidable razor rule, over one draft and the source text that run was given.
 * An empty result is a draft that breaks none of them.
 */
export function checkDraft(draft: string, sourceText: string): RazorFinding[] {
    return [...checkStories(draft), ...checkSections(draft), ...checkPersonas(draft), ...checkOrdering(draft), ...checkNecessity(draft), ...checkCitations(draft, sourceText)];
}
