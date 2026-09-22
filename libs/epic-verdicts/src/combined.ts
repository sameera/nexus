/**
 * The epic's combined change set — the union of each recorded pull request's own change set, read
 * without a worktree (decision record #505, key decision "The combined code is the union of the
 * pull requests' own change sets, read without a worktree and never stamped"). The ranges come
 * from the epic's records (epic #769), never from a published review.
 *
 * Each pull request contributes its own three-dot diff, over the range its record stamped —
 * never a range spanning two pull requests, and nothing derived from the merge-anchored range
 * helper (`@nexus/pr-worktree/range`), which requires every pull request merged first and would
 * give the epic a second stamped range where #213 is meant to be the only one. Fetching reuses
 * `fetchPrHead` rather than a second fetch implementation: diffing needs no working tree, so
 * several worktrees would just be several checkouts created and destroyed for text the object
 * store already has once the head is fetched.
 */

import { fetchPrHead } from "@nexus/pr-worktree/range-read";
import { type LedgerRangeEntry } from "./close-ledger.js";
import { type EpicVerdictsDiagnostic } from "./diagnostic.js";
import { type Runner, git } from "./run.js";

export interface PrChangeSet {
    repo: string;
    pr: number;
    files: string[];
}

export interface CombinedChangeSet {
    /** The union of every pull request's changed files, sorted and de-duplicated. */
    files: string[];
    perPr: PrChangeSet[];
}

export type CombinedChangeSetResult = { ok: true; combined: CombinedChangeSet } | { ok: false; error: EpicVerdictsDiagnostic };

function distinctEntries(entries: readonly LedgerRangeEntry[]): LedgerRangeEntry[] {
    const seen = new Set<string>();
    const out: LedgerRangeEntry[] = [];
    for (const e of entries) {
        const key = `${e.repo}#${e.pr}@${e.head}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(e);
    }
    return out;
}

/**
 * Union every distinct record's own `base...head` range, fetching each pull request's head first.
 *
 * `excludePathspecs` withholds the pipeline stores (decision record #505, invariant 5): the caller
 * passes the toolkit's one exclusion set (`@nexus/portable-tools` pipeline-stores.ts's
 * `excludePathspecs()`) rather than this module stating its own copy of the store list.
 */
export function combinedChangeSet(
    run: Runner,
    cwd: string,
    entries: readonly LedgerRangeEntry[],
    excludePathspecs: string[],
): CombinedChangeSetResult {
    const perPr: PrChangeSet[] = [];
    const union = new Set<string>();

    for (const v of distinctEntries(entries)) {
        const fetchedHead = fetchPrHead(run, cwd, v.pr);
        if (fetchedHead === undefined) {
            return {
                ok: false,
                error: { problem: "gh-failed", message: `could not fetch pull request #${v.pr}'s head into ${cwd}` },
            };
        }
        const diffOutput = git(run, cwd, "diff", "--name-only", `${v.base}...${v.head}`, "--", ".", ...excludePathspecs);
        if (diffOutput === null) {
            return {
                ok: false,
                error: { problem: "gh-failed", message: `could not diff pull request #${v.pr}'s change set (${v.base}...${v.head}) in ${cwd}` },
            };
        }
        const files = diffOutput
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0)
            .sort();
        perPr.push({ repo: v.repo, pr: v.pr, files });
        for (const f of files) union.add(f);
    }

    return { ok: true, combined: { files: [...union].sort(), perPr } };
}
