import { describe, expect, it } from "vitest";
import {
    renderExerciseSection,
    resolveArrival,
    type ExerciseFacts,
    type StagedLesson,
} from "./lesson-writer.js";
import { type TeachingPlan } from "./teaching-plan.js";

const PLAN: TeachingPlan = {
    slices: [
        { story: 460, learnerBuilds: true, pinned: { title: "t1", body: "b1" } },
        { story: 464, learnerBuilds: false, pinned: { title: "t2", body: "b2" } },
        { story: 465, learnerBuilds: true, pinned: { title: "t3", body: "b3" } },
    ],
};

describe("resolveArrival", () => {
    it("writes exactly one lesson on a first open, leaving every later slice a stub", () => {
        expect(resolveArrival(PLAN, [])).toEqual({ kind: "write", slice: PLAN.slices[0] });
    });

    it("opens the lesson already written rather than rewriting it while the learner is still on it", () => {
        const written: StagedLesson[] = [{ story: 460, pinningTestPassed: false }];
        expect(resolveArrival(PLAN, written)).toEqual({ kind: "open", story: 460 });
    });

    it("writes the next lesson once the current exercise is finished", () => {
        const allLearnerBuilt: TeachingPlan = {
            slices: [
                { story: 460, learnerBuilds: true, pinned: { title: "t1", body: "b1" } },
                { story: 461, learnerBuilds: true, pinned: { title: "t2", body: "b2" } },
            ],
        };
        const written: StagedLesson[] = [{ story: 460, pinningTestPassed: true }];
        expect(resolveArrival(allLearnerBuilt, written)).toEqual({ kind: "write", slice: allLearnerBuilt.slices[1] });
    });

    it("hands off rather than writing a lesson when the next slice is not the learner's to build", () => {
        const written: StagedLesson[] = [{ story: 460, pinningTestPassed: true }];
        expect(resolveArrival(PLAN, written)).toEqual({ kind: "handoff", slice: PLAN.slices[1] });
    });

    it("reports done once every slice has a finished lesson", () => {
        const allLearnerBuilt: TeachingPlan = {
            slices: [
                { story: 460, learnerBuilds: true, pinned: { title: "t1", body: "b1" } },
                { story: 461, learnerBuilds: true, pinned: { title: "t2", body: "b2" } },
            ],
        };
        const written: StagedLesson[] = [
            { story: 460, pinningTestPassed: true },
            { story: 461, pinningTestPassed: true },
        ];
        expect(resolveArrival(allLearnerBuilt, written)).toEqual({ kind: "done" });
    });
});

describe("renderExerciseSection", () => {
    const facts: ExerciseFacts = {
        story: 460,
        branch: "feat/407-session-teaches-one-lesson",
        pinningTest: "a session with no lessons written offers no drill",
        gradingCommand: "npx nx test @nexus/portable-tools",
    };

    it("names the story, the branch, the pinning test and the grading command", () => {
        const section = renderExerciseSection(facts);
        expect(section).toContain("#460");
        expect(section).toContain("feat/407-session-teaches-one-lesson");
        expect(section).toContain("a session with no lessons written offers no drill");
        expect(section).toContain("npx nx test @nexus/portable-tools");
    });

    it("asks about a concept the learner took a hint on, when a drill is chosen", () => {
        const section = renderExerciseSection(facts, "cold retrieval");
        expect(section).toContain("cold retrieval");
    });

    it("carries no markup — it is authored lesson prose, not a page", () => {
        const section = renderExerciseSection(facts, "cold retrieval");
        expect(section).not.toMatch(/<[a-zA-Z]/);
    });
});
