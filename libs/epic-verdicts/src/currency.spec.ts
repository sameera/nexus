import { describe, expect, it } from "vitest";
import { checkEpicCurrency, checkStoryCurrency } from "./currency.js";
import { type Runner } from "./run.js";
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
            findings: { critical: 0, high: 0, medium: 0, low: 0 },
            repo: "acme/widget",
            stories: [over.story],
            record: "#505",
            recordHash: "e".repeat(64),
        },
        ...over,
    };
}

function ghRunner(headByPr: Record<number, string>): Runner {
    return (cmd, args) => {
        if (cmd === "gh" && args[0] === "pr" && args[1] === "view") {
            const n = Number(args[2]);
            const head = headByPr[n];
            if (head === undefined) return { status: 1, stdout: "", stderr: "not found" };
            return { status: 0, stdout: JSON.stringify({ headRefOid: head }), stderr: "" };
        }
        return { status: 1, stdout: "", stderr: `unexpected: ${cmd} ${args.join(" ")}` };
    };
}

describe("checkStoryCurrency — both staleness axes, per story, never collapsed (decision record #505)", () => {
    it("reports current on both axes when the analyzed head matches the PR head and the record digest matches", () => {
        const v = verdict({ story: 496, pr: 501 });
        const run = ghRunner({ 501: "a".repeat(40) });
        const r = checkStoryCurrency(run, "/repo", v, { currentRecordDigest: "e".repeat(64) });
        expect(r.codeCurrent).toBe(true);
        expect(r.recordCurrent).toBe(true);
    });

    it("reports code-stale when a commit landed on the pull request after analysis", () => {
        const v = verdict({ story: 496, pr: 501 });
        const run = ghRunner({ 501: "f".repeat(40) });
        const r = checkStoryCurrency(run, "/repo", v, { currentRecordDigest: "e".repeat(64) });
        expect(r.codeCurrent).toBe(false);
        expect(r.recordCurrent).toBe(true);
    });

    it("reports record-stale when the decision record was revised after analysis", () => {
        const v = verdict({ story: 496, pr: 501 });
        const run = ghRunner({ 501: "a".repeat(40) });
        const r = checkStoryCurrency(run, "/repo", v, { currentRecordDigest: "0".repeat(64) });
        expect(r.codeCurrent).toBe(true);
        expect(r.recordCurrent).toBe(false);
    });

    it("reports both axes stale at once, independently", () => {
        const v = verdict({ story: 496, pr: 501 });
        const run = ghRunner({ 501: "f".repeat(40) });
        const r = checkStoryCurrency(run, "/repo", v, { currentRecordDigest: "0".repeat(64) });
        expect(r.codeCurrent).toBe(false);
        expect(r.recordCurrent).toBe(false);
    });

    it("treats a verdict with no record stamp as record-stale once the epic has an approved record", () => {
        const v = verdict({ story: 496, pr: 501 });
        v.receipt.recordHash = null;
        const run = ghRunner({ 501: "a".repeat(40) });
        const r = checkStoryCurrency(run, "/repo", v, { currentRecordDigest: "e".repeat(64) });
        expect(r.recordCurrent).toBe(false);
    });

    it("has no record axis to fail when the epic carries no record at all", () => {
        const v = verdict({ story: 496, pr: 501 });
        v.receipt.recordHash = null;
        const run = ghRunner({ 501: "a".repeat(40) });
        const r = checkStoryCurrency(run, "/repo", v, { currentRecordDigest: null });
        expect(r.recordCurrent).toBe(true);
    });
});

describe("checkEpicCurrency — every stale story named separately, never collapsed into one epic-wide statement", () => {
    it("names each stale story independently", () => {
        const verdicts = [verdict({ story: 496, pr: 501 }), verdict({ story: 497, pr: 502 })];
        const run = ghRunner({ 501: "f".repeat(40), 502: "a".repeat(40) });
        const r = checkEpicCurrency(run, "/repo", verdicts, { currentRecordDigest: "e".repeat(64) });
        expect(r.allCurrent).toBe(false);
        expect(r.stories.find((s) => s.story === 496)?.codeCurrent).toBe(false);
        expect(r.stories.find((s) => s.story === 497)?.codeCurrent).toBe(true);
    });

    it("reports allCurrent when every story is current on both axes", () => {
        const verdicts = [verdict({ story: 496, pr: 501 }), verdict({ story: 497, pr: 502 })];
        const run = ghRunner({ 501: "a".repeat(40), 502: "a".repeat(40) });
        const r = checkEpicCurrency(run, "/repo", verdicts, { currentRecordDigest: "e".repeat(64) });
        expect(r.allCurrent).toBe(true);
    });
});
