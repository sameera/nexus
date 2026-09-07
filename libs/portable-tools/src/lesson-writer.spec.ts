import { describe, expect, it } from "vitest";
import {
    composeLesson,
    renderDrillSection,
    renderExerciseSection,
    renderRevisitSection,
    resolveArrival,
    type AuthoredProse,
    type ExerciseFacts,
    type LessonBrief,
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

    it("resumes at the outstanding handoff rather than treating the next slice as fresh", () => {
        const written: StagedLesson[] = [{ story: 460, pinningTestPassed: true }];

        expect(resolveArrival(PLAN, written, { resolved: [], outstanding: 464 })).toEqual({
            kind: "resume",
            story: 464,
        });
    });

    it("teaches past a handoff slice once its handoff has been resolved", () => {
        const written: StagedLesson[] = [{ story: 460, pinningTestPassed: true }];

        expect(resolveArrival(PLAN, written, { resolved: [464], outstanding: null })).toEqual({
            kind: "write",
            slice: PLAN.slices[2],
        });
    });

    it("hands the same slice off again while its handoff is unresolved and unrecorded", () => {
        const written: StagedLesson[] = [{ story: 460, pinningTestPassed: true }];

        expect(resolveArrival(PLAN, written, { resolved: [], outstanding: null })).toEqual({
            kind: "handoff",
            slice: PLAN.slices[1],
        });
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
        pinningTest: "libs/portable-tools/src/drill-selection.spec.ts",
        pinningTestText: 'it("offers no drill in a first session", () => {\n    const met: Array<string> = [];\n});\n',
        gradingCommand: "npx nx test @nexus/portable-tools",
    };

    /** The section's own words — everything outside the block that quotes the test. */
    function scaffolding(section: string): string {
        return section.split(/^```.*$/m).filter((_part, at) => at % 2 === 0).join("\n");
    }

    it("names the story, the branch, the pinning test and the grading command", () => {
        const section = renderExerciseSection(facts);
        expect(section).toContain("#460");
        expect(section).toContain("feat/407-session-teaches-one-lesson");
        expect(section).toContain("libs/portable-tools/src/drill-selection.spec.ts");
        expect(section).toContain("npx nx test @nexus/portable-tools");
    });

    it("shows the pinning test's own text, so the learner reads what the probe will run", () => {
        const section = renderExerciseSection(facts);
        expect(section).toContain('it("offers no drill in a first session", () => {');
        expect(section).toContain("const met: Array<string> = [];");
    });

    it("carries no markup of its own — it is authored lesson prose, not a page", () => {
        expect(scaffolding(renderExerciseSection(facts))).not.toMatch(/<[a-zA-Z]/);
    });
});

describe("the drill opens the lesson as a predict-then-reveal exercise", () => {
    it("asks the question and declares the component that withholds the answer", () => {
        const section = renderDrillSection("cold retrieval", "What is cold retrieval?", "Recall without a cue.");

        expect(section).toContain("cold retrieval");
        expect(section).toContain("predict-then-reveal");
        expect(section).toContain("What is cold retrieval?");
        expect(section).toContain("Recall without a cue.");
        expect(section).not.toMatch(/<[a-zA-Z]/);
    });
});

describe("composeLesson assembles what the chain decided around the prose an agent wrote", () => {
    const brief: LessonBrief = {
        story: 460,
        lesson: "01-drift.md",
        title: "A re-scoped story stops",
        concepts: ["pinned state"],
        drill: "cold retrieval",
        revisit: [],
        exercise: {
            story: 460,
            branch: "feat/460-drift",
            pinningTest: "teaching-plan.spec.ts",
            pinningTestText: 'it("pins the plan", () => {});\n',
            gradingCommand: "npx nx test @nexus/portable-tools",
        },
    };
    const prose: AuthoredProse = {
        theory: "A plan pins what was approved.\n",
        drill: { question: "What is cold retrieval?", answer: "Recall without a cue." },
    };

    it("puts the drill first, the theory next and the exercise last", () => {
        const lesson = composeLesson(brief, prose);

        expect(lesson.indexOf("cold retrieval")).toBeLessThan(lesson.indexOf("A plan pins what was approved."));
        expect(lesson.indexOf("A plan pins what was approved.")).toBeLessThan(lesson.indexOf("## Exercise"));
    });

    it("declares the lesson's title, so the page it renders to has one", () => {
        expect(composeLesson(brief, prose)).toMatch(/^---\ntitle: A re-scoped story stops\n/);
    });

    it("records the concept it drilled, so a later session can see it was asked about", () => {
        expect(composeLesson(brief, prose)).toContain("drill: cold retrieval");
    });

    it("goes straight to the theory when no concept was cold enough to drill", () => {
        const lesson = composeLesson({ ...brief, drill: null }, { theory: prose.theory });

        expect(lesson).not.toContain("Warm-up");
        expect(lesson).toContain("A plan pins what was approved.");
    });

    it("refuses to write a lesson whose drill has no question and answer to reveal", () => {
        expect(() => composeLesson(brief, { theory: prose.theory })).toThrow(/cold retrieval/);
    });
});

describe("a concept the learner took a hint on is asked about again in the next lesson", () => {
    const brief: LessonBrief = {
        story: 461,
        lesson: "02-widget.md",
        title: "Predict-then-reveal",
        concepts: ["predict then reveal"],
        drill: null,
        revisit: ["closures"],
        exercise: {
            story: 461,
            branch: "feat/461-widget",
            pinningTest: "predict-then-reveal.spec.ts",
            pinningTestText: 'it("reveals on demand", () => {});\n',
            gradingCommand: "npx nx test @nexus/portable-tools",
        },
    };
    const prose: AuthoredProse = {
        theory: "A component hides its answer until it is asked for.\n",
        revisit: [{ concept: "closures", question: "What does a closure capture?", answer: "Its enclosing scope." }],
    };

    it("asks about the concept again, with its answer withheld until the learner asks for it", () => {
        const lesson = composeLesson(brief, prose);

        expect(lesson).toContain("closures");
        expect(lesson).toContain("What does a closure capture?");
        expect(lesson).toContain("Its enclosing scope.");
        expect(lesson).toContain("predict-then-reveal");
    });

    it("records what it revisited, so the lesson says on its face which concept came back", () => {
        expect(composeLesson(brief, prose)).toContain("revisits: [closures]");
    });

    it("refuses to write a lesson that names a concept to revisit and asks nothing about it", () => {
        expect(() => composeLesson(brief, { theory: prose.theory })).toThrow(/closures/);
    });

    it("carries no markup, and asks the revisited question after the theory it follows on from", () => {
        const lesson = composeLesson(brief, prose);

        expect(lesson.indexOf("A component hides its answer")).toBeLessThan(lesson.indexOf("What does a closure capture?"));
        expect(lesson.indexOf("What does a closure capture?")).toBeLessThan(lesson.indexOf("## Exercise"));
        expect(renderRevisitSection(prose.revisit ?? [])).not.toMatch(/<[a-zA-Z]/);
    });
});
