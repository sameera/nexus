/**
 * Derive one range entry per story pull request (issue #501, decision record #509).
 *
 * `readRange` already resolves the role, resolves one PR, fetches its head and derives its
 * merge-anchored range — the one range-deriving algorithm the decision record insists is called
 * once per pull request. This module never re-derives a range; it resolves the role once (a
 * member repo is refused up front, same as `readRange`) and then loops that same three-call
 * sequence over an ordered list of PR numbers, read-only, no worktree.
 *
 * All-or-nothing by contract: the first PR whose merge state or range cannot be verified stops the
 * whole derivation and returns that PR's own error — never a partial list, and never a repository
 * collapse. Entries are never merged/deduplicated per repository, even when several PRs share one:
 * a duplicate PR number in the input is simply derived twice, independently.
 */

import { type PrWorktreeDiagnostic } from "./diagnostic.js";
import { resolveRole } from "./identity.js";
import { resolvePr } from "./pr.js";
import { deriveRange } from "./range.js";
import { fetchPrHead, type RepoRange } from "./range-read.js";
import { type Runner } from "./run.js";

export interface RangeListItem extends RepoRange {
    /** The pull request this entry came from. */
    pr: number;
}

export type DeriveRangeListResult =
    | { ok: true; ranges: RangeListItem[] }
    | { ok: false; error: PrWorktreeDiagnostic };

export function deriveRangeList(run: Runner, startDir: string, prNumbers: number[]): DeriveRangeListResult {
    if (prNumbers.length === 0) {
        return {
            ok: false,
            error: { problem: "usage", message: "deriveRangeList requires at least one PR number; none were given." },
        };
    }

    const role = resolveRole(startDir, run);
    if (!role.ok) return { ok: false, error: role.error };
    const { repoRoot, repoIdentity } = role.resolved;

    const ranges: RangeListItem[] = [];
    for (const prNumber of prNumbers) {
        const pr = resolvePr(run, repoRoot, prNumber, { requireMerged: true });
        if (!pr.ok) return { ok: false, error: pr.error };

        const prHead: string | undefined = fetchPrHead(run, repoRoot, prNumber);
        const derived = deriveRange(run, repoRoot, pr.pr, { verifyAgainstPrHead: prHead });
        if (!derived.ok) return { ok: false, error: derived.error };

        ranges.push({ repo: repoIdentity, base: derived.range.base, head: derived.range.head, pr: prNumber });
    }

    return { ok: true, ranges };
}
