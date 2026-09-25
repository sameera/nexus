/**
 * Reading a draft's promised epic and story changes, and matching them against a live issue body
 * (epic #787, story #791, D8).
 *
 * The fixtures are the two commitment lines of record #794 (D10 and D11), copied here so the spec
 * does not depend on a session folder.
 */

import { describe, expect, it } from "vitest";
import { commitmentsIn, matchCommitment, normaliseWording } from "./amendments.js";

const D10_OLD = "**Given** any record run, **when** the stage drafts, checks or files the record, **then** it never edits the epic issue or a story issue.";
const D10_NEW =
    "**Given** any record run, **when** the stage drafts, checks or files the record, **then** it never edits the text of the epic issue or of a story issue; moving the epic's labels is unchanged.";
const D11_OLD = "Records already filed in the old format are not rewritten; the new format applies to records drafted after the release.";
const D11_NEW =
    "Records already filed in the old format are not rewritten; the new format applies to records first filed after the release, and a revision keeps the format its record was approved in.";

const D10_LINE = `- **Epic commitment affected:** #791 criterion 4. Old: "${D10_OLD}". New: "${D10_NEW}". Status: pending.`;
const D11_LINE = `- **Epic commitment affected:** #787, second assumption. Old: "${D11_OLD}". New: "${D11_NEW}". Status: pending.`;

function draft(...entries: string[]): string {
    return [
        "# Decision Record: X",
        "",
        "## Guarantees",
        "",
        "- G1. A thing holds. (D1) [inferred]",
        "",
        "## Design rationale and mechanism",
        "",
        "### Decisions and reasons",
        "",
        ...entries,
    ].join("\n");
}

function entry(id: string, commitment: string): string {
    return [`#### ${id} — A decision`, "", "- **Decision:** a thing.", "- **Why:** a reason.", commitment, "- **Delivered by:** #791", ""].join("\n");
}

describe("commitmentsIn — every promised change in a draft", () => {
    it("reads the issue, the exact old and new wording and the status of each commitment", () => {
        const found = commitmentsIn(draft(entry("D10", D10_LINE), entry("D11", D11_LINE)));
        expect(found).toEqual([
            expect.objectContaining({ decision: "D10", ref: "#791 criterion 4", issue: 791, repo: null, old: D10_OLD, new: D10_NEW, recorded: "pending" }),
            expect.objectContaining({ decision: "D11", ref: "#787, second assumption", issue: 787, repo: null, old: D11_OLD, new: D11_NEW, recorded: "pending" }),
        ]);
    });

    it("skips a decision whose commitment is none", () => {
        const found = commitmentsIn(draft(entry("D1", "- **Epic commitment affected:** none"), entry("D10", D10_LINE)));
        expect(found.map((c) => c.decision)).toEqual(["D10"]);
    });

    it("reads a cross-repository reference as the repository it names", () => {
        const line: string = D10_LINE.replace("#791 criterion 4", "acme/docs#791 criterion 4");
        const [found] = commitmentsIn(draft(entry("D10", line)));
        expect(found).toMatchObject({ issue: 791, repo: "acme/docs" });
    });

    it("keeps an already amended status and an unresolved one as written", () => {
        const amended: string = D10_LINE.replace("Status: pending.", "Status: amended (verified 2026-09-20).");
        const unresolved = '- **Epic commitment affected:** #787, second assumption. Status: unresolved (the lead has not chosen the wording).';
        const found = commitmentsIn(draft(entry("D10", amended), entry("D11", unresolved)));
        expect(found[0]).toMatchObject({ recorded: "amended (verified 2026-09-20)" });
        expect(found[1]).toMatchObject({ decision: "D11", issue: 787, recorded: "unresolved (the lead has not chosen the wording)" });
    });

    it("names a commitment it cannot read, rather than skipping it", () => {
        const [found] = commitmentsIn(draft(entry("D3", "- **Epic commitment affected:** the epic changes a bit.")));
        expect(found).toMatchObject({ decision: "D3", problem: expect.stringMatching(/Old: "…". New: "…". Status:/) });
    });

    it("names a commitment whose new wording is empty", () => {
        const [found] = commitmentsIn(draft(entry("D4", '- **Epic commitment affected:** #791 criterion 1. Old: "a thing". New: "". Status: pending.')));
        expect(found).toMatchObject({ decision: "D4", problem: expect.stringMatching(/new wording is empty/) });
    });

    it("finds no commitment in a draft with none", () => {
        expect(commitmentsIn(draft(entry("D1", "- **Epic commitment affected:** none")))).toEqual([]);
        expect(commitmentsIn("# Decision Record: X\n\n## Summary\n\nText.\n")).toEqual([]);
    });
});

describe("matchCommitment — exact wording after whitespace and case only (D8)", () => {
    it("finds the new wording, bold markers included, across a different line wrap and case", () => {
        const body = `## Acceptance Criteria\n\n- [ ] **given** any record run, **when** the stage drafts, checks or files the record,\n  **then** it never edits the TEXT of the epic issue or of a story issue; moving the epic's labels is unchanged.\n`;
        expect(matchCommitment(body, { old: D10_OLD, new: D10_NEW })).toEqual({ newPresent: true, oldPresent: false });
    });

    it("finds only the old wording on an issue nobody changed", () => {
        const body = `- [ ] ${D10_OLD}\r\n`;
        expect(matchCommitment(body, { old: D10_OLD, new: D10_NEW })).toEqual({ newPresent: false, oldPresent: true });
    });

    it("does not accept the same words without their markdown", () => {
        const plain: string = D10_NEW.replace(/\*\*/g, "");
        expect(matchCommitment(plain, { old: D10_OLD, new: D10_NEW }).newPresent).toBe(false);
    });

    it("does not accept a change made in different words", () => {
        const body = "Records are not rewritten; the new format applies only to records filed for the first time after the release.";
        expect(matchCommitment(body, { old: D11_OLD, new: D11_NEW })).toEqual({ newPresent: false, oldPresent: false });
    });

    it("reads an empty old wording as an addition, with nothing old to find", () => {
        expect(matchCommitment("any body", { old: "", new: "a new line" })).toEqual({ newPresent: false, oldPresent: false });
    });

    it("normalises whitespace and case only", () => {
        expect(normaliseWording("  A\tB\n\nc  ")).toBe("a b c");
        expect(normaliseWording("“quoted”")).toBe("“quoted”");
    });
});
