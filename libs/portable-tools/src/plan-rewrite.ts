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
import { type CoverageGap, type CoverageVerdict, type PlanDraft, type PlanStub, type VocabularyEntry } from "./plan-draft.js";

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

/**
 * How many new concepts one step may carry, inclusive (record #562).
 *
 * Four is the working-memory ceiling for genuinely novel material, and the shipped sitting already
 * spends attention elsewhere: a cold drill, a revisit of what the learner took hints on, the theory,
 * and one exercise the learner writes a test for first. The extraction ceiling of twelve is a guard
 * against a runaway extraction rather than a claim about what a person can hold in one sitting, and a
 * twelve-concept lesson is exactly the step this limit exists to break up.
 */
export const STEP_CONCEPT_LIMIT: number = 4;

/** One story's dependency edges, as the resolved roadmap records them. */
export interface StoryEdges {
    story: number;
    blockedBy: number[];
}

export interface RewriteOptions {
    /** The roadmap's dependency edges. Without them the draft keeps the order it arrived in. */
    edges?: readonly StoryEdges[];
    /**
     * What each handed-off story would have introduced, under the merged vocabulary's identifiers.
     * A handoff stub carries no concepts, so this is what lets a gap name the story a concept came
     * from (record #562).
     */
    handoffConcepts?: ReadonlyMap<number, readonly string[]>;
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
    const held: Set<number> = new Set(slices.flatMap((stub) => (stub.story === undefined ? [] : [stub.story])));
    const direct: Map<number, number[]> = new Map([...held].map((story) => [story, []]));
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
    const learners: Set<number> = new Set(slices.filter((stub) => stub.builds === "learner" && stub.story !== undefined).map((stub) => stub.story as number));
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
 * Decide which concepts need a scaffold, and which only need the order rearranging (story #559).
 *
 * The restraint is the whole of the story: reordering is tried first, and a scaffold is the last
 * resort. So the question "could this concept be taught in time" is answered from the **dependency
 * edges** — whether the graph permits the concept's introducer to precede the slice that assumes it
 * — rather than from whichever order the greedy pass happens to land on. Reachability is a property
 * of the edges, so the answer is the same on every run; deciding from the chosen order would instead
 * make the number of scaffolds depend on the selection rule.
 *
 * Every satisfiable need becomes an **added edge** on the learner-slice graph, and the ordering pass
 * then satisfies them all by construction. Avoiding a scaffold outranks minimising one step's load,
 * so minimality is over the orders these added edges permit. The restraint is read one concept at a
 * time, so where the added edges cannot all hold together the pass drops the ones that would close a
 * cycle — taking them in ascending order of the assuming story, then in the merged vocabulary's own
 * order — and scaffolds each dropped concept.
 *
 * Two cases are decided before reachability is consulted. A concept **no slice of the roadmap
 * introduces** is treated as one no order could deliver, and is scaffolded rather than faulted: every
 * roadmap's first slices stand on background no story teaches, and placing required theory
 * immediately before the exercise is this feature's own premise. A concept only a **handed-off**
 * story would introduce is never scaffolded — that is the plan being wrong rather than tight, and a
 * scaffold there would cover up the defect the coverage check exists to surface.
 */
function decideScaffolds(
    slices: readonly PlanStub[],
    blockers: Map<number, number[]>,
    vocabulary: readonly VocabularyEntry[],
    declared: readonly string[],
    handoffOnly: ReadonlySet<string>,
): Map<number, string[]> {
    const rank: Map<string, number> = new Map(vocabulary.map((entry, index) => [entry.id, index]));
    const learners: PlanStub[] = slices.filter((stub) => stub.builds === "learner" && stub.story !== undefined);
    const introducers: Map<string, number[]> = new Map();
    for (const stub of [...learners].sort((a, b) => (a.story as number) - (b.story as number))) {
        for (const id of stub.concepts) introducers.set(id, [...(introducers.get(id) ?? []), stub.story as number]);
    }
    const satisfied: Set<string> = new Set(declared);

    /** Whether `blocker` already blocks `story`, transitively — so an edge the other way would cycle. */
    const blocks = (blocker: number, story: number): boolean => {
        const seen: Set<number> = new Set([story]);
        const stack: number[] = [...(blockers.get(story) ?? [])];
        while (stack.length > 0) {
            const next: number = stack.pop() as number;
            if (next === blocker) return true;
            if (seen.has(next)) continue;
            seen.add(next);
            stack.push(...(blockers.get(next) ?? []));
        }
        return false;
    };

    const needed: { story: number; concept: string }[] = [];
    for (const stub of learners) {
        for (const id of stub.assumes) if (!satisfied.has(id)) needed.push({ story: stub.story as number, concept: id });
    }
    needed.sort((a, b) => a.story - b.story || (rank.get(a.concept) ?? rank.size) - (rank.get(b.concept) ?? rank.size));

    const scaffolds: Map<number, string[]> = new Map();
    for (const { story, concept } of needed) {
        if (handoffOnly.has(concept)) continue;
        // The lowest-numbered introducer the graph still permits to go first. An introducer this
        // slice already blocks would close a cycle, so it is passed over rather than forced.
        const introducer: number | undefined = (introducers.get(concept) ?? []).find((candidate) => candidate !== story && !blocks(story, candidate));
        if (introducer === undefined) {
            const held: string[] = scaffolds.get(story) ?? [];
            if (!held.includes(concept)) scaffolds.set(story, [...held, concept]);
            continue;
        }
        blockers.set(story, [...new Set([...(blockers.get(story) ?? []), introducer])]);
    }
    for (const [story, concepts] of scaffolds) {
        scaffolds.set(story, [...concepts].sort((a, b) => (rank.get(a) ?? rank.size) - (rank.get(b) ?? rank.size) || a.localeCompare(b)));
    }
    return scaffolds;
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
function orderLearnerSlices(slices: readonly PlanStub[], blockers: Map<number, number[]>, scaffolds: Map<number, string[]>): PlanStub[] {
    const remaining: PlanStub[] = slices
        .filter((stub) => stub.builds === "learner" && stub.story !== undefined)
        .sort((a, b) => (a.story as number) - (b.story as number));
    const placed: Set<number> = new Set();
    const owned: Set<string> = new Set();
    const order: PlanStub[] = [];

    while (remaining.length > 0) {
        const ready: PlanStub[] = remaining.filter((stub) => (blockers.get(stub.story as number) ?? []).every((blocker) => placed.has(blocker)));
        // The roadmap resolver refuses a cycle before a plan is ever drafted, so nothing should be
        // unreachable here; taking the lowest remaining story keeps the pass total if one ever is.
        const candidates: PlanStub[] = ready.length > 0 ? ready : remaining;
        const cost = (stub: PlanStub): number => new Set(stub.concepts.filter((id) => !owned.has(id))).size;
        const chosen: PlanStub = candidates.reduce((best, stub) => (cost(stub) < cost(best) ? stub : best));
        remaining.splice(remaining.indexOf(chosen), 1);
        placed.add(chosen.story as number);
        // A scaffold is placed immediately before the slice whose assumption forced it, and it owns
        // the concept it teaches — so a later slice that also proposed it assumes it instead, and no
        // concept is introduced twice.
        for (const concept of scaffolds.get(chosen.story as number) ?? []) {
            if (owned.has(concept)) continue;
            owned.add(concept);
            order.push({ scaffold: concept, need: chosen.story as number, builds: "learner", concepts: [concept], assumes: [] });
        }
        order.push(assign(chosen, owned));
    }
    return order;
}

/**
 * Break the slices that would teach more than one step can hold (epic #457, story #558).
 *
 * A slice over the limit becomes the **fewest parts that all fit**, and the concepts are spread as
 * evenly as those parts allow — five concepts become three and two rather than four and one, because
 * a trailing part carrying a single concept reads to the learner as a step that exists for
 * administrative reasons, which is the same objection the scaffold restraint exists to prevent.
 *
 * The parts stay **consecutive inside the span their story held**, and each names that story. All
 * parts satisfy the dependency edges identically wherever the original sat, so splitting cannot
 * change the surrounding order and the ordering pass never runs again. A part after the first
 * assumes what the earlier parts introduced, which is what gives the coverage check something true
 * to check about each part. Concepts are assigned in the merged vocabulary's own order, which makes
 * the partition deterministic.
 */
function splitOverLimit(order: readonly PlanStub[], vocabulary: readonly VocabularyEntry[]): PlanStub[] {
    const rank: Map<string, number> = new Map(vocabulary.map((entry, index) => [entry.id, index]));
    const at = (id: string): number => rank.get(id) ?? vocabulary.length;
    const out: PlanStub[] = [];

    for (const stub of order) {
        if (stub.concepts.length <= STEP_CONCEPT_LIMIT) {
            out.push(stub);
            continue;
        }
        const ordered: string[] = [...stub.concepts].sort((a, b) => at(a) - at(b) || stub.concepts.indexOf(a) - stub.concepts.indexOf(b));
        const parts: number = Math.ceil(ordered.length / STEP_CONCEPT_LIMIT);
        const base: number = Math.floor(ordered.length / parts);
        const wider: number = ordered.length % parts;
        const taught: string[] = [];
        for (let index = 0, taken = 0; index < parts; index++) {
            const size: number = base + (index < wider ? 1 : 0);
            const concepts: string[] = ordered.slice(taken, taken + size);
            const assumes: string[] = [];
            appendNew(assumes, stub.assumes);
            appendNew(assumes, taught);
            out.push({ ...stub, part: index + 1, concepts, assumes });
            appendNew(taught, concepts);
            taken += size;
        }
    }
    return out;
}

/**
 * Put the handoff slices back into the finished learner order (epic #457, story #560).
 *
 * Each handoff sits **immediately before the earliest learner slice it unblocks**. Handing a coding
 * agent the whole non-focus half of a roadmap at the start wastes exactly what writing twenty unread
 * lessons wastes, and this is where that waste is removed: nothing is built for the learner until the
 * step that needs it. Several handoffs unblocking one learner slice form one block before it, taken
 * in ascending story number except where one of them blocks another.
 *
 * A handoff that unblocks no learner slice is ordered **after** every learner slice. That is the
 * roadmap whose non-focus work nothing in focus depends on, where the waste this removes is at its
 * largest.
 *
 * Ordering a handoff builds nothing: no handoff prompt is written and no coding-agent session starts.
 */
function placeHandoffs(slices: readonly PlanStub[], order: readonly PlanStub[], direct: Map<number, number[]>): PlanStub[] {
    const handoffs: PlanStub[] = slices
        .filter((stub) => stub.builds === "handoff")
        .sort((a, b) => (a.story as number) - (b.story as number))
        .map((stub) => ({ ...stub, concepts: [], assumes: [] }));
    const handedOff: Set<number> = new Set(handoffs.map((stub) => stub.story as number));

    // Which learner slices each handoff unblocks: the ones it blocks directly, and the ones it
    // reaches through other handoffs. An edge that runs on through a learner slice is that slice's
    // own, and it is already satisfied by the order.
    const unblocks: Map<number, number[]> = new Map(handoffs.map((stub) => [stub.story as number, []]));
    for (const [story, blockers] of direct) {
        const seen: Set<number> = new Set();
        const stack: number[] = blockers.filter((blocker) => handedOff.has(blocker));
        while (stack.length > 0) {
            const next: number = stack.pop() as number;
            if (seen.has(next)) continue;
            seen.add(next);
            if (!handedOff.has(story)) unblocks.set(next, [...(unblocks.get(next) ?? []), story]);
            stack.push(...(direct.get(next) ?? []).filter((blocker) => handedOff.has(blocker)));
        }
    }

    const positionOf: Map<number, number> = new Map();
    order.forEach((stub, index) => {
        if (stub.story !== undefined && !positionOf.has(stub.story)) positionOf.set(stub.story, index);
    });
    const target: Map<number, number> = new Map();
    for (const stub of handoffs) {
        const positions: number[] = (unblocks.get(stub.story as number) ?? []).flatMap((story) => {
            const at: number | undefined = positionOf.get(story);
            return at === undefined ? [] : [at];
        });
        if (positions.length > 0) target.set(stub.story as number, Math.min(...positions));
    }

    /** One block of handoffs, lowest story first, never before a handoff that blocks it. */
    const block = (waiting: PlanStub[]): PlanStub[] => {
        const done: Set<number> = new Set();
        const out: PlanStub[] = [];
        while (waiting.length > out.length) {
            const next: PlanStub =
                waiting.find((stub) => !done.has(stub.story as number) && (direct.get(stub.story as number) ?? []).every((blocker) => !waiting.some((other) => other.story === blocker) || done.has(blocker))) ??
                (waiting.find((stub) => !done.has(stub.story as number)) as PlanStub);
            done.add(next.story as number);
            out.push(next);
        }
        return out;
    };

    const out: PlanStub[] = [];
    order.forEach((stub, index) => {
        out.push(...block(handoffs.filter((handoff) => target.get(handoff.story as number) === index)));
        out.push(stub);
    });
    out.push(...block(handoffs.filter((handoff) => !target.has(handoff.story as number))));
    return out;
}

/**
 * Check the finished plan for gaps (epic #457, story #557).
 *
 * A gap is a bug in the plan, and it is catchable before a word of any lesson is written — which is
 * the whole reason this check runs here rather than at the gate. Every concept a learner slice
 * assumes has to be introduced by an earlier learner slice, or to be something the learner declared
 * they already know, which counts as satisfied rather than missing (invariant 5).
 *
 * Two things are **not** gaps, and the difference is the point:
 *
 * - A concept **no slice of the roadmap introduces** is not faulted (invariant 26). Every roadmap's
 *   first slices stand on background no story teaches and no five-question interview enumerated, so
 *   faulting that would make a realistic roadmap unplannable. Story #559 teaches it with a scaffold.
 * - A concept an **earlier** learner slice introduces is covered, whatever order it arrived in.
 *
 * A gap whose concept only a **handed-off** story would introduce names that story (invariant 32).
 * That is the case where the plan is wrong rather than merely tight: the focus boundary is drawn in
 * the wrong place, and naming the story is what tells the reviewer so, rather than sending them to
 * re-read the concept lists.
 *
 * Every gap is named, never only the first, and the verdict travels with the plan: a gap is
 * diagnosed by reading the plan, so withholding it would force the reviewer to reconstruct from a
 * terminal report the very document that exists to save them that work.
 */
/** The concepts only a handed-off story would introduce. Those are never scaffolded (invariant 27). */
function handoffOnly(slices: readonly PlanStub[], handoffConcepts: ReadonlyMap<number, readonly string[]>): Set<string> {
    const byLearner: Set<string> = new Set(slices.filter((stub) => stub.builds === "learner").flatMap((stub) => stub.concepts));
    return new Set([...handoffConcepts.values()].flat().filter((id) => !byLearner.has(id)));
}

function checkCoverage(slices: readonly PlanStub[], declared: readonly string[], handoffConcepts: ReadonlyMap<number, readonly string[]>): CoverageVerdict {
    const fromHandoff: Map<string, number> = new Map();
    for (const story of [...handoffConcepts.keys()].sort((a, b) => a - b)) {
        for (const id of handoffConcepts.get(story) ?? []) if (!fromHandoff.has(id)) fromHandoff.set(id, story);
    }
    const anywhere: Set<string> = new Set(slices.flatMap((stub) => stub.concepts));
    const satisfied: Set<string> = new Set(declared);
    const gaps: CoverageGap[] = [];

    for (const stub of slices) {
        if (stub.builds !== "learner") continue;
        for (const id of stub.assumes) {
            if (satisfied.has(id)) continue;
            const handedOff: number | undefined = fromHandoff.get(id);
            // A concept nothing on the roadmap introduces is scaffolded, not faulted; one an earlier
            // slice introduced is already satisfied. What is left is a plan that put an introducer
            // out of reach.
            if (handedOff === undefined && !anywhere.has(id)) continue;
            gaps.push(handedOff === undefined ? { concept: id, story: stub.story } : { concept: id, story: stub.story, handedOff });
        }
        for (const id of stub.concepts) satisfied.add(id);
    }
    return { clean: gaps.length === 0, gaps };
}

/**
 * Rewrite a planning pass's draft. The result is a draft of the same shape — the rewrite replaces
 * the draft whole and never edits one in place.
 *
 * The passes run once, in a fixed order, and nothing iterates (record #562): each pass after
 * ordering is built not to disturb the passes before it, and the coverage check runs last, over the
 * finished plan, writing no plan content of its own.
 */
export function rewritePlan(draft: PlanDraft, options: RewriteOptions = {}): PlanDraft {
    const declaredConcepts: string[] = (draft.declared ?? []).map((entry) => entry.concept);
    let slices: PlanStub[];
    if (options.edges === undefined) {
        const owned: Set<string> = new Set();
        slices = draft.slices.map((stub) => assign(stub, owned));
    } else {
        const direct: Map<number, number[]> = blockersWithin(draft.slices, options.edges);
        const blockers: Map<number, number[]> = learnerBlockers(draft.slices, direct);
        const scaffolds: Map<number, string[]> = decideScaffolds(
            draft.slices,
            blockers,
            draft.vocabulary ?? [],
            declaredConcepts,
            handoffOnly(draft.slices, options.handoffConcepts ?? new Map()),
        );
        const order: PlanStub[] = orderLearnerSlices(draft.slices, blockers, scaffolds);
        slices = placeHandoffs(draft.slices, splitOverLimit(order, draft.vocabulary ?? []), direct);
    }
    return { ...draft, slices, coverage: checkCoverage(slices, declaredConcepts, options.handoffConcepts ?? new Map()) };
}
