import { describe, expect, it } from "vitest";
import { assessEpicCoverage } from "./coverage.js";
import { type ShippedRecord } from "./ledger.js";
import { type StoryMergedPr } from "./story-prs.js";

function record(stories: number[], pr: number, repo = "acme/member"): ShippedRecord {
    return {
        epic: "#769",
        stories,
        repo,
        pr,
        mergeCommit: `merge-${pr}`,
        mergedAt: "2026-09-10T00:00:00Z",
        base: `base-${pr}`,
        head: `merge-${pr}`,
        findings: { critical: 0, high: 0, medium: 0, low: 0 },
        recordHash: null,
        nexusVersion: null,
    };
}

function mergedPr(story: number, pr: number, repo = "acme/member"): StoryMergedPr {
    return { story, pr, repo, mergeCommit: `merge-${pr}`, mergedAt: "2026-09-10T00:00:00Z", edge: "closing" };
}

describe("assessEpicCoverage — what an epic has shipped and what it has not (epic #769)", () => {
    it("reports an epic fully shipped and names every recorded pull request", () => {
        const out = assessEpicCoverage({
            epic: 769,
            stories: [770, 771],
            records: [record([770], 10), record([771], 11)],
            mergedPrsByStory: { 770: [mergedPr(770, 10)], 771: [mergedPr(771, 11)] },
        });
        expect(out.fullyShipped).toBe(true);
        expect(out.stories.map((s) => s.state)).toEqual(["shipped", "shipped"]);
        expect(out.recorded.map((r) => r.pr)).toEqual([10, 11]);
    });

    it("names a story with no record as unshipped, and does not call the epic fully shipped", () => {
        const out = assessEpicCoverage({ epic: 769, stories: [770, 771], records: [record([770], 10)] });
        expect(out.fullyShipped).toBe(false);
        expect(out.unshipped).toEqual([771]);
    });

    it("names a merged pull request that carries no record as unrecorded", () => {
        const out = assessEpicCoverage({
            epic: 769,
            stories: [770],
            records: [],
            mergedPrsByStory: { 770: [mergedPr(770, 10)] },
        });
        expect(out.fullyShipped).toBe(false);
        expect(out.unrecorded).toEqual([{ story: 770, repo: "acme/member", pr: 10 }]);
        expect(out.stories[0].state).toBe("unrecorded");
        expect(out.unshipped).toEqual([]);
    });

    it("separates a story with nothing recorded at all from one whose merge never went through the gate", () => {
        const out = assessEpicCoverage({
            epic: 769,
            stories: [770, 771],
            records: [],
            mergedPrsByStory: { 770: [mergedPr(770, 10)] },
        });
        expect(out.stories.find((s) => s.story === 770)?.state).toBe("unrecorded");
        expect(out.stories.find((s) => s.story === 771)?.state).toBe("unshipped");
    });

    it("reports a story added after a record was written as unshipped, invalidating no record", () => {
        const records = [record([770], 10)];
        const before = assessEpicCoverage({ epic: 769, stories: [770], records });
        const after = assessEpicCoverage({ epic: 769, stories: [770, 999], records });
        expect(before.fullyShipped).toBe(true);
        expect(after.fullyShipped).toBe(false);
        expect(after.unshipped).toEqual([999]);
        expect(after.stories.find((s) => s.story === 770)?.state).toBe("shipped");
    });

    it("leaves a story marked as shipping without a pull request out of the count", () => {
        const out = assessEpicCoverage({
            epic: 769,
            stories: [770, 771],
            excluded: [771],
            records: [record([770], 10)],
        });
        expect(out.fullyShipped).toBe(true);
        expect(out.unshipped).toEqual([]);
        expect(out.excluded).toEqual([771]);
        expect(out.stories.find((s) => s.story === 771)?.state).toBe("excluded");
    });

    it("counts a record naming two stories for both of them", () => {
        const out = assessEpicCoverage({ epic: 769, stories: [770, 771], records: [record([770, 771], 10)] });
        expect(out.fullyShipped).toBe(true);
    });

    it("matches a record to a merged pull request across the two written repository forms", () => {
        const out = assessEpicCoverage({
            epic: 769,
            stories: [770],
            records: [record([770], 10, "github.com/Acme/Member")],
            mergedPrsByStory: { 770: [mergedPr(770, 10, "acme/member")] },
        });
        expect(out.unrecorded).toEqual([]);
        expect(out.fullyShipped).toBe(true);
    });

    it("carries the untrusted records through rather than dropping them", () => {
        const untrusted = [{ commentId: "IC_1", key: "acme/member#10", author: "drive-by", authorAssociation: "NONE" }];
        const out = assessEpicCoverage({ epic: 769, stories: [770], records: [], untrusted });
        expect(out.untrusted).toEqual(untrusted);
    });
});
