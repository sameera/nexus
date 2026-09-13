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

import { type CoverageGap, type CoverageVerdict, type PlanDraft, type PlanStub } from "./plan-draft.js";
import { recheckCoverage, rewritePlan, type RewriteOptions } from "./plan-rewrite.js";

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

/** What the gate needs beyond the draft: each story's title, quoted as data, and whether the focus matched nothing. */
export interface GateContext {
    titles: ReadonlyMap<number, string>;
    focusMatchedNothing: boolean;
}

/**
 * The approval gate's digest, printed by code so it cannot leave out a slice, a scaffold or a removed
 * concept (record #591). One line per slice: position, identity, mark and the story title as quoted
 * data. The parts of a split story sit under their story, and a scaffold names the slice whose
 * assumption forced it. It carries no pinned state, no story body, no lesson prose and no source
 * (invariants 16, 17). The learner's phrases appear here and in no committed file (invariant 18).
 */
export function renderGateDigest(draft: PlanDraft, context: GateContext): string {
    const lines: string[] = [`The plan: ${draft.slices.length} slice${draft.slices.length === 1 ? "" : "s"}, in teaching order.`];
    draft.slices.forEach((stub: PlanStub, index: number) => {
        const position: string = `${String(index + 1).padStart(3)}.`;
        if (stub.scaffold !== undefined) {
            lines.push(`${position} scaffold ${stub.scaffold} — learner — a teaching step, forced by what #${stub.need} assumes`);
            return;
        }
        const title: string = JSON.stringify(context.titles.get(stub.story as number) ?? "");
        if (stub.part === undefined) lines.push(`${position} #${stub.story} — ${stub.builds} — ${title}`);
        else {
            if (stub.part === 1) lines.push(`     #${stub.story} — split — ${title}`);
            lines.push(`${position}   part ${stub.part} — ${stub.builds}`);
        }
    });
    const declared = draft.declared ?? [];
    lines.push("", "Removed because the learner already knows them:");
    lines.push(...(declared.length === 0 ? ["  (none)"] : declared.map((entry) => `  ${entry.concept} — ${JSON.stringify(entry.phrase)}`)));
    const unmatched: string[] = draft.unmatched ?? [];
    lines.push("", "Declared phrases that matched no concept:");
    lines.push(...(unmatched.length === 0 ? ["  (none)"] : unmatched.map((phrase) => `  ${JSON.stringify(phrase)}`)));
    lines.push(
        "",
        context.focusMatchedNothing ? "The learner's focus matched no story." : "The learner's focus matched at least one story.",
        "Coverage: clean — every concept a slice assumes is taught before it.",
    );
    return lines.join("\n");
}

/** A reviewer's mark overrides, by story. Only marks can change at the gate (invariant 19). */
export type MarkOverrides = ReadonlyMap<number, "learner" | "handoff">;

/**
 * Rebuild a draft after a mark change, from freshly drafted stubs (the checked lists under the recorded
 * merge and overrides) and the previous draft's recorded declaration, then run the rewrite again. It
 * re-reads no story and asks for no judgement again, so changing a mark and changing it back gives the
 * same draft (invariants 21, 22).
 */
export function rebuildDraft(previous: PlanDraft, fresh: Pick<PlanDraft, "slices" | "vocabulary">, options: RewriteOptions): PlanDraft {
    const gone: Set<string> = new Set((previous.declared ?? []).map((entry) => entry.concept));
    const slices: PlanStub[] = fresh.slices.map((stub): PlanStub => ({ ...stub, concepts: stub.concepts.filter((id) => !gone.has(id)) }));
    return rewritePlan(
        {
            slices,
            ...(fresh.vocabulary === undefined ? {} : { vocabulary: fresh.vocabulary }),
            ...(previous.declared === undefined ? {} : { declared: previous.declared }),
            ...(previous.unmatched === undefined ? {} : { unmatched: previous.unmatched }),
        },
        options,
    );
}
