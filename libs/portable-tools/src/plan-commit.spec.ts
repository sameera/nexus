// @vitest-environment jsdom
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type RunResult, type Runner, defaultRunner } from "@nexus/workspace/run";
import { recordInterview } from "./interview.js";
import { LEARNER_IGNORE_RULE } from "./learner-store.js";
import { planDraftPath, readPlanDraft, writePlanDraft, type PlanDraft } from "./plan-draft.js";
import { writeRoadmap, type Roadmap } from "./roadmap.js";
import { type LiveStory } from "./teaching-plan.js";
import { runTeachingSession, type SessionResult } from "./teaching-session.js";
import { runWorkbookCli, type WorkbookCliIo } from "./workbook-cli.js";
import { PLAN_FILENAME, parsePlan, type WorkbookPlan } from "./workbook-plan.js";
import { createWorkbook, lessonsDir, readWorkbookPlan, workbookRoot } from "./workbook-store.js";

let tmpDirs: string[] = [];
afterEach(() => {
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs = [];
});

function initRepo(): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "plan-commit-"));
    tmpDirs.push(dir);
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
    fs.writeFileSync(path.join(dir, ".gitignore"), `${LEARNER_IGNORE_RULE}\n.nexus/tmp/\n`);
    return dir;
}

interface Captured extends WorkbookCliIo {
    out: string[];
    err: string[];
}
function io(cwd: string): Captured {
    const out: string[] = [];
    const err: string[] = [];
    return { cwd, out, err, stdout: (l) => out.push(l), stderr: (l) => err.push(l) };
}

/** A roadmap spanning two epics: #11 and #12 belong to #100, #21 to #200. */
const ROADMAP: Roadmap = {
    name: "alpha",
    epics: [100, 200],
    stories: [
        { number: 11, title: "Pin the plan", body: "Record the state a story had at approval.", epic: 100, blockedBy: [], external: [] },
        { number: 12, title: "Report drift", body: "Compare the pinned state with the live one.", epic: 100, blockedBy: [11], external: [] },
        { number: 21, title: "Hand a story off", body: "Write the prompt a coding agent runs.", epic: 200, blockedBy: [12], external: [] },
    ],
};

/** A clean draft with a scaffold, a split story and a handoff — every slice shape approval has to fill in. */
const DRAFT: PlanDraft = {
    slices: [
        { story: 11, builds: "learner", concepts: ["pinned-state"], assumes: [] },
        { scaffold: "issue-graph", need: 12, builds: "learner", concepts: ["issue-graph"], assumes: [] },
        { story: 12, part: 1, builds: "learner", concepts: ["drift"], assumes: ["pinned-state", "issue-graph"] },
        { story: 12, part: 2, builds: "learner", concepts: ["drift-report"], assumes: ["drift"] },
        { story: 21, builds: "handoff", concepts: [], assumes: [] },
    ],
    declared: [{ concept: "unit-test", phrase: "I write vitest suites every day at my job" }],
    unmatched: ["my kubernetes cluster at home"],
    coverage: { clean: true, gaps: [] },
};

const COMMANDS: string = ["suite: [fake-suite, --all]", "grading: [fake-grade]", ""].join("\n");

interface Fake {
    live: Record<number, LiveStory | null>;
    calls: string[][];
}

function liveFromRoadmap(roadmap: Roadmap = ROADMAP): Record<number, LiveStory | null> {
    return Object.fromEntries(roadmap.stories.map((story) => [story.number, { title: story.title, body: story.body, closed: false }]));
}

/** `gh` answers from the fake issue graph; the suite passes; everything else runs for real. */
function ghRunner(fake: Fake): Runner {
    return (cmd, args, opts): RunResult => {
        fake.calls.push([cmd, ...args]);
        if (cmd === "gh" && args[0] === "repo") return { status: 0, stdout: "acme/widgets\n", stderr: "" };
        if (cmd === "gh" && args[0] === "issue" && args[1] === "view") {
            const live: LiveStory | null | undefined = fake.live[Number(args[2])];
            if (live === null || live === undefined) return { status: 1, stdout: "", stderr: "not found" };
            return { status: 0, stdout: JSON.stringify({ title: live.title, body: live.body, closedAt: live.closed ? "2026-09-01T00:00:00Z" : null }), stderr: "" };
        }
        if (cmd === "fake-suite") return { status: 0, stdout: "", stderr: "" };
        if (cmd === "fake-grade") return { status: 1, stdout: "", stderr: "" };
        return defaultRunner(cmd, args, opts);
    };
}

interface Planned {
    repo: string;
    fake: Fake;
    run: Runner;
    commands: string;
}

/** Everything the planning chain leaves behind by the time the gate is reached. */
function planned(draft: PlanDraft = DRAFT): Planned {
    const repo: string = initRepo();
    const fake: Fake = { live: liveFromRoadmap(), calls: [] };
    const run: Runner = ghRunner(fake);
    createWorkbook(repo, "alpha", run);
    writeRoadmap(repo, ROADMAP);
    recordInterview(
        repo,
        ROADMAP,
        [
            { slot: "testing-practice", question: "How do you test?", answer: "I write vitest suites every day at my job" },
            { slot: "recent-difficulty", question: "What was hard lately?", answer: "untangling a flaky retry loop" },
        ],
        run,
    );
    writePlanDraft(repo, "alpha", draft);
    const commands: string = path.join(repo, "commands.yml");
    fs.writeFileSync(commands, COMMANDS);
    return { repo, fake, run, commands };
}

function gate(p: Planned, ...extra: string[]): { code: number; captured: Captured } {
    const captured: Captured = io(p.repo);
    const code: number = runWorkbookCli(["gate", "alpha", "--root", p.repo, ...extra], captured, p.run);
    return { code, captured };
}

function approve(p: Planned): { code: number; captured: Captured } {
    expect(gate(p).code).toBe(0);
    return gate(p, "--approve", "--commands", p.commands);
}

function committedPlan(p: Planned): WorkbookPlan {
    return readWorkbookPlan(p.repo, "alpha") as WorkbookPlan;
}

/** Every file under the committed workbook, the learner folder excepted. */
function committedText(repo: string): string {
    const root: string = path.join(repo, ".nexus", "workbook");
    const texts: string[] = [];
    const walk = (dir: string): void => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.name === ".learner") continue;
            const full: string = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else texts.push(fs.readFileSync(full, "utf8"));
        }
    };
    walk(root);
    return texts.join("\n");
}

describe("approval writes a committed plan the shipped teaching session reads (story #587)", () => {
    it("writes a plan whose every slice the shipped plan reader accepts", () => {
        const p: Planned = planned();

        const { code, captured } = approve(p);

        expect(captured.err).toEqual([]);
        expect(code).toBe(0);
        const text: string = fs.readFileSync(path.join(workbookRoot(p.repo, "alpha"), PLAN_FILENAME), "utf8");
        expect(parsePlan(text).slices).toHaveLength(DRAFT.slices.length);
    });

    it("fills every field the session acts on from the graph and the workspace, and no placeholder", () => {
        const p: Planned = planned();
        approve(p);

        const plan: WorkbookPlan = committedPlan(p);
        expect(plan.repo).toBe("acme/widgets");
        expect(plan.suite).toEqual(["fake-suite", "--all"]);
        expect(plan.grading).toEqual(["fake-grade"]);
        const [first, scaffold, partOne, partTwo, handedOff] = plan.slices;
        expect(first.epic).toBe(100);
        expect(handedOff.epic).toBe(200);
        expect(partOne.branch).toBe(partTwo.branch);
        expect(partOne.branch).toMatch(/alpha/);
        expect(first.branch).not.toBe(partOne.branch);
        expect(scaffold.branch).toBe("");
        expect(new Set(plan.slices.map((slice) => slice.lesson).filter((lesson) => lesson !== "")).size).toBe(4);
        expect(handedOff.lesson).toBe("");
        expect(plan.slices.every((slice) => slice.pinningTest === null)).toBe(true);
    });

    it("records the dependency edges between slices: the story edges, part to part, and scaffold to the slice it serves", () => {
        const p: Planned = planned();
        approve(p);

        const plan: WorkbookPlan = committedPlan(p);
        const id = (index: number): string => plan.slices[index].lesson.replace(/\.md$/, "") || "story-21";
        expect(plan.slices[2].dependsOn).toEqual(expect.arrayContaining([id(0), id(1)]));
        expect(plan.slices[3].dependsOn).toEqual([id(2)]);
        expect(plan.slices[4].dependsOn).toEqual([id(3)]);
        expect(plan.slices[0].dependsOn).toEqual([]);
    });

    it("teaches from the approved plan at once, writing a slice's pinning test when the learner arrives at it", () => {
        const p: Planned = planned();
        approve(p);
        const session = (prose?: Parameters<typeof runTeachingSession>[0]["prose"]): SessionResult =>
            runTeachingSession({ repoRoot: p.repo, slug: "alpha", read: (story) => p.fake.live[story] ?? null, run: p.run, prose, now: () => "2026-09-13T00:00:00.000Z" });

        const briefed: SessionResult = session();
        if (briefed.outcome.kind !== "brief") throw new Error(`expected a brief, got ${briefed.outcome.kind}: ${briefed.outcome.report}`);
        expect(briefed.outcome.brief.writeTest?.story).toBe(11);
        expect(committedPlan(p).slices[0].pinningTest).toBeNull();

        const written: SessionResult = session({
            theory: "Pinning records what a story said.",
            pinningTests: [{ slice: briefed.outcome.brief.writeTest?.slice as string, file: "tests/pin.spec.ts", text: "it('pins #11', () => {});\n" }],
        });

        expect(written.outcome.kind).toBe("written");
        expect(committedPlan(p).slices[0].pinningTest).toEqual({ file: "tests/pin.spec.ts", text: "it('pins #11', () => {});\n" });
        expect(fs.readFileSync(path.join(lessonsDir(p.repo, "alpha"), committedPlan(p).slices[0].lesson), "utf8")).toContain("it('pins #11', () => {});");
    });

    it("refuses to write the lesson for a slice whose pinning test the prose does not carry, and records nothing", () => {
        const p: Planned = planned();
        approve(p);

        expect(() => runTeachingSession({ repoRoot: p.repo, slug: "alpha", read: (story) => p.fake.live[story] ?? null, run: p.run, prose: { theory: "Theory." } })).toThrow(/pinning test/);
        expect(committedPlan(p).slices[0].pinningTest).toBeNull();
        expect(fs.readdirSync(lessonsDir(p.repo, "alpha"))).toEqual([]);
    });

    it("writes the handed-off slice's test and the next story slice's test before it writes a handoff prompt", () => {
        const draft: PlanDraft = {
            slices: [
                { story: 11, builds: "handoff", concepts: [], assumes: [] },
                { story: 12, builds: "learner", concepts: ["drift"], assumes: [] },
            ],
            coverage: { clean: true, gaps: [] },
        };
        const p: Planned = planned(draft);
        approve(p);
        const session = (prose?: Parameters<typeof runTeachingSession>[0]["prose"]): SessionResult =>
            runTeachingSession({ repoRoot: p.repo, slug: "alpha", read: (story) => p.fake.live[story] ?? null, run: p.run, prose, now: () => "2026-09-13T00:00:00.000Z" });

        const asked: SessionResult = session();
        if (asked.outcome.kind !== "tests") throw new Error(`expected a request for tests, got ${asked.outcome.kind}`);
        expect(asked.outcome.requests.map((request) => request.story)).toEqual([11, 12]);

        const paused: SessionResult = session({
            theory: "",
            pinningTests: asked.outcome.requests.map((request) => ({ slice: request.slice, file: `tests/${request.slice}.spec.ts`, text: `it('pins #${request.story}', () => {});\n` })),
        });

        expect(paused.outcome.kind).toBe("handoff");
        expect(committedPlan(p).slices.map((slice) => slice.pinningTest?.file)).toEqual(["tests/story-11.spec.ts", "tests/story-12.spec.ts"]);
    });

    it("pins every story to its state on the issue graph at the moment of approval, closure included", () => {
        const p: Planned = planned();
        p.fake.live[11] = { ...(p.fake.live[11] as LiveStory), closed: true };

        expect(approve(p).code).toBe(0);

        const plan: WorkbookPlan = committedPlan(p);
        expect(plan.slices[0].pinned).toEqual({ title: "Pin the plan", body: "Record the state a story had at approval.", closed: true });
        expect(plan.slices[4].pinned).toEqual({ title: "Hand a story off", body: "Write the prompt a coding agent runs.", closed: false });
        expect(p.fake.calls.filter((call) => call[0] === "gh" && call[1] === "issue" && call[3] === "12")).toHaveLength(1);
    });

    it("refuses when a story moved since the draft was planned, names each one, and writes nothing", () => {
        const p: Planned = planned();
        p.fake.live[12] = { title: "Report drift, loudly", body: "Compare the pinned state with the live one.", closed: false };
        p.fake.live[21] = null;

        const { code, captured } = approve(p);

        expect(code).toBe(1);
        expect(captured.err.join("\n")).toMatch(/#12/);
        expect(captured.err.join("\n")).toMatch(/#21/);
        expect(readWorkbookPlan(p.repo, "alpha")).toBeNull();
    });

    it("carries none of the learner's own words into the committed workbook", () => {
        const p: Planned = planned();
        approve(p);

        const committed: string = committedText(p.repo);
        expect(committed).not.toContain("vitest suites every day");
        expect(committed).not.toContain("kubernetes");
        expect(committed).not.toContain("flaky retry loop");
        expect(committed).not.toContain("How do you test?");
    });

    it("leaves the committed workbook unchanged and the draft in place when the reviewer does not approve", () => {
        const p: Planned = planned();
        const before: string = fs.readFileSync(planDraftPath(p.repo, "alpha"), "utf8");

        expect(gate(p).code).toBe(0);

        expect(readWorkbookPlan(p.repo, "alpha")).toBeNull();
        expect(fs.readdirSync(workbookRoot(p.repo, "alpha"))).toEqual(["lessons"]);
        expect(fs.readFileSync(planDraftPath(p.repo, "alpha"), "utf8")).toBe(before);
    });

    it("keeps the draft in place after approval, for a later re-plan to reuse", () => {
        const p: Planned = planned();

        approve(p);

        expect(readPlanDraft(p.repo, "alpha")).not.toBeNull();
    });

    it("refuses approval the reviewer was never shown, and approval of a draft that changed after it was shown", () => {
        const p: Planned = planned();

        expect(gate(p, "--approve", "--commands", p.commands).code).toBe(1);
        expect(gate(p).code).toBe(0);
        writePlanDraft(p.repo, "alpha", { ...DRAFT, slices: DRAFT.slices.filter((stub) => stub.story !== 21) });
        const { code, captured } = gate(p, "--approve", "--commands", p.commands);

        expect(code).toBe(1);
        expect(captured.err.join("\n")).toMatch(/shown|changed/);
        expect(readWorkbookPlan(p.repo, "alpha")).toBeNull();
    });

    it("refuses a first approval that declares no suite and grading commands, rather than inferring them", () => {
        const p: Planned = planned();
        expect(gate(p).code).toBe(0);

        const { code, captured } = gate(p, "--approve");

        expect(code).toBe(1);
        expect(captured.err.join("\n")).toMatch(/suite/);
        expect(readWorkbookPlan(p.repo, "alpha")).toBeNull();
    });

    it("runs the coverage refusal again at approval, and writes nothing for a draft with a gap", () => {
        const gap: PlanDraft = { ...DRAFT, coverage: { clean: false, gaps: [{ concept: "drift", story: 12 }] } };
        const p: Planned = planned();
        expect(gate(p).code).toBe(0);
        writePlanDraft(p.repo, "alpha", gap);

        const { code, captured } = gate(p, "--approve", "--commands", p.commands);

        expect(code).toBe(1);
        expect(captured.err.join("\n")).toMatch(/refused/);
        expect(readWorkbookPlan(p.repo, "alpha")).toBeNull();
    });
});
