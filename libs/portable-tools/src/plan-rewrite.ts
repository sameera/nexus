/**
 * The rewrite that turns a one-slice-per-story draft into a teachable sequence (epic #457).
 *
 * Epic #456 wrote a stub per story and stopped: one slice per story, in the order the roadmap's
 * dependency edges gave them, with whatever concepts each story's own extraction proposed. Nobody
 * had yet asked whether a concept is taught twice, whether a step teaches more than a person can
 * hold, or whether a slice assumes something no earlier slice taught. This module answers those
 * questions, and it answers them as arithmetic over the stubs: it reads no story text, no decision
 * record and no diff, so it can run over a roadmap of any size.
 *
 * **Ownership is derived from the order, never run before it** (record for #457, decision 1). Which
 * slice owns a concept depends on which slice comes first, and which order is best depends on what
 * each slice introduces — as two passes those questions are mutually dependent, and ownership
 * assigned against the arriving order is stale the moment the order changes. So one traversal
 * produces the order and the subtraction together: a concept counts against a step the first time it
 * appears, and every later slice that proposed the same concept records it as assumed instead.
 *
 * A slice whose every proposed concept an earlier slice already teaches **stays in the plan** and
 * introduces nothing (invariant 3). Such a slice builds something real while teaching nothing new,
 * and dropping it would drop the story with it; its lesson carries the exercise alone.
 *
 * A handoff slice is untouched. It teaches nothing, so it owns nothing and assumes nothing, and the
 * concepts its story proposed stay only in that story's checked list under the names its extractor
 * gave them (record for #456, decision 7).
 */

import { type PlanDraft, type PlanStub } from "./plan-draft.js";

/** Append to `into` the entries of `from` that it does not already hold. Order is the first sighting. */
function appendNew(into: string[], from: readonly string[]): void {
    for (const id of from) if (!into.includes(id)) into.push(id);
}

/**
 * Walk the slices once, in the order given, assigning each concept to the first slice that proposes
 * it. Every later slice that proposed the same concept assumes it instead.
 */
function assignIntroductions(slices: readonly PlanStub[]): PlanStub[] {
    const owned: Set<string> = new Set();
    return slices.map((stub): PlanStub => {
        if (stub.builds === "handoff") return { ...stub, concepts: [], assumes: [] };
        const concepts: string[] = [];
        const taken: string[] = [];
        for (const id of stub.concepts) {
            if (owned.has(id)) taken.push(id);
            else if (!concepts.includes(id)) concepts.push(id);
        }
        for (const id of concepts) owned.add(id);
        // What the slice already assumed comes first, then what it no longer introduces: a concept a
        // slice assumes is not one it teaches, so the two lists never overlap.
        const assumes: string[] = [];
        appendNew(assumes, stub.assumes.filter((id) => !concepts.includes(id)));
        appendNew(assumes, taken);
        return { ...stub, concepts, assumes };
    });
}

/**
 * Rewrite a planning pass's draft. The result is a draft of the same shape — the rewrite replaces
 * the draft whole and never edits one in place.
 */
export function rewritePlan(draft: PlanDraft): PlanDraft {
    const slices: PlanStub[] = assignIntroductions(draft.slices);
    return draft.vocabulary === undefined ? { slices } : { slices, vocabulary: draft.vocabulary };
}
