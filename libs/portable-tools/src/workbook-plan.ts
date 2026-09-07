/**
 * The plan a workbook teaches from (epic #407, decision record #469).
 *
 * One file describes the whole plan: the order, the story each slice builds, its learner-or-handoff
 * mark, the state that story was pinned to when the plan was approved, and the concepts it teaches.
 * Two committed documents describing one plan can disagree with nothing in a position to notice,
 * so the pinned state lives beside the order rather than in a file of its own.
 *
 * The plan is also where the workbook declares the commands that run its test suite and grade one
 * exercise, and — optionally — the control test that proves the grading command can run a single
 * file on its own, so that a probe which cannot run is never read as a fence that held. Nothing
 * infers those commands: a green light is worth exactly as much as the command behind it, and an inferred
 * command that happens to run a subset makes the suite gate decorative while still looking like a
 * gate (record #469, "the workbook declares the command that runs the suite").
 *
 * A slice whose lesson has not been written yet is a stub — the normal state under just-in-time
 * writing — so this module reads the plan and says which slices are stubs, and the renderer shows
 * them as not yet written rather than as a link to a page (invariants 1, 2).
 */

import { parse } from "yaml";
import { type TeachingPlan } from "./teaching-plan.js";

/** The file a workbook declares its plan in, beside the lessons it orders. */
export const PLAN_FILENAME: string = "plan.yml";

/** The pinning test a slice's exercise names, held once so the lesson and the probe share one text. */
export interface PinningTest {
    /** The file name the learner writes the test into, also the probe's name for it. */
    file: string;
    /** The test's own text, verbatim. */
    text: string;
}

/** One step of the plan: the story it builds, and everything the session needs to teach it. */
export interface PlanSliceRecord {
    story: number;
    /**
     * The lesson file this slice teaches into, or "" for a handoff slice, which is neither built
     * nor taught by the learner and so never becomes a page. Named but absent from the folder means
     * the slice is a stub — the normal state before the learner arrives at it.
     */
    lesson: string;
    /** True when the learner builds this slice; false when it is handed to a coding agent. */
    learnerBuilds: boolean;
    /** The state the story was pinned to when the plan was approved. */
    pinned: { title: string; body: string };
    /** The concepts this slice teaches, in the identifiers the drill and the hint log share. */
    concepts: string[];
    /** The branch the learner builds this slice on. The session names it and never switches to it. */
    branch: string;
    pinningTest: PinningTest;
}

export interface WorkbookPlan {
    /** The repository the plan teaches, named in a handoff prompt. Required, as the prompt states it. */
    repo: string;
    /** The epic the slices belong to, named in a handoff prompt. Required, for the same reason. */
    epic: number;
    /** The declared suite command, as an argument vector — never a shell string (invariant 14). */
    suite: string[];
    /** The declared command that grades one exercise, and that the fence probe runs. */
    grading: string[];
    /**
     * A test written to pass in this repository's stack, run to prove the grading command can run
     * one file on its own. Null when the workbook declares none, which leaves the probe unproven
     * rather than unrunnable (record #469's fifth ADDRESS risk).
     */
    probeControl: PinningTest | null;
    slices: PlanSliceRecord[];
}

/** Raised instead of teaching from a plan that does not say what it must. */
export class PlanError extends Error {
    constructor(detail: string) {
        super(`${PLAN_FILENAME}: ${detail}`);
        this.name = "PlanError";
    }
}

function asRecord(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function commandVector(value: unknown, field: string): string[] {
    if (!Array.isArray(value) || value.length === 0 || value.some((part) => String(part).trim() === "")) {
        throw new PlanError(
            `declares no '${field}' command. A workbook states the command it runs as a list of ` +
            `arguments, because nothing here infers one and nothing here builds a shell string.`,
        );
    }
    return value.map((part) => String(part));
}

function text(value: unknown, field: string, where: string): string {
    const asText: string = typeof value === "string" ? value : "";
    if (asText.trim() === "") throw new PlanError(`${where} declares no '${field}'.`);
    return asText;
}

function readSlice(raw: unknown, index: number): PlanSliceRecord {
    const where: string = `slice ${index + 1}`;
    const record: Record<string, unknown> = asRecord(raw);

    const story: number = Number(record["story"]);
    if (!Number.isInteger(story) || story <= 0) {
        throw new PlanError(`${where} names no 'story'. A slice is one story's step, so a slice without one is not a slice.`);
    }

    const mark: unknown = record["builds"];
    if (mark !== "learner" && mark !== "handoff") {
        throw new PlanError(
            `${where} (story #${story}) is marked '${String(mark)}'. A slice is built by the 'learner' ` +
            `or is a 'handoff' to a separate coding agent, and the session teaches the two differently.`,
        );
    }

    const pinned: Record<string, unknown> = asRecord(record["pinned"]);
    const probe: Record<string, unknown> = asRecord(record["pinning_test"]);
    const concepts: unknown = record["concepts"];

    const learnerBuilds: boolean = mark === "learner";
    return {
        story,
        lesson: learnerBuilds ? text(record["lesson"], "lesson", `${where} (story #${story})`) : String(record["lesson"] ?? ""),
        learnerBuilds,
        pinned: {
            title: text(pinned["title"], "pinned.title", `${where} (story #${story})`),
            body: text(pinned["body"], "pinned.body", `${where} (story #${story})`),
        },
        concepts: Array.isArray(concepts) ? concepts.map((c) => String(c)) : [],
        branch: text(record["branch"], "branch", `${where} (story #${story})`),
        pinningTest: {
            file: text(probe["file"], "pinning_test.file", `${where} (story #${story})`),
            text: text(probe["text"], "pinning_test.text", `${where} (story #${story})`),
        },
    };
}

/**
 * Read the optional control test. A workbook that declares none leaves it null; one that declares
 * half of it is refused, because a control missing its text would prove nothing while looking like
 * a proof.
 */
function readProbeControl(raw: unknown): PinningTest | null {
    if (raw === undefined || raw === null) return null;
    const record: Record<string, unknown> = asRecord(raw);
    return {
        file: text(record["file"], "probe_control.file", "the plan"),
        text: text(record["text"], "probe_control.text", "the plan"),
    };
}

/** Read one workbook's plan from the text of its plan file. Pure: it parses or it throws. */
export function parsePlan(source: string): WorkbookPlan {
    let doc: unknown;
    try {
        doc = parse(source);
    } catch (e) {
        throw new PlanError(`is not readable — ${e instanceof Error ? e.message : String(e)}`);
    }
    const record: Record<string, unknown> = asRecord(doc);
    const slices: unknown = record["slices"];
    if (!Array.isArray(slices) || slices.length === 0) {
        throw new PlanError("declares no 'slices' list, so the workbook has no plan to teach from.");
    }
    const read: PlanSliceRecord[] = slices.map(readSlice);

    const seen: Map<string, number> = new Map();
    for (const slice of read) {
        if (slice.lesson === "") continue;
        const first: number | undefined = seen.get(slice.lesson);
        if (first !== undefined) {
            throw new PlanError(
                `slices for #${first} and #${slice.story} both teach into ${slice.lesson}. ` +
                `One lesson is one slice's arrival, so the second would overwrite the first.`,
            );
        }
        seen.set(slice.lesson, slice.story);
    }

    const epic: number = Number(record["epic"]);
    if (!Number.isInteger(epic) || epic <= 0) {
        throw new PlanError(
            `names no 'epic' issue number. A handoff prompt states the epic the slice belongs to, ` +
            `so a plan without one would hand a coding agent a prompt reading 'Epic: #0'.`,
        );
    }

    return {
        repo: text(record["repo"], "repo", "the plan"),
        epic,
        suite: commandVector(record["suite"], "suite"),
        grading: commandVector(record["grading"], "grading"),
        probeControl: readProbeControl(record["probe_control"]),
        slices: read,
    };
}

/** The pinned state the drift check compares against, in plan order. */
export function toTeachingPlan(plan: WorkbookPlan): TeachingPlan {
    return {
        slices: plan.slices.map((slice) => ({
            story: slice.story,
            learnerBuilds: slice.learnerBuilds,
            pinned: { title: slice.pinned.title, body: slice.pinned.body },
        })),
    };
}

/** Every slice the lessons folder holds no lesson for — the stubs, in plan order. */
export function planStubs(plan: WorkbookPlan, written: readonly string[]): { story: number; lesson: string }[] {
    return plan.slices
        .filter((slice) => slice.lesson !== "" && !written.includes(slice.lesson))
        .map((slice) => ({ story: slice.story, lesson: slice.lesson }));
}
