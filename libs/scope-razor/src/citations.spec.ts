import { describe, expect, it } from "vitest";
import { citationHolds, citations, MINIMUM_FRAGMENT_WORDS, normalize } from "./citations.js";

describe("normalizing a fragment and a source the same way", () => {
    it("collapses whitespace runs and folds case", () => {
        expect(normalize("  The   User \n can Log OUT ")).toBe("the user can log out");
    });

    it("maps typographic quotes and dashes to their plain forms", () => {
        expect(normalize("“the lead’s call” — always")).toBe('"the lead\'s call" - always');
    });
});

describe("whether a citation holds", () => {
    const source: string = "The user can log out from any screen, and the session ends there.";

    it("holds when the fragment appears verbatim in the source", () => {
        expect(citationHolds("the user can log out", source)).toBe(true);
    });

    it("holds across typographic drift the author did not intend to introduce", () => {
        expect(citationHolds("The  user’s session ends there", "the user's session ends there")).toBe(true);
    });

    it("fails when the fragment is nowhere in the source", () => {
        expect(citationHolds("the user can reset a password", source)).toBe(false);
    });

    it("fails a fragment shorter than the word floor even when it does appear", () => {
        expect("the user can".split(" ")).toHaveLength(MINIMUM_FRAGMENT_WORDS - 1);
        expect(citationHolds("the user can", source)).toBe(false);
    });

    it("holds a fragment exactly at the word floor", () => {
        expect(citationHolds("the user can log", source)).toBe(true);
    });
});

describe("reading the citations out of a draft", () => {
    it("finds each asked fragment with the line it was written on", () => {
        const found = citations('# Epic\n\n- One `[asked: "a quoted thing"]`\n- Two `[inferred]`\n');
        expect(found).toEqual([{ line: 3, fragment: "a quoted thing", item: "- One" }]);
    });

    it("finds nothing in a draft whose items are all inferred", () => {
        expect(citations("- One `[inferred]`\n")).toEqual([]);
    });
});
