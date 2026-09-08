import { describe, expect, it } from "vitest";
import { chooseDrill, type LessonConceptHistory } from "./drill-selection.js";

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
