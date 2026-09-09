/**
 * The epic's combined change set — the union of each story pull request's own change set, read
 * without a worktree (decision record #505, key decision "The combined code is the union of the
 * pull requests' own change sets, read without a worktree and never stamped").
 *
 * Each pull request contributes its own three-dot diff, base to the head its verdict stamped —
 * never a range spanning two pull requests, and nothing derived from the merge-anchored range
 * helper (`@nexus/pr-worktree/range`), which requires every pull request merged first and would
 * give the epic a second stamped range where #213 is meant to be the only one. Fetching reuses
 * `fetchPrHead` rather than a second fetch implementation: diffing needs no working tree, so
 * several worktrees would just be several checkouts created and destroyed for text the object
 * store already has once the head is fetched.
 */

import { fetchPrHead } from "@nexus/pr-worktree/range-read";
import { type EpicVerdictsDiagnostic } from "./diagnostic.js";
import { type Runner, git } from "./run.js";
import { type StoryVerdict } from "./verdict.js";

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

function distinctVerdicts(verdicts: StoryVerdict[]): StoryVerdict[] {
    const seen = new Set<string>();
    const out: StoryVerdict[] = [];
    for (const v of verdicts) {
        const key = `${v.repo}#${v.pr}@${v.head}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(v);
    }
    return out;
}

/**
 * Union every distinct verdict's own `base...head` diff, fetching each pull request's head first.
 *
 * `excludePathspecs` withholds the pipeline stores (decision record #505, invariant 5): the caller
 * passes the toolkit's one exclusion set (`@nexus/portable-tools` pipeline-stores.ts's
 * `excludePathspecs()`) rather than this module stating its own copy of the store list.
 */
export function combinedChangeSet(
    run: Runner,
    cwd: string,
    verdicts: StoryVerdict[],
    excludePathspecs: string[],
): CombinedChangeSetResult {
    const perPr: PrChangeSet[] = [];
    const union = new Set<string>();

    for (const v of distinctVerdicts(verdicts)) {
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
