import { describe, expect, it } from "vitest";
import { checkEpicMergeGate } from "./merge-gate.js";
import { type EpicReceipt } from "./receipt.js";
import { type Runner } from "./run.js";

function receipt(stories: EpicReceipt["stories"]): EpicReceipt {
    return {
        epic: "#212",
        findings: { critical: 0, high: 0, medium: 0, low: 0 },
        stories,
        prs: stories.map((s) => ({ repo: s.repo, pr: s.pr })),
        excluded: [],
    };
}

function ghRunner(byPr: Record<number, { status: number; state?: string; mergedAt?: string | null }>): Runner {
    return (cmd, args) => {
        if (cmd === "gh" && args[0] === "pr" && args[1] === "view") {
            const n = Number(args[2]);
            const entry = byPr[n];
            if (!entry || entry.status !== 0) return { status: 1, stdout: "", stderr: "gh: pull request not found" };
            return {
                status: 0,
                stdout: JSON.stringify({ state: entry.state ?? "MERGED", mergedAt: entry.mergedAt ?? null }),
                stderr: "",
            };
        }
        return { status: 1, stdout: "", stderr: `unexpected: ${cmd} ${args.join(" ")}` };
    };
}

describe("checkEpicMergeGate — proceed only once every story pull request is merged (story #500, decision record #509)", () => {
    it("reports allMerged and an empty unmerged list when every story's pull request is merged", () => {
        const r = receipt([
            { story: 496, repo: "acme/widget", pr: 501, head: "a".repeat(40) },
            { story: 497, repo: "acme/widget", pr: 502, head: "c".repeat(40) },
        ]);
        const run = ghRunner({
            501: { status: 0, state: "MERGED", mergedAt: "2026-09-01T00:00:00Z" },
            502: { status: 0, state: "MERGED", mergedAt: "2026-09-02T00:00:00Z" },
        });
        const gate = checkEpicMergeGate(run, "/repo", r);
        expect(gate.allMerged).toBe(true);
        expect(gate.unmerged).toEqual([]);
        expect(gate.stories.every((s) => s.merged)).toBe(true);
    });

    it("names the story and pull request still open, and reports allMerged false", () => {
        const r = receipt([
            { story: 496, repo: "acme/widget", pr: 501, head: "a".repeat(40) },
            { story: 497, repo: "acme/widget", pr: 502, head: "c".repeat(40) },
        ]);
        const run = ghRunner({
            501: { status: 0, state: "MERGED", mergedAt: "2026-09-01T00:00:00Z" },
            502: { status: 0, state: "OPEN", mergedAt: null },
        });
        const gate = checkEpicMergeGate(run, "/repo", r);
        expect(gate.allMerged).toBe(false);
        expect(gate.unmerged).toEqual([{ story: 497, repo: "acme/widget", pr: 502, merged: false, state: "OPEN" }]);
    });

    it("treats a gh failure for one pull request as unmerged rather than crashing", () => {
        const r = receipt([{ story: 496, repo: "acme/widget", pr: 501, head: "a".repeat(40) }]);
        const run = ghRunner({});
        const gate = checkEpicMergeGate(run, "/repo", r);
        expect(gate.allMerged).toBe(false);
        expect(gate.unmerged).toEqual([{ story: 496, repo: "acme/widget", pr: 501, merged: false, state: "UNKNOWN" }]);
    });
});
