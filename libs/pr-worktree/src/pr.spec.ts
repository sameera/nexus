import { describe, expect, it } from "vitest";
import { resolvePr } from "./pr.js";
import { type RunResult, type Runner } from "./run.js";

/** A Runner that answers a single `gh pr view` with canned output. */
function ghRunner(result: Partial<RunResult>): Runner {
    return (cmd, args) => {
        if (cmd === "gh" && args[0] === "pr" && args[1] === "view") {
            return { status: 0, stdout: "", stderr: "", ...result };
        }
        return { status: 1, stdout: "", stderr: `unexpected ${cmd} ${args.join(" ")}` };
    };
}

const MERGED = JSON.stringify({
    state: "MERGED",
    mergedAt: "2026-07-20T10:00:00Z",
    baseRefOid: "b".repeat(40),
    headRefOid: "h".repeat(40),
    mergeCommit: { oid: "m".repeat(40) },
    commits: [{ oid: "1" }, { oid: "2" }],
    headRefName: "feature",
    url: "https://example.com/pr/7",
    isCrossRepository: false,
    author: { login: "dev" },
});

describe("resolvePr", () => {
    it("parses a merged PR", () => {
        const r = resolvePr(ghRunner({ stdout: MERGED }), "/repo", 7, { requireMerged: true });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.pr.merged).toBe(true);
        expect(r.pr.mergeCommitOid).toBe("m".repeat(40));
        expect(r.pr.commitCount).toBe(2);
        expect(r.pr.authorLogin).toBe("dev");
    });

    it("rejects an open PR when merged is required (close)", () => {
        const open = JSON.stringify({ state: "OPEN", mergedAt: null, mergeCommit: null, commits: [] });
        const r = resolvePr(ghRunner({ stdout: open }), "/repo", 7, { requireMerged: true });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("pr-not-merged");
    });

    it("accepts an open PR when merged is not required (analyze)", () => {
        const open = JSON.stringify({ state: "OPEN", mergedAt: null, mergeCommit: null, commits: [{ oid: "1" }] });
        const r = resolvePr(ghRunner({ stdout: open }), "/repo", 7, { requireMerged: false });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.pr.merged).toBe(false);
        expect(r.pr.mergeCommitOid).toBe(null);
    });

    it("maps a not-found gh error", () => {
        const r = resolvePr(ghRunner({ status: 1, stderr: "GraphQL: Could not resolve to a PullRequest" }), "/repo", 99, {
            requireMerged: false,
        });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("pr-not-found");
    });

    it("flags unparseable JSON", () => {
        const r = resolvePr(ghRunner({ stdout: "not json" }), "/repo", 7, { requireMerged: false });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("malformed-pr-json");
    });
});

describe("resolvePr — commit messages, where a per-story PR states its scope", () => {
    it("joins each commit's headline and body", () => {
        const stdout = JSON.stringify({
            state: "OPEN",
            mergedAt: null,
            mergeCommit: null,
            commits: [
                { oid: "1", messageHeadline: "analyze: accept a member PR", messageBody: "Closes #492" },
                { oid: "2", messageHeadline: "analyze: scope the run", messageBody: "Closes #493" },
            ],
        });
        const r = resolvePr(ghRunner({ stdout }), "/repo", 7, { requireMerged: false });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.pr.commitMessages).toEqual([
            "analyze: accept a member PR\n\nCloses #492",
            "analyze: scope the run\n\nCloses #493",
        ]);
    });

    it("keeps a commit that has a headline and no body", () => {
        const stdout = JSON.stringify({
            state: "OPEN",
            mergedAt: null,
            mergeCommit: null,
            commits: [{ oid: "1", messageHeadline: "chore: tidy", messageBody: "" }],
        });
        const r = resolvePr(ghRunner({ stdout }), "/repo", 7, { requireMerged: false });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.pr.commitMessages).toEqual(["chore: tidy"]);
    });

    it("reads no commit messages off a PR whose commits carry none", () => {
        const r = resolvePr(ghRunner({ stdout: MERGED }), "/repo", 7, { requireMerged: true });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.pr.commitMessages).toEqual([]);
    });
});
