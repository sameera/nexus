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
import { bullets, criteria, isLabelled, sections } from "./document.js";
import { stripLabels } from "./labels.js";
import { readRecord, recordFormat, type RecordLine, type RecordReading } from "./record.js";
import { compareSize, complexityDrivers, designWarrant, recordedComplexity, rollupFloor, storySizes, type Size, type StorySize } from "./rollup.js";
import {
    NECESSITY_HEADING,
    orderedByUnlock,
    ORDERING_HEADING,
    parseOrdering,
    smallestUsableVersion,
    storyHeadingTitle,
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
    rule: "acceptance-criteria-ceiling" | "section-limit" | "citation" | "personas-table" | "provenance-label" | "ordering" | "closure" | "rollup" | "record-format";
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

/**
 * The provenance rule (§1), as the presence test invariant 5 permits. Without it an unlabelled item
 * is a third state the vocabulary denies — neither asked nor inferred — and it is the one state the
 * gate cannot see, because every other razor check reads a label that is there.
 */
function unlabelled(items: string[], where: string): RazorFinding[] {
    return items
        .filter((item: string) => !isLabelled(item))
        .map((item: string) => ({
            severity: "blocking" as const,
            rule: "provenance-label" as const,
            where,
            message: `"${item.replace(/^- (\[[ x]\] )?/, "").trim()}" carries no provenance label. Every item is \`[asked: "…"]\` or \`[inferred]\`.`,
        }));
}

/**
 * The story rules — the labelled heading and the acceptance-criteria ceiling (epic #759, story #760).
 *
 * A story is a heading that names one, which is the definition the ordering check already reads the
 * draft with. Walking every third-level heading instead would read a decision record's decisions as
 * stories, and the razor states outright that a decision carries no provenance label: the check
 * would block every record on the one stage that has no gate agent to overrule it, and the only way
 * to clear the finding would be to label something the rule forbids labelling.
 */
function checkStories(draft: string): RazorFinding[] {
    const findings: RazorFinding[] = [];
    for (const story of sections(draft, "###")) {
        if (storyHeadingTitle(story.heading) === undefined) continue;

        const acceptance: string[] = criteria(story.lines);
        const reason: boolean = story.lines.some((line: string) => /^\*\*Reason for /.test(line.trim()));
        findings.push(...unlabelled([`- ${story.heading}`], `Story: ${stripLabels(story.heading).trim()}`));
        findings.push(...unlabelled(acceptance, story.heading));
        if (acceptance.length > AC_CEILING && !reason) {
            findings.push({
                severity: "blocking",
                rule: "acceptance-criteria-ceiling",
                where: story.heading,
                message: `${acceptance.length} acceptance criteria, above the ceiling of ${AC_CEILING}, with no stated reason.`,
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

/** How a draft is checked. `record` declares a decision-record draft, whose format is then checked too. */
export interface CheckOptions {
    record?: boolean;
}

/**
 * The provenance rule over a new-format record's guarantees and risks (epic #787, story #789, G7).
 * The checkpoint lists only the model's additions, so a line with no label is the one line a reader
 * cannot place. The reader treats it as the model's own, which keeps it on the cut list, and this
 * blocks it so the label is written rather than assumed. An old-format record is checked as before.
 */
function checkRecord(draft: string): RazorFinding[] {
    const record: RecordReading = readRecord(draft);
    if (record.format !== "new") return [];
    const texts = (items: RecordLine[]): string[] => items.map((item: RecordLine) => item.text);
    return [...unlabelled(texts(record.guarantees), "Guarantees"), ...unlabelled(texts(record.risks), "Risks and dependencies")];
}

/**
 * A record draft's format (epic #787, story #790, D3 and G20). Both templates require their
 * format's contract section at every tier, so a draft with neither was drafted from neither
 * template. Filed, it would be read whole by every later stage, with none of the checks either
 * format gets, so it stops here. The checker cannot tell a record draft from an epic draft by its
 * content, so the caller declares it.
 */
function checkRecordFormat(draft: string): RazorFinding[] {
    if (recordFormat(draft) !== "neither") return [];
    return [
        {
            severity: "blocking",
            rule: "record-format",
            where: "Decision record",
            message: 'The draft has neither a "## Guarantees" section (the approval-first format) nor a "## Constraints & Invariants" section (the old format), so no later stage could read its parts.',
        },
    ];
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

/** Where an apply-time finding belongs: the set the reviewer assembled, which no heading in the draft names. */
const FILED_SET: string = "the approved set";

/** A selected title that matches no story heading in the draft. */
function unknownTitles(draft: string, chosen: string[], where: string): RazorFinding[] {
    const titles: string[] = storyTitles(draft);
    return chosen
        .filter((name: string) => !titles.some((title: string) => normalize(title) === normalize(name)))
        .map((name: string) => ({
            severity: "blocking" as const,
            rule: "closure" as const,
            where,
            message: `Names "${name}", which is no story in this draft.`,
        }));
}

/**
 * The rollup arm of the apply-time check (epic #576, story #580): the epic's `complexity` and the
 * design warrant that follows from it are properties of the story set, so a filed set that differs
 * from the drafted one leaves both describing stories nobody filed.
 *
 * Only the mechanical half is decided here. The floor the filed sizes force is a comparison; how far
 * cross-story integration raises the rollup above that floor is a judgment, and the rule is that the
 * judgment is stated in `complexity_drivers` rather than left as the draft's first guess.
 */
function checkRollup(draft: string, chosen: string[]): RazorFinding[] {
    const sizes: StorySize[] = storySizes(draft);
    const inSet = (title: string): boolean => chosen.some((name: string) => normalize(name) === normalize(title));

    const unsized: RazorFinding[] = sizes
        .filter((story: StorySize) => inSet(story.title) && story.size === undefined)
        .map((story: StorySize) => ({
            severity: "blocking" as const,
            rule: "rollup" as const,
            where: story.title,
            message: "States no size, so the epic's rollup cannot be re-derived from the filed story set.",
        }));

    const floor: Size | undefined = rollupFloor(sizes, chosen);
    if (floor === undefined) return unsized;

    const recorded: Size | undefined = recordedComplexity(draft);
    const warrant: string = `The needs-design label follows from it: ${designWarrant(recorded) ? "M or larger carries it" : "S does not carry it"}.`;
    if (recorded === undefined) {
        return [...unsized, { severity: "blocking", rule: "rollup", where: FILED_SET, message: `Records no complexity rollup, and the filed story set forces at least ${floor}. ${warrant}` }];
    }
    if (compareSize(recorded, floor) < 0) {
        return [
            ...unsized,
            {
                severity: "blocking",
                rule: "rollup",
                where: FILED_SET,
                message: `Records complexity ${recorded}, below ${floor} — the largest size in the filed story set. Re-derive the rollup from the set actually filed. ${warrant}`,
            },
        ];
    }
    if (compareSize(recorded, floor) > 0 && complexityDrivers(draft).length === 0) {
        return [
            ...unsized,
            {
                severity: "blocking",
                rule: "rollup",
                where: FILED_SET,
                message: `Records complexity ${recorded}, above ${floor} — the largest size in the filed story set — and \`complexity_drivers\` names nothing that raises it. ${warrant}`,
            },
        ];
    }
    return unsized;
}

/**
 * The apply-time arm, run over the set the reviewer approved and **before any edge in the ordering
 * block is rewritten** (epic #576, stories #578 and #580). It is the one check between a selection
 * and a filed issue: the set is closed under its blockers, every name in it is a story, and the
 * rollup and the design warrant describe the stories actually filed.
 *
 * Reading the drafted graph is the whole point of its position. Rewriting a dropped story's edges
 * first — re-parenting its dependents onto its own blockers — makes every filed set trivially closed,
 * and the arm could never fire in the direction the addition convention added it for.
 */
export function checkApplied(draft: string, chosen: string[]): RazorFinding[] {
    return [...unknownTitles(draft, chosen, FILED_SET), ...checkFiledSet(parseOrdering(draft), chosen), ...checkRollup(draft, chosen)];
}

/** The same rule at drafting time, over the necessity answer, before the gate renders. */
function checkNecessity(draft: string): RazorFinding[] {
    const named: string[] | undefined = smallestUsableVersion(draft);
    if (named === undefined) return [];

    return [...unknownTitles(draft, named, NECESSITY_HEADING), ...checkFiledSet(parseOrdering(draft), named)];
}

/**
 * Every mechanically decidable razor rule, over one draft and the source text that run was given.
 * An empty result is a draft that breaks none of them.
 */
export function checkDraft(draft: string, sourceText: string, options: CheckOptions = {}): RazorFinding[] {
    return [
        ...(options.record === true ? checkRecordFormat(draft) : []),
        ...checkStories(draft),
        ...checkSections(draft),
        ...checkRecord(draft),
        ...checkPersonas(draft),
        ...checkOrdering(draft),
        ...checkNecessity(draft),
        ...checkCitations(draft, sourceText),
    ];
}
