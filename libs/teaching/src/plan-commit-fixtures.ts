/**
 * The planning chain's leftovers at the approval gate, for the approval specs (epic #458): a resolved
 * roadmap, a recorded interview, a clean draft, a fake issue graph, and the verbs a reviewer runs.
 *
 * Spec-only. Nothing the toolkit ships imports it.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, expect } from "vitest";
import { type RunResult, type Runner, defaultRunner } from "@nexus/workspace/run";
import { recordInterview } from "./interview.js";
import { LEARNER_IGNORE_RULE } from "./learner-store.js";
import { type AuthoredProse } from "./lesson-writer.js";
import { writePlanDraft, type PlanDraft } from "./plan-draft.js";
import { writeRoadmap, type Roadmap } from "./roadmap.js";
import { type LiveStory } from "./teaching-plan.js";
import { runTeachingSession, type SessionResult } from "./teaching-session.js";
import { runWorkbookCli, type WorkbookCliIo } from "./workbook-cli.js";
import { type WorkbookPlan } from "./workbook-plan.js";
import { createWorkbook, readWorkbookPlan } from "./workbook-store.js";

let tmpDirs: string[] = [];
afterEach(() => {
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs = [];
});

export function initRepo(): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "plan-commit-"));
    tmpDirs.push(dir);
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
    fs.writeFileSync(path.join(dir, ".gitignore"), `${LEARNER_IGNORE_RULE}\n.nexus/tmp/\n`);
    return dir;
}

export interface Captured extends WorkbookCliIo {
    out: string[];
    err: string[];
}
export function io(cwd: string): Captured {
    const out: string[] = [];
    const err: string[] = [];
    return { cwd, out, err, stdout: (l) => out.push(l), stderr: (l) => err.push(l) };
}

/** A roadmap spanning two epics: #11 and #12 belong to #100, #21 to #200. */
export const ROADMAP: Roadmap = {
    name: "alpha",
    epics: [100, 200],
    stories: [
        { number: 11, title: "Pin the plan", body: "Record the state a story had at approval.", epic: 100, blockedBy: [], external: [] },
        { number: 12, title: "Report drift", body: "Compare the pinned state with the live one.", epic: 100, blockedBy: [11], external: [] },
        { number: 21, title: "Hand a story off", body: "Write the prompt a coding agent runs.", epic: 200, blockedBy: [12], external: [] },
    ],
};

/** A clean draft with a scaffold, a split story and a handoff — every slice shape approval has to fill in. */
export const DRAFT: PlanDraft = {
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

export const COMMANDS: string = ["suite: [fake-suite, --all]", "grading: [fake-grade]", ""].join("\n");

export interface Fake {
    live: Record<number, LiveStory | null>;
    calls: string[][];
    /** GitHub's close reason for a closed issue, when it is not `completed`. */
    reasons?: Record<number, string>;
}

export function liveFromRoadmap(roadmap: Roadmap = ROADMAP): Record<number, LiveStory | null> {
    return Object.fromEntries(roadmap.stories.map((story) => [story.number, { title: story.title, body: story.body, closed: false }]));
}

/** `gh` answers from the fake issue graph; the suite passes; everything else runs for real. */
export function ghRunner(fake: Fake): Runner {
    return (cmd, args, opts): RunResult => {
        fake.calls.push([cmd, ...args]);
        if (cmd === "gh" && args[0] === "repo") return { status: 0, stdout: "acme/widgets\n", stderr: "" };
        if (cmd === "gh" && args[0] === "issue" && args[1] === "view") {
            const live: LiveStory | null | undefined = fake.live[Number(args[2])];
            if (live === null || live === undefined) return { status: 1, stdout: "", stderr: "not found" };
            return { status: 0, stdout: JSON.stringify({ title: live.title, body: live.body, closedAt: live.closed ? "2026-09-01T00:00:00Z" : null }), stderr: "" };
        }
        const issuePath: RegExpMatchArray | null = cmd === "gh" && args[0] === "api" ? String(args[1]).match(/\/issues\/(\d+)$/) : null;
        if (issuePath !== null) {
            const live: LiveStory | null | undefined = fake.live[Number(issuePath[1])];
            if (live === null || live === undefined) return { status: 1, stdout: "", stderr: "HTTP 404: Not Found" };
            const reason: string | null = live.closed ? (fake.reasons?.[Number(issuePath[1])] ?? "completed") : null;
            return { status: 0, stdout: JSON.stringify({ body: live.body, state: live.closed ? "closed" : "open", state_reason: reason }), stderr: "" };
        }
        if (cmd === "fake-suite") return { status: 0, stdout: "", stderr: "" };
        if (cmd === "fake-grade") return { status: 1, stdout: "", stderr: "" };
        return defaultRunner(cmd, args, opts);
    };
}

export interface Planned {
    repo: string;
    fake: Fake;
    run: Runner;
    commands: string;
}

/** Everything the planning chain leaves behind by the time the gate is reached. */
export function planned(draft: PlanDraft = DRAFT, roadmap: Roadmap = ROADMAP): Planned {
    const repo: string = initRepo();
    const fake: Fake = { live: liveFromRoadmap(), calls: [] };
    const run: Runner = ghRunner(fake);
    createWorkbook(repo, "alpha", run);
    writeRoadmap(repo, roadmap);
    recordInterview(
        repo,
        roadmap,
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

export function gate(p: Planned, ...extra: string[]): { code: number; captured: Captured } {
    const captured: Captured = io(p.repo);
    const code: number = runWorkbookCli(["gate", "alpha", "--root", p.repo, ...extra], captured, p.run);
    return { code, captured };
}

export function approve(p: Planned): { code: number; captured: Captured } {
    expect(gate(p).code).toBe(0);
    return gate(p, "--approve", "--commands", p.commands);
}

export function committedPlan(p: Planned): WorkbookPlan {
    return readWorkbookPlan(p.repo, "alpha") as WorkbookPlan;
}

/** Every file under the committed workbook, the learner folder excepted. */
export function committedText(repo: string): string {
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

/** One teaching session against the planned repository, at a fixed clock. */
export function teach(p: Planned, prose?: AuthoredProse): SessionResult {
    return runTeachingSession({ repoRoot: p.repo, slug: "alpha", read: (story) => p.fake.live[story] ?? null, run: p.run, prose, now: () => "2026-09-13T00:00:00.000Z" });
}
