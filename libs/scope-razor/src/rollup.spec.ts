import { describe, expect, it } from "vitest";
import { complexityDrivers, designWarrant, recordedComplexity, rollupFloor, storySizes, type StorySize } from "./rollup.js";

const DRAFT: string = [
    "---",
    'epic: "Reporting"',
    "complexity: L",
    "complexity_drivers: [spans two services, six stories]",
    "---",
    "",
    "## User Stories",
    "",
    "### Story 1: Core `[inferred]`",
    "",
    "- **story_type:** user",
    "- **size:** S",
    "",
    "### Story 2: Reporting `[inferred]`",
    "",
    "- **story_type:** user",
    "- **size:** M",
    "",
    "### Story 3: Export `[inferred]`",
    "",
    "- **story_type:** user",
    "",
].join("\n");

describe("what the draft records about size", () => {
    it("reads each story's own size, by title, with the provenance label stripped off", () => {
        const sizes: StorySize[] = storySizes(DRAFT);
        expect(sizes).toEqual([
            { title: "Core", size: "S" },
            { title: "Reporting", size: "M" },
            { title: "Export", size: undefined },
        ]);
    });

    it("reads the epic's recorded rollup and the drivers it rests on", () => {
        expect(recordedComplexity(DRAFT)).toBe("L");
        expect(complexityDrivers(DRAFT)).toEqual(["spans two services", "six stories"]);
    });

    it("reports no recorded rollup for a draft that carries none", () => {
        expect(recordedComplexity("## Notes\n\n- A thing")).toBeUndefined();
        expect(complexityDrivers("## Notes\n\n- A thing")).toEqual([]);
    });
});

describe("the floor the filed story set forces", () => {
    it("is the largest size among the stories actually filed", () => {
        expect(rollupFloor(storySizes(DRAFT), ["Core", "Reporting"])).toBe("M");
    });

    it("falls when the filed set leaves the larger stories out", () => {
        expect(rollupFloor(storySizes(DRAFT), ["Core"])).toBe("S");
    });

    it("matches a title the way every other razor rule does, ignoring case and spacing", () => {
        expect(rollupFloor(storySizes(DRAFT), ["  core  "])).toBe("S");
    });

    it("is undefined when no filed story states a size, so nothing is asserted from nothing", () => {
        expect(rollupFloor(storySizes(DRAFT), ["Export"])).toBeUndefined();
    });
});

describe("the design warrant", () => {
    it("follows from the rollup: M or larger carries it, S does not", () => {
        expect(designWarrant("S")).toBe(false);
        expect(designWarrant("M")).toBe(true);
        expect(designWarrant("L")).toBe(true);
    });

    it("errs toward carrying it when no rollup is recorded", () => {
        expect(designWarrant(undefined)).toBe(true);
    });
});
