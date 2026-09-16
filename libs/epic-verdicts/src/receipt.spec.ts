import { describe, expect, it } from "vitest";
import { buildEpicReceipt } from "./receipt.js";
import { type StoryVerdict } from "./verdict.js";

function verdict(over: Partial<StoryVerdict> & { story: number; pr: number }): StoryVerdict {
    return {
        repo: "acme/widget",
        state: "OPEN",
        head: "a".repeat(40),
        base: "b".repeat(40),
        receipt: {
            epic: "#212",
            nexusVersion: "0.13.0",
            pr: over.pr,
            date: "2026-09-01",
            head: "a".repeat(40),
            mode: "full",
            findings: { critical: 0, high: 0, medium: 1, low: 0 },
            repo: "acme/widget",
            stories: [over.story],
            record: "#505",
            recordHash: "e".repeat(64),
        },
        ...over,
    };
}

describe("buildEpicReceipt — findings summed per distinct verdict, never per story (decision record #505, invariant 2)", () => {
    it("sums findings once per distinct pull-request verdict", () => {
        const receipt = buildEpicReceipt(212, [verdict({ story: 496, pr: 501 }), verdict({ story: 497, pr: 502 })]);
        expect(receipt.findings).toEqual({ critical: 0, high: 0, medium: 2, low: 0 });
    });

    it("counts a single verdict's findings once, even when it covers two stories", () => {
        const shared = verdict({ story: 496, pr: 501 });
        shared.receipt.stories = [496, 497];
        const receipt = buildEpicReceipt(212, [shared, { ...shared, story: 497 }]);
        expect(receipt.findings).toEqual({ critical: 0, high: 0, medium: 1, low: 0 });
    });

    it("names every pull request the receipt was derived from, de-duplicated", () => {
        const receipt = buildEpicReceipt(212, [verdict({ story: 496, pr: 501 }), verdict({ story: 497, pr: 501 })]);
        expect(receipt.prs).toEqual([{ repo: "acme/widget", pr: 501 }]);
    });

    it("lists every story with its repository, pull request and analyzed head", () => {
        const receipt = buildEpicReceipt(212, [verdict({ story: 496, pr: 501 })]);
        expect(receipt.stories).toEqual([{ story: 496, repo: "acme/widget", pr: 501, head: "a".repeat(40) }]);
    });

    it("stamps the epic reference", () => {
        const receipt = buildEpicReceipt(212, [verdict({ story: 496, pr: 501 })]);
        expect(receipt.epic).toBe("#212");
    });
});

describe("buildEpicReceipt — issuesRepo (cross-repo issue references)", () => {
    it("stamps the epic reference bare when no issuesRepo is given — unchanged from before", () => {
        const receipt = buildEpicReceipt(212, [verdict({ story: 496, pr: 501 })]);
        expect(receipt.epic).toBe("#212");
    });

    it("qualifies the epic reference when issuesRepo differs from the pull request's own repo", () => {
        const receipt = buildEpicReceipt(212, [verdict({ story: 496, pr: 501 })], [], { issuesRepo: "geo-nexus/docs" });
        expect(receipt.epic).toBe("geo-nexus/docs#212");
    });

    it("stamps bare when issuesRepo matches the code repo every verdict already carries", () => {
        const receipt = buildEpicReceipt(212, [verdict({ story: 496, pr: 501 })], [], { issuesRepo: "acme/widget" });
        expect(receipt.epic).toBe("#212");
    });
});
