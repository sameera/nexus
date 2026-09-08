import { describe, expect, it } from "vitest";
import {
    LESSON_PHASE_ENTRY_POINT,
    PLANNING_PHASE_ENTRY_POINT,
    readPhaseEntryPoint,
    SHARED_REFERENCES,
    phaseReferenceProblems,
    type PhaseEntryPoint,
} from "./phase-references.js";
import { authoredComponentRoot } from "./vendor-components.js";

const ROOT: string = authoredComponentRoot(import.meta.dirname);

const planning: PhaseEntryPoint = readPhaseEntryPoint(ROOT, PLANNING_PHASE_ENTRY_POINT);
const lesson: PhaseEntryPoint = readPhaseEntryPoint(ROOT, LESSON_PHASE_ENTRY_POINT);

describe("each phase is its own entry point", () => {
    it("gives the planning phase and the lesson-writing phase separate adopter-facing bodies", () => {
        expect(planning.command).not.toBe(lesson.command);
        expect(planning.phase).toBe("planning");
        expect(lesson.phase).toBe("lesson-writing");
    });

    it("has each phase declare its own reference set", () => {
        expect(planning.references.length).toBeGreaterThan(0);
        expect(lesson.references.length).toBeGreaterThan(0);
    });
});

describe("a planning session holds no lesson-writing reference", () => {
    it("declares none of them", () => {
        const lessonOnly: string[] = lesson.references.filter((r) => !SHARED_REFERENCES.includes(r));
        expect(lessonOnly.length).toBeGreaterThan(0);
        for (const reference of lessonOnly) expect(planning.references).not.toContain(reference);
    });

    it("names none of them anywhere in its body, because naming one is loading it", () => {
        const lessonOnly: string[] = lesson.references.filter((r) => !SHARED_REFERENCES.includes(r));
        for (const reference of lessonOnly) expect(planning.body).not.toContain(reference);
    });
});

describe("a lesson-writing session holds no planning reference", () => {
    it("declares none of them, because the finished phase's references do not come along", () => {
        const planningOnly: string[] = planning.references.filter((r) => !SHARED_REFERENCES.includes(r));
        expect(planningOnly.length).toBeGreaterThan(0);
        for (const reference of planningOnly) expect(lesson.references).not.toContain(reference);
    });

    it("names none of them anywhere in its body, because naming one is loading it", () => {
        const planningOnly: string[] = planning.references.filter((r) => !SHARED_REFERENCES.includes(r));
        for (const reference of planningOnly) expect(lesson.body).not.toContain(reference);
    });
});

describe("what both phases need", () => {
    it("is reached through a shared skill both declare, never duplicated into both bodies", () => {
        expect(SHARED_REFERENCES.length).toBeGreaterThan(0);
        for (const reference of SHARED_REFERENCES) {
            expect(planning.references).toContain(reference);
            expect(lesson.references).toContain(reference);
            expect(planning.body).toContain(reference);
            expect(lesson.body).toContain(reference);
        }
    });
});

describe("the whole declaration, checked in one pass", () => {
    it("reports no problem for the authored tree", () => {
        expect(phaseReferenceProblems(ROOT)).toEqual([]);
    });

    it("reports a planning body that declares a lesson-writing reference", () => {
        const problems: string[] = phaseReferenceProblems(ROOT, {
            planning: { ...planning, references: [...planning.references, ...lesson.references] },
            lesson,
        });
        expect(problems.join("\n")).toContain("nxs-prose-style");
    });

    it("reports a lesson-writing body that names a planning reference, because naming one is loading it", () => {
        const problems: string[] = phaseReferenceProblems(ROOT, {
            planning,
            lesson: { ...lesson, body: `${lesson.body}\n\nLoad the nxs-epic-resolve skill for the roadmap.` },
        });
        expect(problems.join("\n")).toContain("nxs-epic-resolve");
    });

    it("reports a reference both phases declare without its being a shared one", () => {
        const problems: string[] = phaseReferenceProblems(ROOT, {
            planning,
            lesson: { ...lesson, references: [...lesson.references, "nxs-epic-resolve"] },
        });
        expect(problems.join("\n")).toContain("nxs-epic-resolve");
    });

    it("reports a phase that declares no reference set of its own", () => {
        const problems: string[] = phaseReferenceProblems(ROOT, { planning: { ...planning, references: [] }, lesson });
        expect(problems.join("\n")).toContain(PLANNING_PHASE_ENTRY_POINT);
    });
});
