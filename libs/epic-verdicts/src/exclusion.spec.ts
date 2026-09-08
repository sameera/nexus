import { describe, expect, it } from "vitest";
import { isExcludedStory } from "./exclusion.js";

describe("isExcludedStory — a story marked as shipping without its own pull request (decision record #505)", () => {
    it("is excluded when it carries the resolved no-pr label", () => {
        expect(isExcludedStory(["no-pull-request"], "no-pull-request")).toBe(true);
    });

    it("is case-insensitive, matching the repository's GitHub label namespace", () => {
        expect(isExcludedStory(["No-Pull-Request"], "no-pull-request")).toBe(true);
    });

    it("is not excluded without the label", () => {
        expect(isExcludedStory(["bug", "enhancement"], "no-pull-request")).toBe(false);
    });

    it("is not excluded by a label that merely contains the marker as a substring", () => {
        expect(isExcludedStory(["no-pull-request-followup"], "no-pull-request")).toBe(false);
    });
});
