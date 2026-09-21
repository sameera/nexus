/**
 * The ordering step both readers of a published verdict share (epic #747, decision record #750,
 * key decision "The ordering step is shared; the two readers are not merged").
 */

import { describe, expect, it } from "vitest";
import { RECEIPT_MARKER, collectReceiptBlocks, newestReceiptBlock } from "./receipt-blocks.js";
import { NEWER_VERDICT_AT, OLDER_VERDICT_AT, twoVerdictPrPayload } from "./verdict-fixtures.js";

const marked = (text: string): string => `${text}\n${RECEIPT_MARKER}\n`;

describe("collectReceiptBlocks — every marker-bearing body, with the platform's own timestamp", () => {
    it("gathers reviews and comments together, ignoring bodies with no marker", () => {
        const blocks = collectReceiptBlocks({
            reviews: [{ body: marked("a review"), submittedAt: "2026-09-01T00:00:00Z" }],
            comments: [
                { body: "just a comment", createdAt: "2026-09-02T00:00:00Z" },
                { body: marked("a comment"), createdAt: "2026-09-03T00:00:00Z" },
            ],
        });
        expect(blocks.map((b) => b.source)).toEqual(["review", "comment"]);
        expect(blocks.map((b) => b.at)).toEqual(["2026-09-01T00:00:00Z", "2026-09-03T00:00:00Z"]);
    });

    it("carries the author association GitHub reported, and null when the payload stated none", () => {
        const blocks = collectReceiptBlocks({
            comments: [
                { body: marked("x"), createdAt: "2026-09-01T00:00:00Z", authorAssociation: "MEMBER" },
                { body: marked("y"), createdAt: "2026-09-02T00:00:00Z" },
            ],
        });
        expect(blocks.map((b) => b.authorAssociation)).toEqual(["MEMBER", null]);
    });

    it("reads the live two-verdict pull request as two blocks, oldest first, both by a maintainer", () => {
        const blocks = collectReceiptBlocks(twoVerdictPrPayload());
        expect(blocks.map((b) => b.at)).toEqual([OLDER_VERDICT_AT, NEWER_VERDICT_AT]);
        expect(blocks.every((b) => b.authorAssociation === "MEMBER")).toBe(true);
    });
});

describe("newestReceiptBlock — recency is the platform timestamp and nothing else", () => {
    it("picks the latest whatever order the payload returned them in", () => {
        const older = { at: OLDER_VERDICT_AT };
        const newer = { at: NEWER_VERDICT_AT };
        expect(newestReceiptBlock([older, newer])).toBe(newer);
        expect(newestReceiptBlock([newer, older])).toBe(newer);
    });

    it("is null when there is nothing to choose between", () => {
        expect(newestReceiptBlock([])).toBeNull();
    });
});
