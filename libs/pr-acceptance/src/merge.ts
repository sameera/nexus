/**
 * Merge a seeded PR by one named strategy, then take the branch away.
 *
 * Each strategy is exercised on its **own** pull request — a PR merges once — and
 * each merged branch is deleted on the remote and pruned locally, because
 * post-branch-delete reachability is part of what is under test: the range must
 * anchor on commits that stay on the trunk after the branch is gone, and a stale
 * local ref would hide a failure to do so.
 *
 * The merge commit is read back from GitHub rather than assumed. Whether real
 * merges produce the parent counts and SHAs the injected-runner tests expect is
 * exactly the empirical question this exercise exists to answer, so the harness
 * reports what GitHub said and never reconstructs it.
 */

import { type Result, fail, ok } from "./diagnostic.js";
import { type Runner } from "./run.js";

export type MergeStrategy = "squash" | "merge" | "rebase";

export const MERGE_STRATEGIES: readonly MergeStrategy[] = ["squash", "merge", "rebase"];

const FLAG: Record<MergeStrategy, string> = {
    squash: "--squash",
    merge: "--merge",
    rebase: "--rebase",
};

export interface MergeOutcome {
    prNumber: number;
    strategy: MergeStrategy;
    /** What GitHub reports as the merge commit — read back, never reconstructed. */
    mergeCommitOid: string;
    state: string;
    /** Parents of the merge commit as git sees them on the trunk. */
    parentCount: number;
    branchPruned: boolean;
}

export interface MergeContext {
    run: Runner;
    clonePath: string;
}

export function mergeScenario(
    ctx: MergeContext,
    prNumber: number,
    strategy: MergeStrategy,
    branch: string,
): Result<MergeOutcome> {
    const { run, clonePath } = ctx;

    const merged = run("gh", ["pr", "merge", String(prNumber), FLAG[strategy], "--delete-branch"], { cwd: clonePath });
    if (merged.status !== 0) {
        return fail(
            "merge-failed",
            `gh pr merge ${prNumber} ${FLAG[strategy]} failed: ${merged.stderr.trim() || "unknown gh error"}`,
        );
    }

    const view = run("gh", ["pr", "view", String(prNumber), "--json", "state,mergedAt,mergeCommit"], { cwd: clonePath });
    if (view.status !== 0) {
        return fail("gh-failed", `gh pr view ${prNumber} after merge failed: ${view.stderr.trim()}`);
    }
    let state = "UNKNOWN";
    let mergeCommitOid = "";
    try {
        const doc = JSON.parse(view.stdout) as Record<string, unknown>;
        state = typeof doc["state"] === "string" ? doc["state"] : "UNKNOWN";
        const mc = doc["mergeCommit"];
        if (mc !== null && typeof mc === "object" && typeof (mc as Record<string, unknown>)["oid"] === "string") {
            mergeCommitOid = (mc as Record<string, string>)["oid"];
        }
    } catch (e) {
        return fail("gh-failed", `gh pr view ${prNumber} returned unparseable JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (mergeCommitOid === "") {
        return fail(
            "merge-failed",
            `PR #${prNumber} reports state ${state} with no merge commit after a ${strategy} merge; there is nothing to anchor a range on.`,
        );
    }

    // Take the branch away locally too — post-branch-delete reachability is under test.
    run("git", ["-C", clonePath, "fetch", "--prune", "origin"], { cwd: clonePath });
    const deleted = run("git", ["-C", clonePath, "branch", "-D", branch], { cwd: clonePath });

    const parents = run("git", ["-C", clonePath, "rev-list", "--parents", "-n", "1", mergeCommitOid], { cwd: clonePath });
    const parentCount = parents.status === 0 ? parents.stdout.trim().split(/\s+/).length - 1 : 0;

    return ok({
        prNumber,
        strategy,
        mergeCommitOid,
        state,
        parentCount,
        branchPruned: deleted.status === 0,
    });
}
