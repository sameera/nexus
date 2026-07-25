/**
 * Teardown: local-first, guarded, and idempotent.
 *
 * Local residue — worktrees, harness branches, the disposable clone — is what
 * leaks onto a maintainer's machine, so it is **always** removed: on keep-alive,
 * after a failed run, and on a second invocation. Nothing here needs state left
 * behind by provision; the targets are derived from the deterministic name, which
 * is the condition teardown is most often invoked in (the run that failed is
 * exactly the run that recorded nothing).
 *
 * Keep-alive suppresses only the remote delete, and prints the surviving URL so a
 * failed run can be inspected. The remote delete itself is permitted only behind
 * the name/owner/marker triple guard, and a missing repo is success, not an
 * error — teardown must converge, not throw, when run twice.
 *
 * Local removal is deliberately narrow: only worktrees under the harness's own
 * temp roots and only branches under the harness prefix are touched, so an
 * unrelated worktree in the maintainer's checkout is enumerated but never
 * removed.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resolveAuth } from "./capability.js";
import { type Result, fail, ok } from "./diagnostic.js";
import { verifyDeleteGuard } from "./guard.js";
import { cloneDir, evidenceDir, scratchIdentity } from "./names.js";
import { remoteState } from "./provision.js";
import { type Runner, git } from "./run.js";
import { HARNESS_BRANCH_PREFIX, type ResidueVerdict, verifyResidue } from "./verify.js";

/** Temp roots the harness and the pr-worktree helper create worktrees under. */
function harnessTempRoots(): string[] {
    return [path.join(os.tmpdir(), "nexus-pr-acceptance"), path.join(os.tmpdir(), "nexus-pr-worktrees")];
}

function isHarnessOwned(wtPath: string): boolean {
    const resolved = path.resolve(wtPath);
    return harnessTempRoots().some((root) => resolved === root || resolved.startsWith(root + path.sep));
}

function registeredWorktrees(run: Runner, repoDir: string): string[] {
    const out = git(run, repoDir, "worktree", "list", "--porcelain") ?? "";
    return out
        .split("\n")
        .filter((l) => l.startsWith("worktree "))
        .map((l) => path.resolve(l.slice("worktree ".length)))
        .slice(1);
}

export interface TeardownOptions {
    /** The Nexus checkout — swept for stray worktrees and harness branches. */
    sourceRepoRoot: string;
    /** Override the disposable clone's location (defaults to the deterministic path). */
    cloneDir?: string;
    /** Suppress only the remote delete; local residue is still removed. */
    keepAlive: boolean;
}

export interface TeardownReport {
    nameWithOwner: string;
    remoteDeleted: boolean;
    /** Set when keep-alive kept the repo, or when it was already gone. */
    survivingUrl: string | null;
    /** Everything removed locally, in the order it was removed. */
    removedLocal: string[];
    /** Where the run's emitted evidence still lives — teardown never destroys it. */
    evidencePath: string;
    residue: ResidueVerdict;
}

function removeLocalResidue(run: Runner, sourceRepoRoot: string, clonePath: string): string[] {
    const removed: string[] = [];

    // The clone's own worktrees first — close and distill leave one behind by design.
    if (fs.existsSync(path.join(clonePath, ".git"))) {
        for (const wt of registeredWorktrees(run, clonePath)) {
            run("git", ["-C", clonePath, "worktree", "remove", "--force", wt], { cwd: clonePath });
            removed.push(wt);
        }
        run("git", ["-C", clonePath, "worktree", "prune"], { cwd: clonePath });
    }

    // Stray registrations in the Nexus checkout, but only ones under the harness's roots.
    if (fs.existsSync(path.join(sourceRepoRoot, ".git"))) {
        for (const wt of registeredWorktrees(run, sourceRepoRoot)) {
            if (!isHarnessOwned(wt)) continue;
            run("git", ["-C", sourceRepoRoot, "worktree", "remove", "--force", wt], { cwd: sourceRepoRoot });
            removed.push(wt);
        }
        run("git", ["-C", sourceRepoRoot, "worktree", "prune"], { cwd: sourceRepoRoot });

        const branches = git(run, sourceRepoRoot, "branch", "--list", `${HARNESS_BRANCH_PREFIX}*`) ?? "";
        for (const raw of branches.split("\n")) {
            const branch = raw.replace(/^[*+]?\s*/, "").trim();
            if (branch === "" || !branch.startsWith(HARNESS_BRANCH_PREFIX)) continue;
            run("git", ["-C", sourceRepoRoot, "branch", "-D", branch], { cwd: sourceRepoRoot });
            removed.push(branch);
        }
    }

    if (fs.existsSync(clonePath)) {
        fs.rmSync(clonePath, { recursive: true, force: true });
        removed.push(clonePath);
    }
    return removed;
}

export function teardown(run: Runner, o: TeardownOptions): Result<TeardownReport> {
    const auth = resolveAuth(run, o.sourceRepoRoot);
    if (!auth.ok) return auth;
    const id = scratchIdentity(auth.value.login);
    const clonePath = o.cloneDir ?? cloneDir(auth.value.login);

    // Local first, unconditionally — this is the part that must never be skipped.
    const removedLocal = removeLocalResidue(run, o.sourceRepoRoot, clonePath);

    const state = remoteState(run, o.sourceRepoRoot, id.nameWithOwner);
    if (!state.ok) return state;

    let remoteDeleted = false;
    let survivingUrl: string | null = null;

    if (!state.value.exists) {
        // Already gone: teardown converges rather than erroring on a second run.
        survivingUrl = null;
    } else if (o.keepAlive) {
        survivingUrl = state.value.url || `https://github.com/${id.nameWithOwner}`;
    } else {
        const guard = verifyDeleteGuard({
            owner: id.owner,
            name: id.name,
            expectedOwner: auth.value.login,
            markerText: state.value.markerText,
        });
        if (!guard.ok) return { ok: false, error: guard.error };
        const deleted = run("gh", ["repo", "delete", id.nameWithOwner, "--yes"], { cwd: o.sourceRepoRoot });
        if (deleted.status !== 0) {
            return fail("gh-failed", `gh repo delete ${id.nameWithOwner} failed: ${deleted.stderr.trim()}`);
        }
        remoteDeleted = true;
    }

    const residue = verifyResidue(run, o.sourceRepoRoot, clonePath);
    if (!residue.ok) return residue;

    return ok({
        nameWithOwner: id.nameWithOwner,
        remoteDeleted,
        survivingUrl,
        removedLocal,
        evidencePath: evidenceDir(auth.value.login),
        residue: residue.value,
    });
}
