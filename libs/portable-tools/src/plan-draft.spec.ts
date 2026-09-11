import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import { StubError, planDraftPath, readPlanDraft, validateStub, writePlanDraft, type PlanDraft } from "./plan-draft.js";
import { parsePlan, type WorkbookPlan } from "./workbook-plan.js";

let tmpDirs: string[] = [];
function initRepo(): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "plan-draft-"));
    tmpDirs.push(dir);
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
    fs.writeFileSync(path.join(dir, ".gitignore"), ".nexus/tmp/\n");
    return dir;
}
afterEach(() => {
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs = [];
});

const DRAFT: PlanDraft = {
    slices: [
        { story: 11, builds: "learner", concepts: ["pinned-state", "drift"], assumes: ["issue-graph"] },
        { story: 12, builds: "handoff", concepts: [], assumes: [] },
    ],
};

/**
 * Fill every field the approval owns with test values, the way #458 will, and hand the result to
 * the shipped plan reader. A draft on its own is not a teachable plan (record for #456, decision 1).
 */
function approve(draftText: string): WorkbookPlan {
    const doc = parse(draftText) as { slices: Record<string, unknown>[] };
    const slices = doc.slices.map((slice) => ({
        ...slice,
        ...(slice["builds"] === "learner" ? { lesson: `${String(slice["story"])}.md` } : {}),
        branch: `feat/${String(slice["story"])}`,
        pinning_test: { file: `${String(slice["story"])}.spec.ts`, text: "it('holds', () => {});" },
        pinned: { title: "A story", body: "As a learner." },
    }));
    return parsePlan(stringify({ repo: "acme/app", epic: 100, suite: ["npm", "test"], grading: ["npm", "test"], slices }));
}

describe("a stub names exactly one story", () => {
    it("writes each slice's story", () => {
        const repo: string = initRepo();
        writePlanDraft(repo, "alpha", DRAFT);
        expect(readPlanDraft(repo, "alpha")?.slices.map((s) => s.story)).toEqual([11, 12]);
    });

    it("refuses a stub that names no story, or a list of them", () => {
        expect(() => validateStub({ builds: "learner" }, 0)).toThrow(StubError);
        expect(() => validateStub({ story: [11, 12], builds: "learner" }, 0)).toThrow(/exactly one/);
    });

    it("refuses two slices for one story", () => {
        const repo: string = initRepo();
        const twice: PlanDraft = { slices: [DRAFT.slices[0], { ...DRAFT.slices[0] }] };
        expect(() => writePlanDraft(repo, "alpha", twice)).toThrow(/two slices/);
    });
});

describe("a stub carries a mark of learner or handoff", () => {
    it("writes the mark in the shipped plan's own field", () => {
        const repo: string = initRepo();
        const text: string = fs.readFileSync(writePlanDraft(repo, "alpha", DRAFT), "utf8");
        expect((parse(text) as { slices: { builds: string }[] }).slices.map((s) => s.builds)).toEqual(["learner", "handoff"]);
    });

    it("refuses any other mark, and writes nothing", () => {
        const repo: string = initRepo();
        const wrong = { slices: [{ story: 11, builds: "pairing", concepts: [], assumes: [] }] } as unknown as PlanDraft;
        expect(() => writePlanDraft(repo, "alpha", wrong)).toThrow(/pairing/);
        expect(() => validateStub({ story: 11 }, 0)).toThrow(StubError);
        expect(fs.existsSync(planDraftPath(repo, "alpha"))).toBe(false);
    });

    it("leaves the previous draft untouched when a replacement is refused", () => {
        const repo: string = initRepo();
        writePlanDraft(repo, "alpha", DRAFT);
        const before: string = fs.readFileSync(planDraftPath(repo, "alpha"), "utf8");
        const wrong = { slices: [{ story: 11, builds: "both" }] } as unknown as PlanDraft;
        expect(() => writePlanDraft(repo, "alpha", wrong)).toThrow(StubError);
        expect(fs.readFileSync(planDraftPath(repo, "alpha"), "utf8")).toBe(before);
    });
});

describe("a learner stub lists the concepts it introduces and the concepts it assumes", () => {
    it("keeps introduced concepts in the shipped concept field and assumed ones beside it", () => {
        const repo: string = initRepo();
        writePlanDraft(repo, "alpha", DRAFT);
        const learner = readPlanDraft(repo, "alpha")?.slices[0];
        expect(learner?.concepts).toEqual(["pinned-state", "drift"]);
        expect(learner?.assumes).toEqual(["issue-graph"]);
    });

    it("refuses a concept listed as both introduced and assumed", () => {
        expect(() => validateStub({ story: 11, builds: "learner", concepts: ["drift"], assumes: ["drift"] }, 0)).toThrow(/both introduces and assumes/);
    });

    it("refuses an identifier a front-matter reader would rename", () => {
        for (const bad of ["Pinned State", "pinned_state", "42", "drift:", "true", "false", "null"]) {
            expect(() => validateStub({ story: 11, builds: "learner", concepts: [bad] }, 0)).toThrow(StubError);
        }
    });
});

describe("a stub carries no lesson prose", () => {
    it("refuses prose, a lesson, a pinned state or a source offered as a stub field", () => {
        for (const field of ["theory", "lesson", "pinned", "sources", "branch", "pinning_test"]) {
            expect(() => validateStub({ story: 11, builds: "learner", [field]: "anything" }, 0)).toThrow(new RegExp(field));
        }
    });

    it("writes nothing beyond the story, the mark and the concepts", () => {
        const repo: string = initRepo();
        const doc = parse(fs.readFileSync(writePlanDraft(repo, "alpha", DRAFT), "utf8")) as { slices: Record<string, unknown>[] };
        expect(Object.keys(doc.slices[0]).sort()).toEqual(["assumes", "builds", "concepts", "story"]);
        expect(Object.keys(doc.slices[1]).sort()).toEqual(["builds", "story"]);
    });
});

describe("the teaching session reads a stub's mark and concepts without translating either", () => {
    it("accepts every mark and every introduced concept once approval fills the fields it owns", () => {
        const repo: string = initRepo();
        const plan: WorkbookPlan = approve(fs.readFileSync(writePlanDraft(repo, "alpha", DRAFT), "utf8"));
        expect(plan.slices.map((s) => s.learnerBuilds)).toEqual([true, false]);
        expect(plan.slices[0].concepts).toEqual(["pinned-state", "drift"]);
    });

    it("is not itself a teachable plan, so an unapproved draft cannot be taught", () => {
        const repo: string = initRepo();
        expect(() => parsePlan(fs.readFileSync(writePlanDraft(repo, "alpha", DRAFT), "utf8"))).toThrow();
    });

    it("stays out of the committed tree", () => {
        const repo: string = initRepo();
        writePlanDraft(repo, "alpha", DRAFT);
        expect(execFileSync("git", ["status", "--porcelain"], { cwd: repo, encoding: "utf8" })).not.toContain(".nexus");
    });
});
