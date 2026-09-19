import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import { draftFromExtractions, readExtractions, recordExtraction } from "./concept-extraction.js";
import { siblingSlices } from "./handoff-prompt.js";
import { FOCUS_SLOT, recordInterview } from "./interview.js";
import { LEARNER_IGNORE_RULE } from "./learner-store.js";
import { StubError, planDraftPath, readPlanDraft, validateStub } from "./plan-draft.js";
import { writeRoadmap, type Roadmap } from "./roadmap.js";
import { parsePlan, planStubs, toTeachingPlan, type WorkbookPlan } from "./workbook-plan.js";

let tmpDirs: string[] = [];
function initRepo(): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "handoff-stubs-"));
    tmpDirs.push(dir);
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
    fs.writeFileSync(path.join(dir, ".gitignore"), `${LEARNER_IGNORE_RULE}\n.nexus/tmp/\n`);
    return dir;
}
afterEach(() => {
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs = [];
});

/** Two epics; #32 is the one story whose work the learner did not come to build. */
const ROADMAP: Roadmap = {
    name: "alpha",
    epics: [100, 200],
    stories: [
        { number: 31, title: "Order the roadmap", body: "Order stories.", epic: 100, blockedBy: [], external: [] },
        { number: 32, title: "Render the page", body: "Render HTML.", epic: 100, blockedBy: [31], external: [] },
        { number: 33, title: "Report a cycle", body: "Name the cycle.", epic: 100, blockedBy: [32], external: [] },
        { number: 41, title: "Query epics", body: "Search the backlog.", epic: 200, blockedBy: [], external: [] },
    ],
};

interface Proposal {
    serves: boolean;
    introduces: string[];
    assumes: string[];
}
const PROPOSALS: Record<number, Proposal> = {
    31: { serves: true, introduces: ["roadmap-order"], assumes: [] },
    32: { serves: false, introduces: ["html-render"], assumes: ["roadmap-order"] },
    33: { serves: true, introduces: ["cycle-report"], assumes: ["html-render"] },
    41: { serves: true, introduces: ["query-epics"], assumes: [] },
};

const GROUPS: string[][] = [["cycle-report"], ["html-render"], ["query-epics"], ["roadmap-order"]];

/** A roadmap planned through to its draft, with a focus that leaves #32 outside it. */
function drafted(proposals: Record<number, Proposal> = PROPOSALS, groups: string[][] = GROUPS): string {
    const repo: string = initRepo();
    writeRoadmap(repo, ROADMAP);
    recordInterview(repo, ROADMAP, [{ slot: FOCUS_SLOT, question: "What did you come to learn?", answer: "How a roadmap is ordered." }]);
    for (const [story, p] of Object.entries(proposals)) {
        const entries = (ids: string[]) => ids.map((id) => ({ id, gloss: `what ${id} means` }));
        recordExtraction(
            repo,
            ROADMAP,
            Number(story),
            JSON.stringify({ story: Number(story), introduces: entries(p.introduces), assumes: entries(p.assumes), serves: p.serves, reason: "r" }),
        );
    }
    const result = draftFromExtractions(repo, ROADMAP, groups);
    expect(result.ok).toBe(true);
    return repo;
}

function draftText(repo: string): string {
    return fs.readFileSync(planDraftPath(repo, "alpha"), "utf8");
}

/** Fill the fields approval owns with test values, the way #458 will, and read it with the shipped reader. */
function approve(text: string): WorkbookPlan {
    const doc = parse(text) as { slices: Record<string, unknown>[] };
    const slices = doc.slices.map((slice) => ({
        ...slice,
        ...(slice["builds"] === "learner" ? { lesson: `${String(slice["story"])}.md` } : {}),
        branch: `feat/${String(slice["story"])}`,
        pinning_test: { file: `${String(slice["story"])}.spec.ts`, text: "it('holds', () => {});" },
        pinned: { title: "A story", body: "As a learner." },
    }));
    return parsePlan(stringify({ repo: "acme/app", epic: 100, suite: ["npm", "test"], grading: ["npm", "test"], slices }));
}

describe("a handoff stub carries no concepts and no sources", () => {
    it("writes a handoff stub with its story and its mark and nothing else", () => {
        const repo: string = drafted();
        const handoff = (parse(draftText(repo)) as { slices: Record<string, unknown>[] }).slices.find((s) => s["story"] === 32);
        expect(handoff).toEqual({ story: 32, builds: "handoff" });
    });

    it("refuses a handoff stub offered concepts, assumed concepts or sources", () => {
        expect(() => validateStub({ story: 32, builds: "handoff", concepts: ["html-render"] }, 0)).toThrow(StubError);
        expect(() => validateStub({ story: 32, builds: "handoff", assumes: ["roadmap-order"] }, 0)).toThrow(StubError);
        expect(() => validateStub({ story: 32, builds: "handoff", sources: ["docs/a.md"] }, 0)).toThrow(StubError);
    });

    it("keeps a handed-off story's extracted concepts in the extraction results and the merged vocabulary, off its stub", () => {
        const repo: string = drafted();
        const extracted = readExtractions(repo, ROADMAP).current.find((list) => list.story === 32);
        expect(extracted?.introduces.map((c) => c.id)).toEqual(["html-render"]);
        expect(readPlanDraft(repo, "alpha")?.vocabulary?.map((v) => v.id)).toContain("html-render");
        // The learner slice that assumes it names it with the same identifier the handed-off story proposed.
        expect(readPlanDraft(repo, "alpha")?.slices.find((s) => s.story === 33)?.assumes).toEqual(["html-render"]);
    });

    it("names the handed-off story behind a concept a learner slice assumes, when the merge renamed what that story proposed", () => {
        const repo: string = drafted(
            { ...PROPOSALS, 32: { serves: false, introduces: ["page-render"], assumes: ["roadmap-order"] } },
            [["cycle-report"], ["html-render", "page-render"], ["query-epics"], ["roadmap-order"]],
        );
        const draft = readPlanDraft(repo, "alpha");
        expect(draft?.slices.find((s) => s.story === 33)?.assumes).toEqual(["html-render"]);
        // Each checked list keeps the name its subagent proposed; the draft's vocabulary carries every
        // name the merge folded into a concept, so the two meet on one identifier.
        const identifierOf = (id: string): string | undefined => draft?.vocabulary?.find((v) => v.id === id || v.aliases.includes(id))?.id;
        const introducedBy: number[] = readExtractions(repo, ROADMAP)
            .current.filter((list) => list.introduces.some((c) => identifierOf(c.id) === "html-render"))
            .map((list) => list.story);
        expect(introducedBy).toEqual([32]);
    });
});

describe("a handoff slice is given no lesson", () => {
    it("writes no lesson for it, so it never becomes a page in the workbook", () => {
        const repo: string = drafted();
        expect(draftText(repo)).not.toContain("lesson");
        const plan: WorkbookPlan = approve(draftText(repo));
        expect(plan.slices.find((s) => s.story === 32)?.lesson).toBe("");
        expect(planStubs(plan, []).map((stub) => stub.story)).not.toContain(32);
    });
});

describe("the slices a handoff must not touch", () => {
    it("include every other slice of the same epic", () => {
        const repo: string = drafted();
        const siblings: number[] = siblingSlices(toTeachingPlan(approve(draftText(repo))), 32);
        const sameEpic: number[] = ROADMAP.stories.filter((s) => s.epic === 100 && s.number !== 32).map((s) => s.number);
        expect(siblings).toEqual(expect.arrayContaining(sameEpic));
        expect(siblings).not.toContain(32);
    });

    it("are worked out from the plan, so the draft writes no sibling list of its own", () => {
        const repo: string = drafted();
        expect(draftText(repo)).not.toContain("sibling");
    });
});
