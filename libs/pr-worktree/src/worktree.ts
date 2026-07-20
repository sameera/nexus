/**
 * Git-worktree lifecycle for the --pr flow.
 *
 * analyze runs its conformance read against a detached worktree at the PR head
 * (fetched via `pull/<N>/head`, so forks work); close runs its phases in a
 * worktree on a fresh `distill/*` branch cut from the trunk, which distill later
 * continues in. All worktrees live under one deterministic base per repo so a
 * re-run (aborted checkpoint, transient gh failure) reuses the same path instead
 * of colliding. Removal is force + prune and is always run from the MAIN worktree,
 * so a caller standing inside the target can still remove it.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { type PrWorktreeDiagnostic } from "./diagnostic.js";
import { type Runner, git } from "./run.js";

export type WorktreeResult =
    | { ok: true; wtPath: string; head?: string }
    | { ok: false; error: PrWorktreeDiagnostic };

function fail(problem: PrWorktreeDiagnostic["problem"], message: string): WorktreeResult {
    return { ok: false, error: { problem, message } };
}

/** One deterministic worktree base per repo checkout (stable across re-runs). */
export function worktreeBase(repoRoot: string): string {
    const slug = path.resolve(repoRoot).replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return path.join(os.tmpdir(), "nexus-pr-worktrees", slug || "repo");
}

function branchSlug(branch: string): string {
    return branch.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function listWorktrees(run: Runner, fromDir: string): string[] {
    const out = git(run, fromDir, "worktree", "list", "--porcelain") ?? "";
    return out
        .split("\n")
        .filter((l) => l.startsWith("worktree "))
        .map((l) => path.resolve(l.slice("worktree ".length)));
}

function isRegistered(run: Runner, fromDir: string, wtPath: string): boolean {
    return listWorktrees(run, fromDir).includes(path.resolve(wtPath));
}

/** The repo's primary worktree — the safe cwd for `git worktree` mutations. */
function mainWorktree(run: Runner, fromDir: string): string {
    const all = listWorktrees(run, fromDir);
    return all[0] ?? fromDir;
}

/**
 * Analyze: a detached worktree at the PR head. Returns the actually-fetched
 * commit as `head` (record this as the receipt head — it is the commit the
 * analysis truly reads, which a race between `gh pr view` and the fetch could
 * make differ from headRefOid).
 */
export function openAnalyzeWorktree(run: Runner, repoRoot: string, prNumber: number): WorktreeResult {
    const fetch = run("git", ["fetch", "origin", `pull/${prNumber}/head`], { cwd: repoRoot });
    if (fetch.status !== 0) {
        return fail("git-failed", `git fetch origin pull/${prNumber}/head failed: ${fetch.stderr.trim()}`);
    }
    const fetchHead = git(run, repoRoot, "rev-parse", "--verify", "FETCH_HEAD");
    if (fetchHead === null) {
        return fail("git-failed", `could not resolve FETCH_HEAD after fetching PR #${prNumber}.`);
    }

    const wtPath = path.join(worktreeBase(repoRoot), `pr-${prNumber}-analyze`);
    if (isRegistered(run, repoRoot, wtPath)) {
        const co = run("git", ["-C", wtPath, "checkout", "--detach", "-f", fetchHead], { cwd: repoRoot });
        if (co.status !== 0) {
            return fail(
                "worktree-conflict",
                `existing analyze worktree at ${wtPath} could not be reset to ${fetchHead}: ${co.stderr.trim()}. Remove it (git worktree remove --force ${wtPath}) and retry.`,
            );
        }
        return { ok: true, wtPath, head: fetchHead };
    }
    if (fs.existsSync(wtPath)) {
        return fail("worktree-conflict", `${wtPath} exists but is not a registered git worktree; remove it and retry.`);
    }
    fs.mkdirSync(path.dirname(wtPath), { recursive: true });
    const add = run("git", ["worktree", "add", "--detach", wtPath, fetchHead], { cwd: repoRoot });
    if (add.status !== 0) {
        return fail("worktree-add-failed", `git worktree add ${wtPath} failed: ${add.stderr.trim()}`);
    }
    return { ok: true, wtPath, head: fetchHead };
}

/**
 * Close: a worktree on `branch`, cut from the trunk (post-merge state). Idempotent
 * — reuses the worktree/branch if a prior run created them.
 */
export function openCloseWorktree(
    run: Runner,
    repoRoot: string,
    branch: string,
    trunkRef = "origin/main",
): WorktreeResult {
    // Best-effort refresh of the trunk; offline falls back to the local ref below.
    run("git", ["fetch", "origin", "main"], { cwd: repoRoot });
    const trunk =
        git(run, repoRoot, "rev-parse", "--verify", trunkRef) ??
        git(run, repoRoot, "rev-parse", "--verify", "main");
    if (trunk === null) {
        return fail("git-failed", `neither ${trunkRef} nor main resolves in ${repoRoot}.`);
    }

    const wtPath = path.join(worktreeBase(repoRoot), branchSlug(branch));
    if (isRegistered(run, repoRoot, wtPath)) {
        return { ok: true, wtPath };
    }
    if (fs.existsSync(wtPath)) {
        return fail("worktree-conflict", `${wtPath} exists but is not a registered git worktree; remove it and retry.`);
    }
    fs.mkdirSync(path.dirname(wtPath), { recursive: true });

    const branchExists = git(run, repoRoot, "rev-parse", "--verify", `refs/heads/${branch}`) !== null;
    const args = branchExists
        ? ["worktree", "add", wtPath, branch] // branch created on a prior run — check it out
        : ["worktree", "add", "-b", branch, wtPath, trunk];
    const add = run("git", args, { cwd: repoRoot });
    if (add.status !== 0) {
        return fail("worktree-add-failed", `git worktree add for branch ${branch} failed: ${add.stderr.trim()}`);
    }
    return { ok: true, wtPath };
}

/** Remove a worktree (force + prune), run from the main worktree so a caller inside the target can still remove it. */
export function removeWorktree(run: Runner, fromDir: string, wtPath: string): WorktreeResult {
    const main = mainWorktree(run, fromDir);
    if (isRegistered(run, fromDir, wtPath)) {
        run("git", ["worktree", "remove", "--force", wtPath], { cwd: main });
    }
    run("git", ["worktree", "prune"], { cwd: main });
    if (isRegistered(run, fromDir, wtPath)) {
        return fail(
            "worktree-remove-failed",
            `could not remove worktree ${wtPath}; remove it manually (git worktree remove --force ${wtPath}).`,
        );
    }
    return { ok: true, wtPath };
}
