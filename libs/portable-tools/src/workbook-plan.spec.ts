import { describe, expect, it } from "vitest";
import { PLAN_FILENAME, parsePlan, planStubs, toTeachingPlan, type WorkbookPlan } from "./workbook-plan";

const PLAN_TEXT: string = [
    "repo: nexus",
    "epic: 407",
    "suite: [npx, nx, test, '@nexus/portable-tools']",
    "grading: [npx, nx, test, '@nexus/portable-tools']",
    "slices:",
    "  - story: 460",
    "    lesson: 01-drift.md",
    "    builds: learner",
    "    branch: feat/460-drift",
    "    concepts: [pinned-state, drift]",
    "    pinning_test:",
    "      file: teaching-plan.spec.ts",
    "      text: |",
    "        it('reports a closed story', () => {});",
    "    pinned:",
    "      title: A re-scoped story stops",
    "      body: As a learner, I want the check.",
    "  - story: 464",
    "    builds: handoff",
    "    branch: feat/464-handoff",
    "    concepts: [fence]",
    "    pinning_test:",
    "      file: handoff-prompt.spec.ts",
    "      text: |",
    "        it('names the siblings', () => {});",
    "    pinned:",
    "      title: A handoff slice pauses",
    "      body: As a learner, I want the pause.",
    "",
].join("\n");

describe("the plan is one file describing slices", () => {
    it("reads the order, the story, the mark, the pinned state and the concepts of every slice", () => {
        const plan: WorkbookPlan = parsePlan(PLAN_TEXT);

        expect(plan.slices.map((s) => s.story)).toEqual([460, 464]);
        expect(plan.slices[0].learnerBuilds).toBe(true);
        expect(plan.slices[1].learnerBuilds).toBe(false);
        expect(plan.slices[0].pinned.title).toBe("A re-scoped story stops");
        expect(plan.slices[0].concepts).toEqual(["pinned-state", "drift"]);
    });

    it("carries the pinning test verbatim, so the lesson and the probe hold one text", () => {
        const plan: WorkbookPlan = parsePlan(PLAN_TEXT);

        expect(plan.slices[0].pinningTest.file).toBe("teaching-plan.spec.ts");
        expect(plan.slices[0].pinningTest.text).toContain("it('reports a closed story'");
    });

    it("declares the command that runs the suite, so nothing has to infer one", () => {
        const plan: WorkbookPlan = parsePlan(PLAN_TEXT);

        expect(plan.suite).toEqual(["npx", "nx", "test", "@nexus/portable-tools"]);
        expect(plan.grading).toEqual(["npx", "nx", "test", "@nexus/portable-tools"]);
    });

    it("refuses a plan that declares no suite command, rather than guessing one", () => {
        const withoutSuite: string = PLAN_TEXT.split("\n").filter((l) => !l.startsWith("suite:")).join("\n");

        expect(() => parsePlan(withoutSuite)).toThrow(/suite/);
    });

    it("refuses a slice whose mark is neither the learner's nor a handoff", () => {
        const badMark: string = PLAN_TEXT.replace("builds: learner", "builds: somebody-else");

        expect(() => parsePlan(badMark)).toThrow(/somebody-else/);
    });

    it("refuses a slice that names no story, because a slice is a story's step", () => {
        const noStory: string = PLAN_TEXT.replace("  - story: 460\n", "  - \n");

        expect(() => parsePlan(noStory)).toThrow(/story/);
    });

    it("refuses two slices teaching into one lesson file, so a lesson has one slice", () => {
        const duplicated: string = PLAN_TEXT.replace(
            "  - story: 464\n",
            "  - story: 464\n    lesson: 01-drift.md\n",
        );

        expect(() => parsePlan(duplicated)).toThrow(/01-drift\.md/);
    });

    it("lets a handoff slice name no lesson, because it is neither built nor taught here", () => {
        expect(parsePlan(PLAN_TEXT).slices[1].lesson).toBe("");
    });

    it("hands the drift check the pinned state it compares against", () => {
        const teaching = toTeachingPlan(parsePlan(PLAN_TEXT));

        expect(teaching.slices).toEqual([
            { story: 460, learnerBuilds: true, pinned: { title: "A re-scoped story stops", body: "As a learner, I want the check." } },
            { story: 464, learnerBuilds: false, pinned: { title: "A handoff slice pauses", body: "As a learner, I want the pause." } },
        ]);
    });

    it("names the slices with no lesson written yet, which the workbook shows as stubs", () => {
        const plan: WorkbookPlan = parsePlan(PLAN_TEXT);

        expect(planStubs(plan, [])).toEqual([{ story: 460, lesson: "01-drift.md" }]);
        expect(planStubs(plan, ["01-drift.md"])).toEqual([]);
    });

    it("refuses a plan that describes no slices, so nothing teaches from an empty one", () => {
        expect(() => parsePlan("suite: [a]\ngrading: [a]\n")).toThrow(/slices/);
    });

    it("refuses a plan file that is not readable at all", () => {
        expect(() => parsePlan("slices: [\n  - story: :\n")).toThrow(/not readable/);
    });

    it("names the file a workbook declares its plan in", () => {
        expect(PLAN_FILENAME).toBe("plan.yml");
    });
});
