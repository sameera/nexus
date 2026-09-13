/**
 * Approval (epic #458, decision record #591): the step that turns a clean draft into the committed plan
 * the shipped teaching session reads.
 *
 * Every field of the committed plan has an owner. Approval fills in what the issue graph and the
 * workspace already know — the pinned states, the lesson names, the branches, each slice's epic, the
 * dependency edges and the repository. The reviewer declares the suite and grading commands. The
 * session writes each pinning test when the learner arrives at its slice. A field whose owner has not
 * acted yet is absent, never a placeholder, because the session acts on the value (invariants 26, 27).
 *
 * The plan is built field by field from a fixed list rather than copied from the draft and stripped.
 * A field added to the draft later — or one of the learner's declared phrases, which the draft carries
 * for the gate — has no route into a committed file until someone adds it to this list on purpose
 * (invariant 25). A list fails closed; a strip list fails open, and a leak into a committed file cannot
 * be undone.
 */

import { createHash } from "node:crypto";
import { refuseUncleanCoverage, type CoverageRefusal } from "./plan-approval.js";
import { renderPlanDraft, type PlanDraft, type PlanStub } from "./plan-draft.js";
import { type Roadmap, type RoadmapStory } from "./roadmap.js";
import { type IssueReader, type LiveStory } from "./teaching-plan.js";
import { lessonNameFor, sliceId, type DeclaredCommands, type PlanSliceRecord, type WorkbookPlan } from "./workbook-plan.js";

/**
 * What the gate printed, as one value. Approval refuses a draft whose fingerprint differs from the one
 * recorded when the gate was shown, so what is approved is exactly what the reviewer read (invariant 13).
 */
export function draftFingerprint(draft: PlanDraft): string {
    return createHash("sha256").update(renderPlanDraft(draft)).digest("hex");
}

/**
 * The branch a story is built on: one per story, shared by every part of a split story, and prefixed
 * with the workbook so it cannot collide with the team's own branch for that story. Derived from the
 * story, never from position, so a re-plan cannot move it.
 */
export function branchFor(workbook: string, story: number): string {
    return `${workbook}/story-${story}`;
}

export interface ApprovalInput {
    workbook: string;
    draft: PlanDraft;
    roadmap: Roadmap;
    /** The fingerprint recorded when the gate was last printed, or null when it never was. */
    shown: string | null;
    /** The repository the workspace names, or null when it could not be read. */
    repo: string | null;
    /** Reads one story's live state from the issue graph. */
    read: IssueReader;
    /** The commands the reviewer declared, or null when none were declared. */
    commands: DeclaredCommands | null;
    handoffConcepts?: ReadonlyMap<number, readonly string[]>;
    /** The plan already approved for this workbook, which makes this a re-approval. Null on a first approval. */
    previous?: WorkbookPlan | null;
    /** The lesson files the workbook holds. */
    written?: readonly string[];
    /** Every concept identifier a written lesson carries — what the drill history and the hint log are keyed on. */
    taughtConcepts?: readonly string[];
}

export type Approval = { ok: true; plan: WorkbookPlan } | { ok: false; report: string };

function refused(lead: string, details: readonly string[] = []): Approval {
    return { ok: false, report: [`Approval refused: ${lead}`, ...details, "Nothing in the committed workbook was written."].join("\n") };
}

function normalize(text: string): string {
    return text.trim().replace(/\s+/g, " ");
}

/**
 * Read every story the draft names, once each, and compare it with the text the draft was planned from.
 * A story whose live text differs, or that cannot be read, stops approval: pinning live text the plan
 * was not planned from would approve a plan built on different words (invariant 23).
 */
function readLive(draft: PlanDraft, roadmap: Roadmap, read: IssueReader): { live: Map<number, LiveStory>; problems: string[] } {
    const live: Map<number, LiveStory> = new Map();
    const problems: string[] = [];
    const seen: Set<number> = new Set();
    for (const stub of draft.slices) {
        if (stub.story === undefined || seen.has(stub.story)) continue;
        seen.add(stub.story);
        const planned: RoadmapStory | undefined = roadmap.stories.find((story) => story.number === stub.story);
        const state: LiveStory | null = read(stub.story);
        if (planned === undefined) {
            problems.push(`  #${stub.story} is not on the resolved roadmap the draft was planned from.`);
            continue;
        }
        if (state === null) {
            problems.push(`  #${stub.story} could not be read, so its state at approval is unknown.`);
            continue;
        }
        const moved: string[] = [];
        if (normalize(state.title) !== normalize(planned.title)) moved.push("its title");
        if (normalize(state.body) !== normalize(planned.body)) moved.push("its description");
        if (moved.length > 0) {
            problems.push(`  #${stub.story} differs from the text the draft was planned from: ${moved.join(" and ")} changed.`);
            continue;
        }
        live.set(stub.story, state);
    }
    return { live, problems };
}

/**
 * The slices each slice depends on, by identity (invariant 43). A story slice depends on the last
 * slice of each on-roadmap story blocking it; a later part depends on the part before it instead,
 * because the first part already carries the story's edges; and the slice a scaffold serves — the
 * first slice of the needing story after the scaffold — depends on that scaffold.
 */
export function sliceDependencies(slices: readonly PlanStub[], roadmap: Roadmap): string[][] {
    const last: Map<number, string> = new Map();
    for (const stub of slices) if (stub.story !== undefined) last.set(stub.story, sliceId(stub));
    const edges: string[][] = slices.map((stub) => {
        if (stub.scaffold !== undefined || stub.story === undefined) return [];
        if (stub.part !== undefined && stub.part > 1) return [sliceId({ story: stub.story, part: stub.part - 1 })];
        const blockers: number[] = roadmap.stories.find((story) => story.number === stub.story)?.blockedBy ?? [];
        return blockers.flatMap((blocker) => {
            const id: string | undefined = last.get(blocker);
            return id === undefined ? [] : [id];
        });
    });
    slices.forEach((stub, index) => {
        if (stub.scaffold === undefined) return;
        const served: number = slices.findIndex((other, at) => at > index && other.story === stub.need);
        if (served !== -1 && !edges[served].includes(sliceId(stub))) edges[served].push(sliceId(stub));
    });
    return edges;
}

/** One committed slice, built field by field from the stub, the roadmap and the live state. */
function buildSlice(workbook: string, stub: PlanStub, roadmap: Roadmap, live: ReadonlyMap<number, LiveStory>, dependsOn: string[]): PlanSliceRecord {
    if (stub.scaffold !== undefined) {
        return {
            scaffold: stub.scaffold,
            lesson: lessonNameFor(stub),
            learnerBuilds: true,
            pinned: null,
            concepts: [...stub.concepts],
            branch: "",
            pinningTest: null,
            dependsOn,
        };
    }
    const story: number = stub.story as number;
    const state: LiveStory = live.get(story) as LiveStory;
    const learnerBuilds: boolean = stub.builds === "learner";
    return {
        story,
        ...(stub.part === undefined ? {} : { part: stub.part }),
        epic: (roadmap.stories.find((entry) => entry.number === story) as RoadmapStory).epic,
        lesson: learnerBuilds ? lessonNameFor(stub) : "",
        learnerBuilds,
        pinned: { title: state.title, body: state.body, closed: state.closed },
        concepts: learnerBuilds ? [...stub.concepts] : [],
        branch: branchFor(workbook, story),
        pinningTest: null,
        dependsOn,
    };
}

/**
 * The taught part of an approved plan: every slice up to and including the last one with a written
 * lesson. A re-approval carries it forward unchanged except for its pins (record #591, invariant 35).
 */
export function carriedSlices(plan: WorkbookPlan, written: readonly string[]): PlanSliceRecord[] {
    let last: number = -1;
    plan.slices.forEach((slice, index) => {
        if (slice.lesson !== "" && written.includes(slice.lesson)) last = index;
    });
    return plan.slices.slice(0, last + 1);
}

/**
 * The taught part as the stubs a re-plan's rewrite keeps first. A scaffold's need is the story of the
 * slice that depends on it, or of the next slice that builds a story.
 */
export function carriedStubs(plan: WorkbookPlan, written: readonly string[]): PlanStub[] {
    return carriedSlices(plan, written).map((slice, index): PlanStub => {
        if (slice.scaffold !== undefined) {
            const id: string = sliceId(slice);
            const served: PlanSliceRecord | undefined =
                plan.slices.find((other) => other.dependsOn.includes(id)) ?? plan.slices.slice(index + 1).find((other) => other.story !== undefined);
            return { scaffold: slice.scaffold, need: served?.story ?? 0, builds: "learner", concepts: [slice.scaffold], assumes: [] };
        }
        return {
            story: slice.story,
            ...(slice.part === undefined ? {} : { part: slice.part }),
            builds: slice.learnerBuilds ? "learner" : "handoff",
            concepts: slice.learnerBuilds ? [...slice.concepts] : [],
            assumes: [],
        };
    });
}

/**
 * What stops a re-approval before anything is read from the graph: a draft not planned over the taught
 * part, or one whose vocabulary no longer holds an identifier a written lesson carries. Re-planning can
 * rename an identifier through the merge, and the drill history and the hint log are keyed on it
 * (invariant 38).
 */
function refuseReplan(draft: PlanDraft, carried: readonly PlanSliceRecord[], taughtConcepts: readonly string[]): Approval | null {
    const prefix: PlanStub[] = draft.slices.slice(0, carried.length);
    const matches: boolean = carried.every((slice, index) => {
        const stub: PlanStub | undefined = prefix[index];
        return stub !== undefined && sliceId(stub) === sliceId(slice) && stub.concepts.join(",") === (slice.learnerBuilds ? slice.concepts : []).join(",");
    });
    if (!matches) {
        return refused(
            `the draft was not planned over the part of the plan already taught (${carried.map((slice) => sliceId(slice)).join(", ")}). ` +
            "Run the rewrite again, which keeps that part first and unchanged.",
        );
    }
    if (draft.vocabulary === undefined) return null;
    const vocabulary = draft.vocabulary;
    const lost: string[] = [...new Set(taughtConcepts)].flatMap((concept) => {
        if (vocabulary.some((entry) => entry.id === concept)) return [];
        const into: string | undefined = vocabulary.find((entry) => entry.aliases.includes(concept))?.id;
        return [into === undefined ? `  ${concept} is no longer in the merged vocabulary.` : `  ${concept} was renamed to ${into}.`];
    });
    if (lost.length === 0) return null;
    return refused("the re-planned draft drops or renames a concept identifier a written lesson carries. Merge the vocabulary so it keeps each one.", lost);
}

/**
 * Approve a draft. It runs the coverage refusal again rather than trusting that the gate was shown,
 * refuses a draft that changed since it was shown, refuses without declared commands, reads every
 * story's live state, and only then builds the plan. It writes nothing: the caller writes the plan and
 * its pages together once this has returned one.
 */
export function approvePlan(input: ApprovalInput): Approval {
    const { draft, roadmap } = input;
    const coverage: CoverageRefusal = refuseUncleanCoverage(draft, input.handoffConcepts);
    if (coverage.refused) return { ok: false, report: coverage.report };

    if (input.shown === null) {
        return refused("the gate was never shown for this draft, so nothing records what the reviewer approved. Print the gate first.");
    }
    if (input.shown !== draftFingerprint(draft)) {
        return refused("the draft changed after the gate was shown, so it is not the plan the reviewer read. Print the gate again.");
    }
    const previous: WorkbookPlan | null = input.previous ?? null;
    const carried: PlanSliceRecord[] = previous === null ? [] : carriedSlices(previous, input.written ?? []);
    if (previous !== null && input.commands !== null) {
        return refused("a re-approval reuses the suite and grading commands the committed plan declares, so none are declared again.");
    }
    const commands: DeclaredCommands | null = previous === null ? input.commands : { suite: previous.suite, grading: previous.grading, probeControl: previous.probeControl };
    if (commands === null) {
        return refused(
            "no suite and grading commands are declared. The reviewer declares both as argument lists with --commands <file>; " +
            "nothing here infers a command, because a green light is worth exactly as much as the command behind it.",
        );
    }
    if (input.repo === null || input.repo.trim() === "") {
        return refused("the repository could not be read from the workspace, and a handoff prompt has to name it.");
    }

    if (previous !== null) {
        const replan: Approval | null = refuseReplan(draft, carried, input.taughtConcepts ?? []);
        if (replan !== null) return replan;
    }

    const { live, problems } = readLive(draft, roadmap, input.read);
    if (problems.length > 0) {
        return refused("the issue graph has moved since the draft was planned, or could not be read. Re-plan the roadmap, then approve again.", problems);
    }

    const edges: string[][] = sliceDependencies(draft.slices, roadmap);
    return {
        ok: true,
        plan: {
            repo: input.repo.trim(),
            epic: null,
            suite: [...commands.suite],
            grading: [...commands.grading],
            probeControl: commands.probeControl === null ? null : { ...commands.probeControl },
            // A taught slice is carried forward exactly as it was approved; only its pin is refreshed.
            // A later slice is rebuilt, but a pinning test a handoff already wrote for it stays: the
            // return probe fenced with that text, so the lesson must show the same one (invariant 29).
            slices: draft.slices.map((stub, index) => {
                const built: PlanSliceRecord = buildSlice(input.workbook, stub, roadmap, live, edges[index]);
                if (index < carried.length) return { ...carried[index], pinned: built.pinned, dependsOn: edges[index] };
                const written: PlanSliceRecord | undefined = previous?.slices.find((slice) => sliceId(slice) === sliceId(built));
                return written?.pinningTest ? { ...built, pinningTest: { ...written.pinningTest } } : built;
            }),
        },
    };
}
