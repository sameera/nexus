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

import { KNOWLEDGE_SLOTS, type InterviewRecord, type SlotAnswer } from "./interview.js";
import { type PlanDraft, type PlanStub, type VocabularyEntry } from "./plan-draft.js";

/** One phrase the planning session matched, the slot it came from, and what it names. */
export interface DeclaredPhrase {
    slot: string;
    /** The learner's own words, quoted verbatim from the slot's recorded answer. */
    phrase: string;
    /** The concepts those words name. Empty when the words name nothing the roadmap teaches. */
    concepts: string[];
}

/** What the planning session proposes: every phrase it read, matched or not. */
export interface Declaration {
    declared: DeclaredPhrase[];
}

export type DeclarationResult = { ok: true; draft: PlanDraft } | { ok: false; problem: string };

/**
 * Remove from the whole plan what the learner said they already know (epic #457, story #555).
 *
 * This is the epic's one judged input (record #562): a gloss is a sentence and an interview answer
 * is prose, so scoring one against the other by lexical means produces false positives — and a false
 * positive deletes teaching the learner needed, which the learner cannot detect, because nobody
 * notices the absence of a lesson they were never shown. So the planning session proposes the
 * mapping, and code applies it under three refusals that make a wrong match visible instead of
 * silent:
 *
 * - **Only knowledge-bearing slots are eligible** (invariant 6). What the learner came to learn is
 *   focus, not knowledge; what they most recently found hard is the slot most likely to name a
 *   concept in their own words while meaning the opposite of knowing it.
 * - **Every match quotes the learner's phrase verbatim** from that slot's recorded answer. That also
 *   makes the phrases that matched nothing the exact complement of the mapping, so reporting them
 *   needs no second judgement (invariant 8).
 * - **A match names a concept the merged vocabulary already holds** (invariant 7) — its kept
 *   identifier or any name the merge folded into it. Anything else is refused rather than applied.
 *
 * A removed concept is recorded with the draft beside the learner's quoted phrase, so the reviewer
 * at the approval gate sees what the learner was assumed to know (invariant 9). The phrases reach no
 * stub and no committed file (invariant 10), and nothing here is reported to the learner: the pass
 * asks them nothing, so a learner-facing report would be this epic's only learner-facing surface and
 * would catch nothing the reviewer does not already see.
 *
 * A removed concept is removed from what every slice **introduces** and left wherever a slice
 * **assumes** it, because a concept the learner already holds is satisfied rather than missing
 * (invariant 5) — which is what keeps the coverage check from faulting a plan that introduces it
 * nowhere.
 */
export function applyDeclaration(interview: InterviewRecord, draft: PlanDraft, declaration: Declaration): DeclarationResult {
    const vocabulary: readonly VocabularyEntry[] = draft.vocabulary ?? [];
    const kept: Map<string, string> = new Map();
    for (const entry of vocabulary) {
        kept.set(entry.id, entry.id);
        for (const alias of entry.aliases) kept.set(alias, entry.id);
    }

    const removed: { concept: string; phrase: string }[] = [];
    const unmatched: string[] = [];
    for (const entry of declaration.declared) {
        if (!KNOWLEDGE_SLOTS.includes(entry.slot)) {
            return {
                ok: false,
                problem:
                    `the declaration reads ${entry.slot}, which records no prior knowledge. Only ` +
                    `${KNOWLEDGE_SLOTS.join(", ")} say what the learner already knows — what they came to learn is ` +
                    `focus, and what they last found hard is the opposite of knowing it. Nothing was removed.`,
            };
        }
        const slot: SlotAnswer | undefined = interview.slots.find((answer) => answer.slot === entry.slot);
        if (slot === undefined || !slot.answered || !slot.answer.includes(entry.phrase)) {
            return {
                ok: false,
                problem:
                    `the declaration quotes ${JSON.stringify(entry.phrase)} from ${entry.slot}, which that slot's ` +
                    `recorded answer does not hold verbatim. A match quotes the learner's own words, so a wrong one ` +
                    `is visible at the gate. Nothing was removed.`,
            };
        }
        if (entry.concepts.length === 0) {
            if (!unmatched.includes(entry.phrase)) unmatched.push(entry.phrase);
            continue;
        }
        for (const proposed of entry.concepts) {
            const concept: string | undefined = kept.get(proposed);
            if (concept === undefined) {
                return {
                    ok: false,
                    problem:
                        `the declaration names ${proposed}, which the merged vocabulary does not hold. A match names a ` +
                        `concept the roadmap teaches and never invents one. Nothing was removed.`,
                };
            }
            if (!removed.some((match) => match.concept === concept)) removed.push({ concept, phrase: entry.phrase });
        }
    }

    const gone: Set<string> = new Set(removed.map((match) => match.concept));
    const slices: PlanStub[] = draft.slices.map((stub): PlanStub => ({ ...stub, concepts: stub.concepts.filter((id) => !gone.has(id)) }));
    return { ok: true, draft: { ...draft, slices, declared: removed, unmatched } };
}

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
    return { ...draft, slices: assignIntroductions(draft.slices) };
}
