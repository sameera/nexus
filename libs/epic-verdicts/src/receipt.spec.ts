import { describe, expect, it } from "vitest";
import { type ShippedRecord } from "./ledger.js";
import { buildEpicReceipt } from "./receipt.js";

/**
 * These pin the behaviours the removed per-story verdict selection used to pin (epic #769, story
 * #775): findings summed once per pull request, the pull-request list de-duplicated, the story list
 * carrying its repository and head, and the epic reference qualified only when it has to be. The
 * source is now the epic's records rather than a search over published reviews.
 */
function record(over: Partial<ShippedRecord> & { stories: number[]; pr: number }): ShippedRecord {
    return {
        epic: "#212",
        repo: "acme/widget",
        mergeCommit: "a".repeat(40),
        mergedAt: "2026-09-01T00:00:00Z",
        base: "b".repeat(40),
        head: "a".repeat(40),
        findings: { critical: 0, high: 0, medium: 1, low: 0 },
        recordHash: "e".repeat(64),
        nexusVersion: "0.73.0",
        ...over,
    };
}

describe("buildEpicReceipt — findings summed per record, never per story (epic #769, invariant 13)", () => {
    it("sums findings once per recorded pull request", () => {
        const receipt = buildEpicReceipt(212, [record({ stories: [496], pr: 501 }), record({ stories: [497], pr: 502 })]);
        expect(receipt.findings).toEqual({ critical: 0, high: 0, medium: 2, low: 0 });
    });

    it("counts one record's findings once, even when it covers two stories", () => {
        const receipt = buildEpicReceipt(212, [record({ stories: [496, 497], pr: 501 })]);
        expect(receipt.findings).toEqual({ critical: 0, high: 0, medium: 1, low: 0 });
    });

    it("counts both pull requests of a story that shipped in two", () => {
        const receipt = buildEpicReceipt(212, [record({ stories: [496], pr: 501 }), record({ stories: [496], pr: 502 })]);
        expect(receipt.findings).toEqual({ critical: 0, high: 0, medium: 2, low: 0 });
        expect(receipt.prs.map((p) => p.pr)).toEqual([501, 502]);
    });

    it("names every pull request the receipt was derived from, de-duplicated", () => {
        const receipt = buildEpicReceipt(212, [record({ stories: [496, 497], pr: 501 }), record({ stories: [498], pr: 502 })]);
        expect(receipt.prs).toEqual([
            { repo: "acme/widget", pr: 501 },
            { repo: "acme/widget", pr: 502 },
        ]);
    });

    it("lists every story with its repository, pull request and shipped head", () => {
        const receipt = buildEpicReceipt(212, [record({ stories: [497], pr: 502, repo: "acme/member" })]);
        expect(receipt.stories).toEqual([{ story: 497, repo: "acme/member", pr: 502, head: "a".repeat(40) }]);
    });

    it("keeps the excluded stories, sorted", () => {
        const receipt = buildEpicReceipt(212, [record({ stories: [496], pr: 501 })], [499, 498]);
        expect(receipt.excluded).toEqual([498, 499]);
    });
});

describe("buildEpicReceipt — the epic reference (cross-repo issue references)", () => {
    it("stamps the epic reference bare when no issuesRepo is given", () => {
        expect(buildEpicReceipt(212, [record({ stories: [496], pr: 501 })]).epic).toBe("#212");
    });

    it("qualifies the epic reference when issuesRepo differs from the pull request's own repo", () => {
        const receipt = buildEpicReceipt(212, [record({ stories: [496], pr: 501, repo: "acme/member" })], [], {
            issuesRepo: "acme/hub",
        });
        expect(receipt.epic).toBe("acme/hub#212");
    });

    it("stamps bare when issuesRepo matches the code repo every record already carries", () => {
        const receipt = buildEpicReceipt(212, [record({ stories: [496], pr: 501 })], [], { issuesRepo: "acme/widget" });
        expect(receipt.epic).toBe("#212");
    });
});
