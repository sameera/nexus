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

/** One story's dependency edges, as the resolved roadmap records them. */
export interface StoryEdges {
    story: number;
    blockedBy: number[];
}

export interface RewriteOptions {
    /** The roadmap's dependency edges. Without them the draft keeps the order it arrived in. */
    edges?: readonly StoryEdges[];
}

/** Append to `into` the entries of `from` that it does not already hold. Order is the first sighting. */
function appendNew(into: string[], from: readonly string[]): void {
    for (const id of from) if (!into.includes(id)) into.push(id);
}

/** Assign one slice's concepts against what is already owned, and record the rest as assumed. */
function assign(stub: PlanStub, owned: Set<string>): PlanStub {
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
}

/**
 * The blockers of each slice, restricted to the slices the plan holds. An edge onto a story that
 * sits outside the roadmap is a real prerequisite nobody here will build, so it constrains nothing.
 */
function blockersWithin(slices: readonly PlanStub[], edges: readonly StoryEdges[]): Map<number, number[]> {
    const held: Set<number> = new Set(slices.map((stub) => stub.story));
    const direct: Map<number, number[]> = new Map(slices.map((stub) => [stub.story, []]));
    for (const edge of edges) {
        if (!held.has(edge.story)) continue;
        direct.set(edge.story, edge.blockedBy.filter((blocker) => held.has(blocker) && blocker !== edge.story));
    }
    return direct;
}

/**
 * The learner-slice graph: each learner slice's blockers, with every edge that runs through a
 * handoff slice carried across as a transitive edge (invariant 11).
 *
 * Order is decided over learner slices alone (invariant 12), because a handoff slice introduces
 * nothing — its cost is zero at every position, so it takes no ordering freedom. Carrying the
 * transitive edges is what makes that exclusion lossless.
 */
function learnerBlockers(slices: readonly PlanStub[], direct: Map<number, number[]>): Map<number, number[]> {
    const learners: Set<number> = new Set(slices.filter((stub) => stub.builds === "learner").map((stub) => stub.story));
    const resolved: Map<number, number[]> = new Map();
    const walk = (story: number, seen: Set<number>): number[] => {
        const found: number[] = [];
        for (const blocker of direct.get(story) ?? []) {
            if (seen.has(blocker)) continue;
            seen.add(blocker);
            if (learners.has(blocker)) found.push(blocker);
            else appendNumbers(found, walk(blocker, seen));
        }
        return found;
    };
    for (const story of learners) resolved.set(story, walk(story, new Set([story])));
    return resolved;
}

function appendNumbers(into: number[], from: readonly number[]): void {
    for (const value of from) if (!into.includes(value)) into.push(value);
}

/**
 * Order the learner slices by step-wise greedy selection (record #562).
 *
 * At each position the candidates are the slices whose blockers are already placed, and the pass
 * takes the candidate introducing the fewest concepts not yet introduced. The candidate set depends
 * only on the prefix, so this attains the minimum new-concept count at every position given the
 * positions before it — which is exactly the minimality story #556 asks for, reached exactly rather
 * than by a heuristic. Ties break by ascending story number, the same tie-break the roadmap resolver
 * already uses to make its own order total.
 *
 * Ownership is assigned as the order is built, never before it (decision 1): a concept counts
 * against a step the first time it appears, and the objective the selection minimises is then
 * literally the number of new concepts the step introduces.
 */
function orderLearnerSlices(slices: readonly PlanStub[], blockers: Map<number, number[]>): PlanStub[] {
    const remaining: PlanStub[] = slices.filter((stub) => stub.builds === "learner").sort((a, b) => a.story - b.story);
    const placed: Set<number> = new Set();
    const owned: Set<string> = new Set();
    const order: PlanStub[] = [];

    while (remaining.length > 0) {
        const ready: PlanStub[] = remaining.filter((stub) => (blockers.get(stub.story) ?? []).every((blocker) => placed.has(blocker)));
        // The roadmap resolver refuses a cycle before a plan is ever drafted, so nothing should be
        // unreachable here; taking the lowest remaining story keeps the pass total if one ever is.
        const candidates: PlanStub[] = ready.length > 0 ? ready : remaining;
        const cost = (stub: PlanStub): number => new Set(stub.concepts.filter((id) => !owned.has(id))).size;
        const chosen: PlanStub = candidates.reduce((best, stub) => (cost(stub) < cost(best) ? stub : best));
        remaining.splice(remaining.indexOf(chosen), 1);
        placed.add(chosen.story);
        order.push(assign(chosen, owned));
    }
    return order;
}

/**
 * Put the handoff slices back into the learner order. Each is placed as soon as what blocks it is
 * placed, so no slice precedes a slice that blocks it, transitively or through a handoff.
 */
function placeHandoffs(slices: readonly PlanStub[], order: readonly PlanStub[], direct: Map<number, number[]>): PlanStub[] {
    const waiting: PlanStub[] = slices.filter((stub) => stub.builds === "handoff").sort((a, b) => a.story - b.story);
    const placed: Set<number> = new Set();
    const out: PlanStub[] = [];
    const drain = (): void => {
        for (let moved = true; moved; ) {
            moved = false;
            for (let i = 0; i < waiting.length; i++) {
                if (!(direct.get(waiting[i].story) ?? []).every((blocker) => placed.has(blocker))) continue;
                const stub: PlanStub = waiting.splice(i--, 1)[0];
                placed.add(stub.story);
                out.push({ ...stub, concepts: [], assumes: [] });
                moved = true;
            }
        }
    };
    drain();
    for (const stub of order) {
        out.push(stub);
        placed.add(stub.story);
        drain();
    }
    for (const stub of waiting) out.push({ ...stub, concepts: [], assumes: [] });
    return out;
}

/**
 * Rewrite a planning pass's draft. The result is a draft of the same shape — the rewrite replaces
 * the draft whole and never edits one in place.
 */
export function rewritePlan(draft: PlanDraft, options: RewriteOptions = {}): PlanDraft {
    if (options.edges === undefined) {
        const owned: Set<string> = new Set();
        return { ...draft, slices: draft.slices.map((stub) => assign(stub, owned)) };
    }
    const direct: Map<number, number[]> = blockersWithin(draft.slices, options.edges);
    const order: PlanStub[] = orderLearnerSlices(draft.slices, learnerBlockers(draft.slices, direct));
    return { ...draft, slices: placeHandoffs(draft.slices, order, direct) };
}
