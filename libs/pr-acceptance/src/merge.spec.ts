import * as fs from "node:fs";
import * as path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { MERGE_STRATEGIES, type MergeStrategy, mergeScenario } from "./merge.js";
import { type Route, callsMatching, fakeRunner, initRepo, makeTempDir, sh, writeCommit } from "./harness-fixtures.js";
import { defaultRunner } from "./run.js";

const tracked: string[] = [];
afterAll(() => {
    for (const d of tracked) fs.rmSync(d, { recursive: true, force: true });
});

/** A clone with a real merge commit on main and a feature branch still present locally. */
function clone(): { dir: string; mergeCommit: string; branch: string } {
    const dir = path.join(makeTempDir(tracked), "clone");
    initRepo(dir);
    const c0 = writeCommit(dir, "base.txt", "base\n", "C0");
    sh(dir, "git", "checkout", "-q", "-b", "acceptance/x", c0);
    writeCommit(dir, "f1.txt", "f1\n", "F1");
    sh(dir, "git", "checkout", "-q", "main");
    sh(dir, "git", "merge", "--no-ff", "-q", "-m", "Merge", "acceptance/x");
    return { dir, mergeCommit: sh(dir, "git", "rev-parse", "HEAD"), branch: "acceptance/x" };
}

function ctxFor(dir: string, routes: Route[]) {
    const run = fakeRunner(routes, defaultRunner);
    return { ctx: { run, clonePath: dir }, run };
}

const viewMerged = (oid: string): Route => ({
    match: "gh pr view",
    result: { stdout: JSON.stringify({ state: "MERGED", mergedAt: "2026-07-25T10:00:00Z", mergeCommit: { oid } }) },
});

describe("mergeScenario", () => {
    it.each(MERGE_STRATEGIES)("merges by %s and deletes the branch on the remote", (strategy: MergeStrategy) => {
        const c = clone();
        const { ctx, run } = ctxFor(c.dir, [{ match: "gh pr merge" }, viewMerged(c.mergeCommit), { match: "fetch --prune" }]);
        const r = mergeScenario(ctx, 13, strategy, c.branch);
        expect(r.ok ? "ok" : r.error).toBe("ok");
        if (!r.ok) return;
        expect(r.value.strategy).toBe(strategy);
        const call = callsMatching(run, "gh pr merge")[0];
        expect(call).toContain(`--${strategy}`);
        expect(call).toContain("--delete-branch");
    });

    it("reads the merge commit back off GitHub rather than reconstructing it", () => {
        const c = clone();
        const { ctx } = ctxFor(c.dir, [{ match: "gh pr merge" }, viewMerged(c.mergeCommit), { match: "fetch --prune" }]);
        const r = mergeScenario(ctx, 13, "merge", c.branch);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.mergeCommitOid).toBe(c.mergeCommit);
        expect(r.value.state).toBe("MERGED");
    });

    it("reports the merge commit's real parent count, which is what the range branches key on", () => {
        const c = clone();
        const { ctx } = ctxFor(c.dir, [{ match: "gh pr merge" }, viewMerged(c.mergeCommit), { match: "fetch --prune" }]);
        const r = mergeScenario(ctx, 13, "merge", c.branch);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.parentCount).toBe(2);
    });

    it("prunes the local branch, so post-branch-delete reachability is genuinely under test", () => {
        const c = clone();
        const { ctx } = ctxFor(c.dir, [{ match: "gh pr merge" }, viewMerged(c.mergeCommit), { match: "fetch --prune" }]);
        const r = mergeScenario(ctx, 13, "squash", c.branch);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.branchPruned).toBe(true);
        expect(sh(c.dir, "git", "branch", "--list")).not.toContain("acceptance/x");
    });

    it("fails when the merge itself is refused", () => {
        const c = clone();
        const { ctx, run } = ctxFor(c.dir, [
            { match: "gh pr merge", result: { status: 1, stderr: "Pull request is not mergeable" } },
        ]);
        const r = mergeScenario(ctx, 13, "rebase", c.branch);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("merge-failed");
        expect(r.error.message).toContain("not mergeable");
        expect(callsMatching(run, "gh pr view")).toEqual([]);
    });

    it("refuses to report success when GitHub gives back no merge commit", () => {
        const c = clone();
        const { ctx } = ctxFor(c.dir, [
            { match: "gh pr merge" },
            { match: "gh pr view", result: { stdout: JSON.stringify({ state: "OPEN", mergeCommit: null }) } },
        ]);
        const r = mergeScenario(ctx, 13, "squash", c.branch);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("merge-failed");
        expect(r.error.message).toContain("OPEN");
    });

    it("surfaces unparseable gh output instead of guessing a SHA", () => {
        const c = clone();
        const { ctx } = ctxFor(c.dir, [{ match: "gh pr merge" }, { match: "gh pr view", result: { stdout: "<html>" } }]);
        const r = mergeScenario(ctx, 13, "squash", c.branch);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("gh-failed");
    });
});

describe("mergeScenario — reading the merge back", () => {
    it("surfaces a gh failure when the merged PR cannot be re-read", () => {
        const c = clone();
        const { ctx } = ctxFor(c.dir, [
            { match: "gh pr merge" },
            { match: "gh pr view", result: { status: 1, stderr: "rate limited" } },
        ]);
        const r = mergeScenario(ctx, 13, "squash", c.branch);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("gh-failed");
        expect(r.error.message).toContain("rate limited");
    });

    it("reports the branch as unpruned when the local delete does not succeed", () => {
        const c = clone();
        const { ctx } = ctxFor(c.dir, [
            { match: "gh pr merge" },
            viewMerged(c.mergeCommit),
            { match: "fetch --prune" },
            { match: "branch -D", result: { status: 1, stderr: "no such branch" } },
        ]);
        const r = mergeScenario(ctx, 13, "squash", c.branch);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.branchPruned).toBe(false);
    });
});
