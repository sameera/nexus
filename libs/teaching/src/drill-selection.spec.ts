import { describe, expect, it } from "vitest";
import { chooseDrill, conceptsToRevisit, type LessonConceptHistory } from "./drill-selection.js";

describe("chooseDrill", () => {
    it("drills a concept met earlier and not asked about since", () => {
        const history: LessonConceptHistory[] = [
            { file: "01-recursion.md", introduces: ["recursion"], drilled: [] },
            { file: "02-closures.md", introduces: [], drilled: [] },
        ];
        expect(chooseDrill(history)).toBe("recursion");
    });

    it("picks the concept the learner has taken more hints on, when both are equally cold", () => {
        const history: LessonConceptHistory[] = [
            { file: "01-two-concepts.md", introduces: ["a", "b"], drilled: [] },
            { file: "02-nothing-new.md", introduces: [], drilled: [] },
        ];
        expect(chooseDrill(history, { a: 1, b: 3 })).toBe("b");
        expect(chooseDrill(history, { a: 4, b: 1 })).toBe("a");
    });

    it("picks the concept the learner has taken more hints on, even when another is colder", () => {
        const history: LessonConceptHistory[] = [
            { file: "01-recursion.md", introduces: ["recursion"], drilled: [] },
            { file: "02-closures.md", introduces: ["closures"], drilled: [] },
            { file: "03-nothing-new.md", introduces: [], drilled: [] },
        ];
        // "recursion" is the more overdue of the two, but the hints say "closures" is the one the
        // learner is struggling with, and that is what ranks an already-eligible drill.
        expect(chooseDrill(history, { recursion: 1, closures: 4 })).toBe("closures");
    });

    it("falls back to the most overdue concept when the learner has taken no hints at all", () => {
        const history: LessonConceptHistory[] = [
            { file: "01-recursion.md", introduces: ["recursion"], drilled: [] },
            { file: "02-closures.md", introduces: ["closures"], drilled: [] },
            { file: "03-nothing-new.md", introduces: [], drilled: [] },
        ];
        expect(chooseDrill(history)).toBe("recursion");
    });

    it("never drills a concept met in the lesson the learner has just finished", () => {
        const history: LessonConceptHistory[] = [
            { file: "01-recursion.md", introduces: ["recursion"], drilled: [] },
            { file: "02-closures.md", introduces: ["closures"], drilled: [] },
        ];
        // "closures" was introduced in the lesson the learner just finished — recalling it would
        // not be cold — so the only eligible concept is "recursion".
        expect(chooseDrill(history)).toBe("recursion");
    });

    it("offers no drill when the only concept met so far was introduced in the last lesson", () => {
        const history: LessonConceptHistory[] = [{ file: "01-recursion.md", introduces: ["recursion"], drilled: [] }];
        expect(chooseDrill(history)).toBeNull();
    });

    it("offers no drill to a learner who has met no concept yet", () => {
        expect(chooseDrill([])).toBeNull();
    });

    it("treats a concept re-drilled in a later lesson as freshly met, so it stops being cold", () => {
        const history: LessonConceptHistory[] = [
            { file: "01-recursion.md", introduces: ["recursion"], drilled: [] },
            { file: "02-closures.md", introduces: ["closures"], drilled: ["recursion"] },
            { file: "03-nothing-new.md", introduces: [], drilled: [] },
        ];
        // "recursion" was last met at the drill in lesson 02, one lesson back — as cold as "closures"
        // introduced there — so this is a tie broken by hints, not an automatic pick of "recursion".
        expect(chooseDrill(history, { recursion: 0, closures: 5 })).toBe("closures");
    });
});

describe("conceptsToRevisit", () => {
    const history: LessonConceptHistory[] = [
        { file: "01-recursion.md", introduces: ["recursion"], drilled: [] },
        { file: "02-closures.md", introduces: ["closures", "scope"], drilled: ["recursion"] },
    ];

    it("names a concept the learner took a hint on in the lesson they have just finished", () => {
        expect(conceptsToRevisit(history, { closures: 2 })).toEqual(["closures"]);
    });

    it("names the concept the drill cannot reach, because it was drilled in that same lesson", () => {
        expect(conceptsToRevisit(history, { recursion: 1 })).toEqual(["recursion"]);
    });

    it("names nothing from lessons before the one just finished, however many hints were taken", () => {
        const earlier: LessonConceptHistory[] = [
            { file: "01-recursion.md", introduces: ["recursion"], drilled: [] },
            { file: "02-closures.md", introduces: ["closures"], drilled: [] },
        ];
        expect(conceptsToRevisit(earlier, { recursion: 9 })).toEqual([]);
    });

    it("orders by hints taken and then by name, so the same history gives the same list", () => {
        expect(conceptsToRevisit(history, { closures: 1, scope: 3, recursion: 3 })).toEqual([
            "recursion",
            "scope",
            "closures",
        ]);
    });

    it("names nothing when no hint was taken, and nothing before the first lesson is written", () => {
        expect(conceptsToRevisit(history)).toEqual([]);
        expect(conceptsToRevisit([], { closures: 4 })).toEqual([]);
    });
});
