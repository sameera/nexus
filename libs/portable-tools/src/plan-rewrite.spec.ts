import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { stringify } from "yaml";
import { applyDeclaration, rewritePlan, type Declaration, type DeclarationResult, type RewriteOptions, type StoryEdges } from "./plan-rewrite.js";
import { readInterview, recordInterview, type GivenAnswer, type InterviewRecord } from "./interview.js";
import { LEARNER_IGNORE_RULE } from "./learner-store.js";
import { readPlanDraft, writePlanDraft, type CoverageVerdict, type PlanDraft, type PlanStub } from "./plan-draft.js";
import { writeRoadmap, type Roadmap } from "./roadmap.js";
import { runWorkbookCli } from "./workbook-cli.js";

let tmpDirs: string[] = [];
function initRepo(): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "plan-rewrite-"));
    tmpDirs.push(dir);
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
    fs.writeFileSync(path.join(dir, ".gitignore"), `${LEARNER_IGNORE_RULE}\n.nexus/tmp/\n`);
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

describe("a concept the learner declared they already know is never introduced", () => {
    const VOCABULARY = [
        { id: "drift", gloss: "a page that no longer matches its lesson", aliases: ["drifted"] },
        { id: "pinned-state", gloss: "the state a plan records at approval", aliases: [] },
        { id: "unit-test", gloss: "a test over one unit", aliases: [] },
    ];
    const DRAFT: PlanDraft = {
        slices: [learner(11, ["unit-test", "pinned-state"]), learner(12, ["drift"], ["unit-test"])],
        vocabulary: VOCABULARY,
    };
    const KNOWN: Declaration = { declared: [{ slot: "testing-practice", phrase: "written vitest suites for years", concepts: ["unit-test"] }] };
    const ANSWERS: GivenAnswer[] = [
        { slot: "testing-practice", question: "How have you worked with tests?", answer: "I have written vitest suites for years." },
        { slot: "recent-difficulty", question: "What did you last find hard?", answer: "drift, every time." },
        { slot: "focus", question: "What did you come to learn?", answer: "the pinned-state work." },
    ];

    function declared(repo: string, declaration: Declaration, draft: PlanDraft = DRAFT): DeclarationResult {
        return applyDeclaration(readInterview(repo, "alpha") as InterviewRecord, draft, declaration);
    }

    function withInterview(answers: GivenAnswer[] = ANSWERS): string {
        const repo: string = initRepo();
        writeRoadmap(repo, ROADMAP);
        recordInterview(repo, ROADMAP, answers);
        return repo;
    }

    it("introduces the concept the learner's words name in no slice of the plan", () => {
        const result: DeclarationResult = declared(withInterview(), KNOWN);
        expect(result.ok).toBe(true);
        const plan: PlanDraft = rewritePlan((result as { ok: true; draft: PlanDraft }).draft);
        expect(plan.slices.flatMap((stub) => stub.concepts)).not.toContain("unit-test");
        expect(sliceFor(plan, 11).concepts).toEqual(["pinned-state"]);
    });

    it("records each removed concept beside the learner's quoted phrase, and on no stub", () => {
        const result = declared(withInterview(), KNOWN) as { ok: true; draft: PlanDraft };
        expect(result.draft.declared).toEqual([{ concept: "unit-test", phrase: "written vitest suites for years" }]);
        for (const stub of result.draft.slices) expect(JSON.stringify(stub)).not.toContain("vitest");
    });

    it("removes nothing for words that name nothing the roadmap teaches, and reports them", () => {
        const result = declared(withInterview(), {
            declared: [{ slot: "testing-practice", phrase: "written vitest suites for years", concepts: [] }],
        }) as { ok: true; draft: PlanDraft };
        expect(result.draft.unmatched).toEqual(["written vitest suites for years"]);
        expect(result.draft.declared ?? []).toEqual([]);
        expect(rewritePlan(result.draft).slices.flatMap((s) => s.concepts).sort()).toEqual(["drift", "pinned-state", "unit-test"]);
    });

    it("leaves a later slice assuming a removed concept, so it can be counted satisfied", () => {
        const result = declared(withInterview(), KNOWN) as { ok: true; draft: PlanDraft };
        expect(sliceFor(rewritePlan(result.draft), 12).assumes).toContain("unit-test");
    });

    it("refuses an identifier the merged vocabulary does not hold, and removes nothing", () => {
        const result: DeclarationResult = declared(withInterview(), {
            declared: [{ slot: "testing-practice", phrase: "written vitest suites for years", concepts: ["mutation-testing"] }],
        });
        expect(result.ok).toBe(false);
        expect((result as { ok: false; problem: string }).problem).toMatch(/mutation-testing/);
    });

    it("reads an alias the merge folded in as the concept it was folded into", () => {
        const result = declared(withInterview([
            { slot: "stack-experience", question: "What have you built?", answer: "I have chased drifted pages before." },
        ]), { declared: [{ slot: "stack-experience", phrase: "chased drifted pages", concepts: ["drifted"] }] }) as { ok: true; draft: PlanDraft };
        expect(result.draft.declared).toEqual([{ concept: "drift", phrase: "chased drifted pages" }]);
    });

    it("refuses a phrase the slot's recorded answer does not hold verbatim", () => {
        const result: DeclarationResult = declared(withInterview(), {
            declared: [{ slot: "testing-practice", phrase: "written jest suites for years", concepts: ["unit-test"] }],
        });
        expect(result.ok).toBe(false);
        expect((result as { ok: false; problem: string }).problem).toMatch(/verbatim|own words/);
    });

    it("refuses a slot that records what the learner came to learn, or what they found hard", () => {
        for (const slot of ["focus", "recent-difficulty"]) {
            const result: DeclarationResult = declared(withInterview(), {
                declared: [{ slot, phrase: "drift", concepts: ["drift"] }],
            });
            expect(result.ok).toBe(false);
            expect((result as { ok: false; problem: string }).problem).toContain(slot);
        }
    });

    it("removes nothing when the session declares nothing", () => {
        const result = declared(withInterview(), { declared: [] }) as { ok: true; draft: PlanDraft };
        expect(rewritePlan(result.draft).slices.flatMap((s) => s.concepts).sort()).toEqual(["drift", "pinned-state", "unit-test"]);
    });

    it("applies the same declaration through the verb, and reports the words that matched nothing", () => {
        const repo: string = withInterview();
        writePlanDraft(repo, "alpha", DRAFT);
        const file: string = path.join(repo, "declare.yml");
        fs.writeFileSync(file, stringify({ ...KNOWN, declared: [...KNOWN.declared, { slot: "testing-practice", phrase: "I have written vitest", concepts: [] }] }));
        const captured: Captured = io(repo);

        expect(runWorkbookCli(["rewrite", "alpha", "--root", repo, "--declare", file], captured)).toBe(0);
        expect(readPlanDraft(repo, "alpha")?.slices.flatMap((stub) => stub.concepts)).not.toContain("unit-test");
        expect(captured.out.join("\n")).toContain("I have written vitest");
    });

    it("writes nothing when the declaration is refused", () => {
        const repo: string = withInterview();
        writePlanDraft(repo, "alpha", DRAFT);
        const file: string = path.join(repo, "declare.yml");
        fs.writeFileSync(file, stringify({ declared: [{ slot: "focus", phrase: "the pinned-state work", concepts: ["pinned-state"] }] }));
        const captured: Captured = io(repo);

        expect(runWorkbookCli(["rewrite", "alpha", "--root", repo, "--declare", file], captured)).toBe(1);
        expect(readPlanDraft(repo, "alpha")?.slices.flatMap((stub) => stub.concepts)).toContain("pinned-state");
    });
});

describe("slices order to introduce the fewest new concepts per step", () => {
    function order(draft: PlanDraft, edges: StoryEdges[]): number[] {
        return rewritePlan(draft, { edges }).slices.map((stub) => stub.story);
    }

    it("puts a blocked slice after the slice that blocks it", () => {
        const draft: PlanDraft = { slices: [learner(11, ["a", "b", "c"]), learner(12, ["d"])] };
        expect(order(draft, [{ story: 11, blockedBy: [] }, { story: 12, blockedBy: [11] }])).toEqual([11, 12]);
    });

    it("takes the slice introducing the fewest concepts not yet introduced, at every step", () => {
        const draft: PlanDraft = { slices: [learner(11, ["a", "b", "c"]), learner(12, ["d"]), learner(13, ["a", "b"])] };
        const free: StoryEdges[] = [11, 12, 13].map((story) => ({ story, blockedBy: [] }));
        // #12 costs one, then #13 costs two, and #11 then costs only the one concept #13 left.
        expect(order(draft, free)).toEqual([12, 13, 11]);
    });

    it("breaks a tie by ascending story number", () => {
        const draft: PlanDraft = { slices: [learner(13, ["c"]), learner(11, ["a"]), learner(12, ["b"])] };
        expect(order(draft, [11, 12, 13].map((story) => ({ story, blockedBy: [] })))).toEqual([11, 12, 13]);
    });

    it("never lets a cheaper slice jump the edge that blocks it", () => {
        const draft: PlanDraft = { slices: [learner(11, ["a", "b", "c"]), learner(12, ["d"])] };
        expect(order(draft, [{ story: 11, blockedBy: [] }, { story: 12, blockedBy: [11] }])).toEqual([11, 12]);
    });

    it("orders over learner slices, keeping an edge that runs through a handoff", () => {
        const draft: PlanDraft = { slices: [learner(11, ["a", "b"]), handoff(12), learner(13, ["c"]), learner(14, ["d"])] };
        const edges: StoryEdges[] = [
            { story: 11, blockedBy: [] },
            { story: 12, blockedBy: [11] },
            { story: 13, blockedBy: [12] },
            { story: 14, blockedBy: [] },
        ];
        const placed: number[] = order(draft, edges);
        // #13 is blocked by #11 through the handoff, so it follows it however cheap it is.
        expect(placed.indexOf(13)).toBeGreaterThan(placed.indexOf(11));
        // A handoff never precedes what blocks it either.
        expect(placed.indexOf(12)).toBeGreaterThan(placed.indexOf(11));
        expect(placed.indexOf(13)).toBeGreaterThan(placed.indexOf(12));
    });

    it("ignores an edge onto a story the roadmap does not hold", () => {
        const draft: PlanDraft = { slices: [learner(11, ["a"])] };
        expect(order(draft, [{ story: 11, blockedBy: [99] }])).toEqual([11]);
    });

    it("assigns ownership as the chosen order is built, never against the arriving one", () => {
        const draft: PlanDraft = { slices: [learner(11, ["a", "b"]), learner(12, ["a"])] };
        const plan: PlanDraft = rewritePlan(draft, { edges: [11, 12].map((story) => ({ story, blockedBy: [] })) });
        expect(plan.slices.map((stub) => stub.story)).toEqual([12, 11]);
        expect(sliceFor(plan, 12).concepts).toEqual(["a"]);
        expect(sliceFor(plan, 11).concepts).toEqual(["b"]);
        expect(sliceFor(plan, 11).assumes).toEqual(["a"]);
    });

    it("holds the same slices in the same order when nothing changed", () => {
        const draft: PlanDraft = { slices: [learner(13, ["a", "b"]), learner(11, ["b"]), learner(12, ["a", "c"])] };
        const edges: StoryEdges[] = [11, 12, 13].map((story) => ({ story, blockedBy: [] }));
        expect(order(draft, edges)).toEqual(order(draft, edges));
        expect(rewritePlan(draft, { edges })).toEqual(rewritePlan(draft, { edges }));
    });

    it("orders the draft against the roadmap's own edges through the verb", () => {
        const repo: string = initRepo();
        writeRoadmap(repo, ROADMAP);
        writePlanDraft(repo, "alpha", { slices: [learner(12, ["drift", "pinned-state"]), learner(11, ["pinned-state"])] });

        expect(runWorkbookCli(["rewrite", "alpha", "--root", repo], io(repo))).toBe(0);
        const plan: PlanDraft = readPlanDraft(repo, "alpha") as PlanDraft;
        expect(plan.slices.map((stub) => stub.story)).toEqual([11, 12]);
        expect(sliceFor(plan, 11).concepts).toEqual(["pinned-state"]);
        expect(sliceFor(plan, 12).concepts).toEqual(["drift"]);
    });
});

describe("coverage is verified before anything reaches the gate", () => {
    const FREE: StoryEdges[] = [11, 12, 13, 14].map((story) => ({ story, blockedBy: [] }));

    function coverage(draft: PlanDraft, options: RewriteOptions = {}): CoverageVerdict {
        return rewritePlan(draft, { edges: FREE, ...options }).coverage as CoverageVerdict;
    }

    it("passes a plan whose every assumption an earlier learner slice introduces", () => {
        expect(coverage({ slices: [learner(11, ["a"]), learner(12, ["b"], ["a"])] })).toEqual({ clean: true, gaps: [] });
    });

    it("passes an assumption the learner declared they already know", () => {
        const draft: PlanDraft = { slices: [learner(11, ["b"], ["a"])], declared: [{ concept: "a", phrase: "I know a" }] };
        expect(coverage(draft).clean).toBe(true);
    });

    it("faults a learner slice assuming a concept only a later learner slice introduces", () => {
        const draft: PlanDraft = { slices: [learner(11, ["a"], ["b"]), learner(12, ["b"])] };
        const verdict: CoverageVerdict = coverage(draft, { edges: [{ story: 11, blockedBy: [] }, { story: 12, blockedBy: [11] }] });
        expect(verdict.clean).toBe(false);
        expect(verdict.gaps).toEqual([{ concept: "b", story: 11 }]);
    });

    it("faults an assumption only a handed-off story would introduce, and names that story", () => {
        const draft: PlanDraft = { slices: [learner(11, ["a"], ["b"]), handoff(12)] };
        const verdict: CoverageVerdict = coverage(draft, { handoffConcepts: new Map([[12, ["b"]]]) });
        expect(verdict.clean).toBe(false);
        expect(verdict.gaps).toEqual([{ concept: "b", story: 11, handedOff: 12 }]);
    });

    it("faults a concept no slice of the roadmap introduces not at all", () => {
        expect(coverage({ slices: [learner(11, ["a"], ["nowhere"])] })).toEqual({ clean: true, gaps: [] });
    });

    it("names every gap rather than only the first", () => {
        const draft: PlanDraft = { slices: [learner(11, ["a"], ["b", "c"]), handoff(13), learner(12, ["b"])] };
        const verdict: CoverageVerdict = coverage(draft, {
            edges: [{ story: 11, blockedBy: [] }, { story: 12, blockedBy: [11] }, { story: 13, blockedBy: [] }],
            handoffConcepts: new Map([[13, ["c"]]]),
        });
        expect(verdict.gaps).toEqual([
            { concept: "b", story: 11 },
            { concept: "c", story: 11, handedOff: 13 },
        ]);
    });

    it("records the verdict with the plan, and writes the plan even when it fails", () => {
        const repo: string = initRepo();
        writeRoadmap(repo, ROADMAP);
        writePlanDraft(repo, "alpha", { slices: [learner(11, ["drift"], ["pinned-state"]), learner(12, ["pinned-state"])] });
        const captured: Captured = io(repo);

        expect(runWorkbookCli(["rewrite", "alpha", "--root", repo], captured)).toBe(1);
        const plan: PlanDraft = readPlanDraft(repo, "alpha") as PlanDraft;
        expect(plan.coverage?.clean).toBe(false);
        expect(plan.coverage?.gaps).toEqual([{ concept: "pinned-state", story: 11 }]);
        expect(captured.err.join("\n")).toContain("pinned-state");
    });

    it("hands over when coverage is clean", () => {
        const repo: string = initRepo();
        writeRoadmap(repo, ROADMAP);
        writePlanDraft(repo, "alpha", { slices: [learner(11, ["pinned-state"]), learner(12, ["drift"], ["pinned-state"])] });
        expect(runWorkbookCli(["rewrite", "alpha", "--root", repo], io(repo))).toBe(0);
        expect(readPlanDraft(repo, "alpha")?.coverage).toEqual({ clean: true, gaps: [] });
    });
});
