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

    it("reports a phase that declares no reference set of its own", () => {
        const problems: string[] = phaseReferenceProblems(ROOT, { planning: { ...planning, references: [] }, lesson });
        expect(problems.join("\n")).toContain(PLANNING_PHASE_ENTRY_POINT);
    });
});
