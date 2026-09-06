/**
 * Read a merged PR's trunk-permanent range without touching the worktree lifecycle.
 *
 * The close flow gets its range as a side effect of checking out a worktree, because close
 * needs the worktree anyway. The fix lane needs only the range: it commits nothing, so a
 * worktree would be a checkout created and destroyed for one JSON object. This read reuses
 * the same role gate, the same PR lookup and the same merge-safe derivation — a second range
 * derivation is exactly the subtle rule that would end up wrong in one of its two copies.
 *
 * The derivation runs in the checkout itself rather than a worktree. Both share one object
 * store, so the fetched PR head that disambiguates a squash from a rebase is reachable either
 * way; only the working tree differs, and the derivation reads no working tree.
 */

import { type PrWorktreeDiagnostic } from "./diagnostic.js";
import { resolveRole } from "./identity.js";
import { resolvePr } from "./pr.js";
import { deriveRange, type Range } from "./range.js";
import { type Runner, git } from "./run.js";

export interface RepoRange extends Range {
    /** Normalized host/owner/repo identity, as the close record's `range:` carries it. */
    repo: string;
}

export type ReadRangeResult =
    | { ok: true; range: RepoRange }
    | { ok: false; error: PrWorktreeDiagnostic };

/**
 * Fetch the PR head into the shared object store so the range derivation can verify against it.
 * Best-effort by contract: a deleted branch leaves it undefined, and the derivation then refuses
 * the ambiguous case rather than guessing.
 */
export function fetchPrHead(run: Runner, repoRoot: string, prNumber: number): string | undefined {
    const fetched = run("git", ["fetch", "origin", `pull/${prNumber}/head`], { cwd: repoRoot });
    if (fetched.status !== 0) return undefined;
    return git(run, repoRoot, "rev-parse", "--verify", "FETCH_HEAD") ?? undefined;
}

export function readRange(run: Runner, startDir: string, prNumber: number): ReadRangeResult {
    const role = resolveRole(startDir, run);
    if (!role.ok) return { ok: false, error: role.error };
    const { repoRoot, repoIdentity } = role.resolved;

    const pr = resolvePr(run, repoRoot, prNumber, { requireMerged: true });
    if (!pr.ok) return { ok: false, error: pr.error };

    const prHead: string | undefined = fetchPrHead(run, repoRoot, prNumber);
    const derived = deriveRange(run, repoRoot, pr.pr, { verifyAgainstPrHead: prHead });
    if (!derived.ok) return { ok: false, error: derived.error };

    return { ok: true, range: { repo: repoIdentity, base: derived.range.base, head: derived.range.head } };
}
