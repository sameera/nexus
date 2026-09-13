/**
 * The approval gate (epic #458, decision record #591): the one human checkpoint a plan draft passes
 * through before it becomes the committed plan a teaching session reads.
 *
 * A draft whose coverage is not clean never reaches the reviewer, and that refusal is code rather
 * than an instruction to refuse, because an instruction can be skipped (record #562, invariant 33).
 * The draft is a file an agent can write, so the recorded verdict is not trusted on its own: the
 * coverage is checked again over the draft's slices, and a verdict the fresh check contradicts is
 * refused exactly as a gap is (record #591, invariants 10–12). The same refusal runs when the gate is
 * printed and again when the approval is written.
 */

import { type CoverageGap, type CoverageVerdict, type PlanDraft } from "./plan-draft.js";
import { recheckCoverage } from "./plan-rewrite.js";

export type CoverageRefusal = { refused: false } | { refused: true; gaps: CoverageGap[]; report: string };

function describeGap(gap: CoverageGap): string {
    const who: string = gap.story === undefined ? "a slice" : `#${gap.story}`;
    return gap.handedOff === undefined
        ? `  ${who} assumes ${gap.concept}, which no earlier slice introduces.`
        : `  ${who} assumes ${gap.concept}, which only the handed-off story #${gap.handedOff} would introduce.`;
}

function sameGaps(a: readonly CoverageGap[], b: readonly CoverageGap[]): boolean {
    const key = (gap: CoverageGap): string => `${gap.story}:${gap.concept}:${gap.handedOff ?? ""}`;
    return JSON.stringify(a.map(key).sort()) === JSON.stringify(b.map(key).sort());
}

/**
 * Refuse a draft that carries no coverage verdict, whose verdict names a gap, or whose verdict a fresh
 * check contradicts. The report names every gap the fresh check finds, so a hand-set clean verdict is
 * refused with the gaps it was hiding.
 */
export function refuseUncleanCoverage(
    draft: PlanDraft,
    handoffConcepts: ReadonlyMap<number, readonly string[]> = new Map(),
    introduced: readonly string[] = [],
): CoverageRefusal {
    const fresh: CoverageVerdict = recheckCoverage(draft, handoffConcepts, introduced);
    const recorded: CoverageVerdict | undefined = draft.coverage;
    const gaps: CoverageGap[] = fresh.gaps.length > 0 ? fresh.gaps : (recorded?.gaps ?? []);
    let lead: string | null = null;
    if (recorded === undefined) {
        lead = "the draft carries no coverage verdict, so nothing shows that every slice can be taught. Run the rewrite first.";
    } else if (!recorded.clean || recorded.gaps.length > 0) {
        lead = `the draft's coverage verdict names ${recorded.gaps.length} gap${recorded.gaps.length === 1 ? "" : "s"}.`;
    } else if (!fresh.clean || !sameGaps(fresh.gaps, recorded.gaps)) {
        lead = "the draft's recorded coverage verdict is clean, and a fresh check over its slices is not.";
    }
    if (lead === null) return { refused: false };
    return {
        refused: true,
        gaps,
        report: [`Approval refused: ${lead}`, ...gaps.map(describeGap), "Nothing in the committed workbook was written."].join("\n"),
    };
}
