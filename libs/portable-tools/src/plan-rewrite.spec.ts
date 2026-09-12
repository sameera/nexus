import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { rewritePlan } from "./plan-rewrite.js";
import { readPlanDraft, writePlanDraft, type PlanDraft, type PlanStub } from "./plan-draft.js";
import { writeRoadmap, type Roadmap } from "./roadmap.js";
import { runWorkbookCli } from "./workbook-cli.js";

let tmpDirs: string[] = [];
function initRepo(): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "plan-rewrite-"));
    tmpDirs.push(dir);
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
    fs.writeFileSync(path.join(dir, ".gitignore"), ".nexus/tmp/\n");
    return dir;
}
afterEach(() => {
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs = [];
});

const ROADMAP: Roadmap = {
    name: "alpha",
    epics: [100],
    stories: [
        { number: 11, title: "Pin the plan", body: "record the state a story had at approval.", epic: 100, blockedBy: [], external: [] },
        { number: 12, title: "Report drift", body: "compare the pinned state with the live one.", epic: 100, blockedBy: [11], external: [] },
    ],
};

interface Captured {
    cwd: string;
    out: string[];
    err: string[];
    stdout: (l: string) => void;
    stderr: (l: string) => void;
}
function io(cwd: string): Captured {
    const out: string[] = [];
    const err: string[] = [];
    return { cwd, out, err, stdout: (l) => out.push(l), stderr: (l) => err.push(l) };
}

function learner(story: number, concepts: string[], assumes: string[] = []): PlanStub {
    return { story, builds: "learner", concepts, assumes };
}

function handoff(story: number): PlanStub {
    return { story, builds: "handoff", concepts: [], assumes: [] };
}

function sliceFor(plan: PlanDraft, story: number): PlanStub {
    return plan.slices.find((stub) => stub.story === story) as PlanStub;
}

describe("a concept is introduced once and assumed thereafter", () => {
    it("leaves the concept with the earlier slice and makes the later one assume it", () => {
        const plan: PlanDraft = rewritePlan({
            slices: [learner(11, ["drift"]), learner(12, ["drift", "pinned-state"])],
        });
        expect(sliceFor(plan, 11).concepts).toContain("drift");
        expect(sliceFor(plan, 12).concepts).not.toContain("drift");
        expect(sliceFor(plan, 12).assumes).toContain("drift");
        expect(sliceFor(plan, 12).concepts).toContain("pinned-state");
    });

    it("introduces no concept from more than one slice of the plan", () => {
        const plan: PlanDraft = rewritePlan({
            slices: [learner(11, ["drift", "pinned-state"]), learner(12, ["drift"]), learner(13, ["pinned-state", "drift"])],
        });
        const introduced: string[] = plan.slices.flatMap((stub) => stub.concepts);
        expect(new Set(introduced).size).toBe(introduced.length);
    });

    it("keeps a slice whose every concept an earlier slice already teaches, introducing nothing", () => {
        const plan: PlanDraft = rewritePlan({
            slices: [learner(11, ["drift", "pinned-state"]), learner(12, ["drift", "pinned-state"])],
        });
        expect(plan.slices.map((stub) => stub.story)).toContain(12);
        expect(sliceFor(plan, 12).concepts).toEqual([]);
        expect(sliceFor(plan, 12).assumes).toEqual(expect.arrayContaining(["drift", "pinned-state"]));
    });

    it("keeps what a slice already assumed alongside what it no longer introduces", () => {
        const plan: PlanDraft = rewritePlan({
            slices: [learner(11, ["drift"]), learner(12, ["drift"], ["issue-graph"])],
        });
        expect(sliceFor(plan, 12).assumes).toEqual(["issue-graph", "drift"]);
    });

    it("never lists a concept as both introduced and assumed", () => {
        const plan: PlanDraft = rewritePlan({ slices: [learner(11, ["drift"], []), learner(12, ["drift", "issue-graph"], ["drift"])] });
        for (const stub of plan.slices) expect(stub.assumes.filter((id) => stub.concepts.includes(id))).toEqual([]);
    });

    it("leaves a handoff slice teaching nothing, and never gives it a concept an earlier slice dropped", () => {
        const plan: PlanDraft = rewritePlan({ slices: [learner(11, ["drift"]), handoff(12), learner(13, ["drift"])] });
        expect(sliceFor(plan, 12)).toEqual(handoff(12));
        expect(sliceFor(plan, 13).assumes).toEqual(["drift"]);
    });

    it("carries the merged vocabulary through untouched", () => {
        const vocabulary = [{ id: "drift", gloss: "a page that no longer matches its lesson", aliases: ["drifted"] }];
        expect(rewritePlan({ slices: [learner(11, ["drift"])], vocabulary }).vocabulary).toEqual(vocabulary);
    });

    it("writes the same plan when it is rewritten again", () => {
        const draft: PlanDraft = { slices: [learner(11, ["drift"]), learner(12, ["drift", "pinned-state"])] };
        expect(rewritePlan(rewritePlan(draft))).toEqual(rewritePlan(draft));
    });
});

describe("the rewrite is reachable and replaces the draft whole", () => {
    it("rewrites the draft the planning pass wrote, leaving one owner per concept", () => {
        const repo: string = initRepo();
        writeRoadmap(repo, ROADMAP);
        writePlanDraft(repo, "alpha", { slices: [learner(11, ["drift"]), learner(12, ["drift", "pinned-state"])] });
        const captured: Captured = io(repo);

        expect(runWorkbookCli(["rewrite", "alpha", "--root", repo], captured)).toBe(0);
        const plan: PlanDraft = readPlanDraft(repo, "alpha") as PlanDraft;
        expect(sliceFor(plan, 11).concepts).toEqual(["drift"]);
        expect(sliceFor(plan, 12).concepts).toEqual(["pinned-state"]);
        expect(sliceFor(plan, 12).assumes).toEqual(["drift"]);
    });

    it("refuses a roadmap with no draft, and writes nothing", () => {
        const repo: string = initRepo();
        writeRoadmap(repo, ROADMAP);
        const captured: Captured = io(repo);
        expect(runWorkbookCli(["rewrite", "alpha", "--root", repo], captured)).toBe(1);
        expect(captured.err.join("\n")).toMatch(/no plan draft/);
        expect(readPlanDraft(repo, "alpha")).toBeNull();
    });
});
