/**
 * Git-worktree lifecycle for the --pr flow.
 *
 * analyze runs its conformance read against a detached worktree at the PR head
 * (fetched via `pull/<N>/head`, so forks work); close runs its phases in a
 * worktree on a fresh `distill/*` branch cut from the trunk, which distill later
 * continues in. All worktrees live under one deterministic directory per repo so a
 * re-run (aborted checkpoint, transient gh failure) reuses the same path instead
 * of colliding. Removal is force + prune and is always run from the MAIN worktree,
 * so a caller standing inside the target can still remove it.
 *
 * The *base* those worktrees are created under is declared config (epic #178): the
 * `worktree-path` key of the publishing block, read across the shared resolver's
 * process seam. A checkout that declares nothing gets the system-temp base this flow
 * has always used, character for character.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { ghToolkitCommand } from "@nexus/workspace/gh-toolkit";
import { type PrWorktreeDiagnostic } from "./diagnostic.js";
import { type Runner, git } from "./run.js";

export type WorktreeResult =
    | { ok: true; wtPath: string; head?: string }
    | { ok: false; error: PrWorktreeDiagnostic };

function fail(problem: PrWorktreeDiagnostic["problem"], message: string): WorktreeResult {
    return { ok: false, error: { problem, message } };
}

/** The publishing-block key naming the directory worktrees are created under. */
const WORKTREE_PATH_KEY = "worktree-path";

/**
 * The built-in worktree base — the system-temp-derived parent, unchanged by epic #178.
 *
 * It stays here rather than in the resolver so "today's location" has exactly one definition: the
 * resolver reports a declared value or nothing, and nothing means this.
 */
export function builtinWorktreeBase(): string {
    return path.join(os.tmpdir(), "nexus-pr-worktrees");
}

/**
 * The per-checkout segment appended under every resolved base, declared or built-in.
 *
 * Appending it unconditionally is what makes the no-config path byte-identical (today's constant is
 * the built-in base with this segment underneath) and what keeps two checkouts pointed at one shared
 * base — a plausible layout, one worktrees directory in a home folder — from colliding on the same
 * PR number or distill branch name.
 */
function checkoutSegment(repoRoot: string): string {
    const slug = path.resolve(repoRoot).replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return slug || "repo";
}

/**
 * Normalize a declared base into an absolute path.
 *
 * The shared settings parser is a deliberately minimal line parser: it strips no quotes and does no
 * path handling. Both a quoted value and a home-shorthand value are far likelier for a path than for
 * the label and repo-name keys the block has held until now, and both would otherwise become a
 * literal directory named after the quote or the tilde. A relative value anchors on the repo root —
 * the working directory varies within a single run, so it is not a stable anchor.
 */
function normalizeDeclaredBase(raw: string, repoRoot: string): string {
    let value: string = raw.trim();
    const quoted: boolean =
        value.length >= 2 &&
        ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")));
    if (quoted) value = value.slice(1, -1).trim();
    if (value === "~" || value.startsWith("~/")) value = path.join(os.homedir(), value.slice(1));
    return path.resolve(repoRoot, value);
}

/**
 * Resolve the base directory the flow's worktrees are created under.
 *
 * `repoRoot` must be the MAIN checkout's root — never a worktree, and never anything derived from
 * pull-request content. The analyze worktree is created from a fetched PR head that may come from a
 * fork, so a base sourced from that content would let untrusted input choose where a checkout is
 * written. That is a security boundary, not a preference.
 *
 * An empty answer with a success exit means "not declared" and takes the built-in base. A resolver
 * *failure* stops the run: conflating the two would silently ignore a declared base and write a
 * commit-bearing checkout into the very temp directory the operator configured away from.
 */
export function resolveWorktreeBase(
    run: Runner,
    repoRoot: string,
): { ok: true; base: string } | { ok: false; error: PrWorktreeDiagnostic } {
    // Addressed by name (story #300): the resolver is the toolkit's own file, so it is looked
    // for where the toolkit is installed and never inside the repository being acted on.
    const invocation = ghToolkitCommand(["config", "resolve", WORKTREE_PATH_KEY, "--root", repoRoot]);
    if (!invocation.ok) {
        return { ok: false, error: { problem: "worktree-base-unresolved", message: invocation.message } };
    }
    const r = run(invocation.command, invocation.args, { cwd: repoRoot });
    if (r.status !== 0) {
        return {
            ok: false,
            error: {
                problem: "worktree-base-unresolved",
                message:
                    `the shared publishing resolver could not resolve '${WORKTREE_PATH_KEY}': ` +
                    `${r.stderr.trim() || "unknown error"}`,
            },
        };
    }
    const declared: string = r.stdout.trim();
    return { ok: true, base: declared ? normalizeDeclaredBase(declared, repoRoot) : builtinWorktreeBase() };
}

/** Whether `candidate` lies inside `repoRoot`'s working tree (the root itself counts). */
function isInsideWorkingTree(candidate: string, repoRoot: string): boolean {
    const rel: string = path.relative(path.resolve(repoRoot), candidate);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/**
 * Whether git ignores `candidate`.
 *
 * The question is asked of git itself so that every exclusion mechanism counts — the repo's
 * `.gitignore`, global excludes, and `info/exclude` — which is the operator's actual mental model of
 * "ignored". git answers correctly for absolute paths and for paths that do not exist yet, so
 * nothing has to be created to ask. A query that errors is treated as *not* ignored: we cannot
 * confirm the base is safe, and the failure this gate exists to prevent is silent.
 *
 * The path asked about is the per-checkout directory the flow will actually write, not the base
 * above it. A `worktrees/` ignore rule matches directories, and git cannot tell that a base which
 * does not exist yet is one — asking about a path *nested* under it gets the honest answer without
 * pre-creating anything.
 */
function gitIgnores(run: Runner, repoRoot: string, candidate: string): boolean {
    return run("git", ["-C", repoRoot, "check-ignore", "-q", candidate], { cwd: repoRoot }).status === 0;
}

/**
 * Resolve the base, refuse an unusable one, and return the per-checkout directory worktrees go in.
 *
 * Every worktree-opening path funnels through here, so the base is resolved identically within a run
 * (one declared base serves analyze, close, and distill's continuation alike) and the gate is
 * unbypassable. The checks run *before* anything is created: `/nxs.close --pr` commits and pushes
 * from inside its worktree, so a non-ignored in-repo base would sweep a full second checkout into
 * the repo's own index — and git will happily create such a worktree, so there is no later failure
 * to interpret. A rejected base leaves the checkout exactly as it was found.
 */
function prepareWorktreeDir(
    run: Runner,
    repoRoot: string,
): { ok: true; dir: string } | { ok: false; error: PrWorktreeDiagnostic } {
    const resolved = resolveWorktreeBase(run, repoRoot);
    if (!resolved.ok) return resolved;
    const base: string = resolved.base;
    const dir: string = path.join(base, checkoutSegment(repoRoot));

    if (isInsideWorkingTree(base, repoRoot) && !gitIgnores(run, repoRoot, dir)) {
        return {
            ok: false,
            error: {
                problem: "worktree-base-in-repo",
                message:
                    `the configured worktree base ${base} is inside this repository's working tree and git ` +
                    `does not ignore it; gitignore that path or move the base outside ${repoRoot}.`,
            },
        };
    }

    try {
        fs.mkdirSync(dir, { recursive: true });
    } catch (err) {
        return {
            ok: false,
            error: {
                problem: "worktree-base-uncreatable",
                message:
                    `the configured worktree base ${base} could not be created: ` +
                    `${err instanceof Error ? err.message : String(err)}. Fix the path or its permissions.`,
            },
        };
    }
    return { ok: true, dir };
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
    const prepared = prepareWorktreeDir(run, repoRoot);
    if (!prepared.ok) return prepared;

    const fetch = run("git", ["fetch", "origin", `pull/${prNumber}/head`], { cwd: repoRoot });
    if (fetch.status !== 0) {
        return fail("git-failed", `git fetch origin pull/${prNumber}/head failed: ${fetch.stderr.trim()}`);
    }
    const fetchHead = git(run, repoRoot, "rev-parse", "--verify", "FETCH_HEAD");
    if (fetchHead === null) {
        return fail("git-failed", `could not resolve FETCH_HEAD after fetching PR #${prNumber}.`);
    }

    const wtPath = path.join(prepared.dir, `pr-${prNumber}-analyze`);
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
    const prepared = prepareWorktreeDir(run, repoRoot);
    if (!prepared.ok) return prepared;

    // Best-effort refresh of the trunk; offline falls back to the local ref below.
    run("git", ["fetch", "origin", "main"], { cwd: repoRoot });
    const trunk =
        git(run, repoRoot, "rev-parse", "--verify", trunkRef) ??
        git(run, repoRoot, "rev-parse", "--verify", "main");
    if (trunk === null) {
        return fail("git-failed", `neither ${trunkRef} nor main resolves in ${repoRoot}.`);
    }

    const wtPath = path.join(prepared.dir, branchSlug(branch));
    if (isRegistered(run, repoRoot, wtPath)) {
        return { ok: true, wtPath };
    }
    if (fs.existsSync(wtPath)) {
        return fail("worktree-conflict", `${wtPath} exists but is not a registered git worktree; remove it and retry.`);
    }

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
