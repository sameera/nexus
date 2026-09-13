// @vitest-environment jsdom
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { writePlanDraft, readPlanDraft, type PlanDraft, type PlanStub } from "./plan-draft.js";
import { ROADMAP, approve, committedPlan, gate, io, planned, teach, type Planned } from "./plan-commit-fixtures.js";
import { rewritePlan } from "./plan-rewrite.js";
import { writeRoadmap, type Roadmap } from "./roadmap.js";
import { type SessionResult } from "./teaching-session.js";
import { runWorkbookCli } from "./workbook-cli.js";
import { PLAN_FILENAME, type WorkbookPlan } from "./workbook-plan.js";
import { lessonsDir, workbookRoot } from "./workbook-store.js";

function learner(story: number, concepts: string[], assumes: string[] = [], part?: number): PlanStub {
    return { story, builds: "learner", ...(part === undefined ? {} : { part }), concepts, assumes };
}

function handoff(story: number): PlanStub {
    return { story, builds: "handoff", concepts: [], assumes: [] };
}

/** What the planning pass writes before the rewrite: one stub per story, in no particular order. */
const STUBS: PlanStub[] = [learner(11, ["pinned-state"]), learner(12, ["drift"], ["pinned-state"]), handoff(21)];

const CHANGED: Roadmap = {
    ...ROADMAP,
    stories: ROADMAP.stories.map((story) => (story.number === 12 ? { ...story, body: "Compare the pinned state with the live one, field by field." } : story)),
};

function planText(p: Planned): string {
    return fs.readFileSync(path.join(workbookRoot(p.repo, "alpha"), PLAN_FILENAME), "utf8");
}

function lessonText(p: Planned, lesson: string): string {
    return fs.readFileSync(path.join(lessonsDir(p.repo, "alpha"), lesson), "utf8");
}

/** Approve the plan, teach and finish #11, then change #12 on the issue graph so the next session stops on drift. */
function taughtThenDrifted(): Planned {
    const p: Planned = planned(rewritePlan({ slices: STUBS }, { edges: ROADMAP.stories.map((s) => ({ story: s.number, blockedBy: s.blockedBy })) }));
    expect(approve(p).code).toBe(0);
    const briefed: SessionResult = teach(p);
    const slice: string = briefed.outcome.kind === "brief" ? (briefed.outcome.brief.writeTest?.slice as string) : "";
    expect(teach(p, { theory: "Pins.", pinningTests: [{ slice, file: "tests/pin.spec.ts", text: "it('pins #11', () => {});\n" }] }).outcome.kind).toBe("written");
    fs.mkdirSync(path.join(p.repo, "tests"), { recursive: true });
    fs.writeFileSync(path.join(p.repo, "tests", "pin.spec.ts"), "it('pins #11', () => {});\n");
    p.fake.live[12] = { title: "Report drift", body: CHANGED.stories[1].body, closed: false };
    expect(teach(p).outcome.kind).toBe("drift");
    return p;
}

/** Run the planning chain again over the changed roadmap, as far as a rewritten draft. */
function replan(p: Planned, stubs: PlanStub[] = STUBS): void {
    writeRoadmap(p.repo, CHANGED);
    writePlanDraft(p.repo, "alpha", { slices: stubs });
    const captured = io(p.repo);
    expect(runWorkbookCli(["rewrite", "alpha", "--root", p.repo], captured, p.run)).toBe(0);
}

function reapprove(p: Planned): { code: number; err: string } {
    expect(gate(p).code).toBe(0);
    const { code, captured } = gate(p, "--approve");
    return { code, err: captured.err.join("\n") };
}

describe("a plan re-approved after drift keeps the lessons already written (story #588)", () => {
    it("pins the changed story to its current state, and the next session teaches it", () => {
        const p: Planned = taughtThenDrifted();
        replan(p);

        const { code, err } = reapprove(p);

        expect(err).toBe("");
        expect(code).toBe(0);
        const plan: WorkbookPlan = committedPlan(p);
        expect(plan.slices.find((slice) => slice.story === 12)?.pinned?.body).toBe(CHANGED.stories[1].body);
        const next: SessionResult = teach(p);
        expect(next.outcome.kind === "brief" && next.outcome.brief.story).toBe(12);
    });

    it("keeps every lesson written before the re-approval byte for byte, and does not teach it again", () => {
        const p: Planned = taughtThenDrifted();
        const before: WorkbookPlan = committedPlan(p);
        const lesson: string = before.slices[0].lesson;
        const written: string = lessonText(p, lesson);
        replan(p);

        reapprove(p);

        const after: WorkbookPlan = committedPlan(p);
        expect(after.slices[0]).toEqual(before.slices[0]);
        expect(fs.readdirSync(lessonsDir(p.repo, "alpha"))).toEqual([lesson]);
        expect(lessonText(p, lesson)).toBe(written);
        expect(after.suite).toEqual(before.suite);
    });

    it("refuses a re-planned draft whose coverage is not clean, and leaves the approved plan and its lessons unchanged", () => {
        const p: Planned = taughtThenDrifted();
        replan(p);
        expect(gate(p).code).toBe(0);
        const plan: string = planText(p);
        const draft: PlanDraft = readPlanDraft(p.repo, "alpha") as PlanDraft;
        writePlanDraft(p.repo, "alpha", { ...draft, coverage: { clean: false, gaps: [{ concept: "drift", story: 12 }] } });

        const { code, captured } = gate(p, "--approve");

        expect(code).toBe(1);
        expect(captured.err.join("\n")).toMatch(/refused/);
        expect(planText(p)).toBe(plan);
        expect(fs.readdirSync(lessonsDir(p.repo, "alpha"))).toHaveLength(1);
    });

    it("refuses a re-planned draft that renames a concept identifier a written lesson carries", () => {
        const p: Planned = taughtThenDrifted();
        replan(p);
        const draft: PlanDraft = readPlanDraft(p.repo, "alpha") as PlanDraft;
        const plan: string = planText(p);
        writePlanDraft(p.repo, "alpha", { ...draft, vocabulary: [{ id: "pin-snapshot", gloss: "the state a story had at approval", aliases: ["pinned-state"] }] });

        const { code, err } = reapprove(p);

        expect(code).toBe(1);
        expect(err).toMatch(/pinned-state/);
        expect(planText(p)).toBe(plan);
    });

    it("refuses a re-planned draft that was not planned over the part of the plan already taught", () => {
        const p: Planned = taughtThenDrifted();
        writeRoadmap(p.repo, CHANGED);
        writePlanDraft(p.repo, "alpha", { slices: [learner(12, ["drift"]), learner(11, ["pinned-state"]), handoff(21)], coverage: { clean: true, gaps: [] } });
        const plan: string = planText(p);

        const { code, err } = reapprove(p);

        expect(code).toBe(1);
        expect(err).toMatch(/taught/);
        expect(planText(p)).toBe(plan);
    });

    it("keeps a pinning test a handoff already wrote for a slice past the taught part, so the probe and the lesson share one text", () => {
        const stubs: PlanStub[] = [learner(11, ["pinned-state"]), handoff(12), learner(21, ["handoff-prompt"], ["pinned-state"])];
        const p: Planned = planned({ slices: stubs, coverage: { clean: true, gaps: [] } });
        expect(approve(p).code).toBe(0);
        const briefed: SessionResult = teach(p);
        const slice: string = briefed.outcome.kind === "brief" ? (briefed.outcome.brief.writeTest?.slice as string) : "";
        expect(teach(p, { theory: "Pins.", pinningTests: [{ slice, file: "tests/pin.spec.ts", text: "it('pins #11', () => {});\n" }] }).outcome.kind).toBe("written");
        fs.mkdirSync(path.join(p.repo, "tests"), { recursive: true });
        fs.writeFileSync(path.join(p.repo, "tests", "pin.spec.ts"), "it('pins #11', () => {});\n");
        const asked: SessionResult = teach(p);
        if (asked.outcome.kind !== "tests") throw new Error(`expected a request for tests, got ${asked.outcome.kind}`);
        const pinningTests = asked.outcome.requests.map((request) => ({ slice: request.slice, file: `tests/${request.slice}.spec.ts`, text: `it('pins #${request.story}', () => {});\n` }));
        expect(teach(p, { theory: "", pinningTests }).outcome.kind).toBe("handoff");
        const before: WorkbookPlan = committedPlan(p);
        const changed: Roadmap = { ...ROADMAP, stories: ROADMAP.stories.map((story) => (story.number === 21 ? { ...story, body: "Write the prompt, and name the branch." } : story)) };
        p.fake.live[21] = { title: "Hand a story off", body: "Write the prompt, and name the branch.", closed: false };
        writeRoadmap(p.repo, changed);
        writePlanDraft(p.repo, "alpha", { slices: stubs, coverage: { clean: true, gaps: [] } });

        const { code, err } = reapprove(p);

        expect(err).toBe("");
        expect(code).toBe(0);
        const after: WorkbookPlan = committedPlan(p);
        expect(after.slices.find((each) => each.story === 21)?.pinned?.body).toBe("Write the prompt, and name the branch.");
        expect(after.slices.map((each) => each.pinningTest)).toEqual(before.slices.map((each) => each.pinningTest));
    });

    it("reuses the committed plan's commands, and refuses a second declaration of them", () => {
        const p: Planned = taughtThenDrifted();
        replan(p);
        expect(gate(p).code).toBe(0);

        const { code, captured } = gate(p, "--approve", "--commands", p.commands);

        expect(code).toBe(1);
        expect(captured.err.join("\n")).toMatch(/reuses/);
    });
});

describe("the rewrite plans only the part of an approved plan not yet taught", () => {
    const edges = [
        { story: 11, blockedBy: [] },
        { story: 12, blockedBy: [11] },
    ];

    it("keeps the taught slices first and unchanged, and introduces none of their concepts again", () => {
        const carried: PlanStub[] = [learner(11, ["alpha"])];

        const plan: PlanDraft = rewritePlan({ slices: [learner(12, ["alpha", "beta"]), learner(11, ["alpha"])] }, { edges, carried });

        expect(plan.slices[0]).toEqual(carried[0]);
        expect(plan.slices[1].concepts).toEqual(["beta"]);
        expect(plan.slices[1].assumes).toContain("alpha");
        expect(plan.coverage?.clean).toBe(true);
    });

    it("continues a split story from the part after the last one taught", () => {
        const carried: PlanStub[] = [learner(11, ["a", "b", "c"], [], 1)];

        const plan: PlanDraft = rewritePlan({ slices: [learner(11, ["a", "b", "c", "d", "e"]), learner(12, ["f"], ["a"])] }, { edges, carried });

        expect(plan.slices.map((stub) => [stub.story, stub.part])).toEqual([[11, 1], [11, 2], [12, undefined]]);
        expect(plan.slices[1].concepts).toEqual(["d", "e"]);
    });

    it("writes the same draft when it is rewritten again over its own output", () => {
        const carried: PlanStub[] = [learner(11, ["alpha"])];
        const once: PlanDraft = rewritePlan({ slices: [learner(11, ["alpha"]), learner(12, ["alpha", "beta"])] }, { edges, carried });

        expect(rewritePlan(once, { edges, carried })).toEqual(once);
    });
});
