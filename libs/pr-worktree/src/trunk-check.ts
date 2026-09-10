/**
 * Verify a trunk ref actually contains every stamped story-PR head before anything is cut from it
 * (epic #213, story #503; decision record #509).
 *
 * `openCloseWorktree`'s trunk refresh is best-effort (`git fetch origin main`, falling back to the
 * local `main` if offline) and a reused branch from a prior run is not re-checked at all. With one
 * pull request that was always safe: the PR must be merged before `deriveRange` succeeds, and the
 * worktree fetches trunk fresh right before cutting, so ordering alone guaranteed the head landed.
 * With several pull requests merged close together, a `git fetch origin main` can land a trunk ref
 * that includes an earlier PR's merge but was fetched before a later one propagated — silently
 * cutting a branch that is missing a story's code while the stamped `range:` list still claims it
 * landed. This check makes that assumption explicit and verified instead of implicit and assumed.
 *
 * Read-only and cheap (`git merge-base --is-ancestor` per item), so it short-circuits on the first
 * failure rather than collecting every one — there is nothing to clean up when nothing was created,
 * the same property `deriveRangeList` already relies on for its own all-or-nothing shape.
 */

import { type PrWorktreeDiagnostic } from "./diagnostic.js";
import { type Runner } from "./run.js";

export interface TrunkCheckItem {
    /** The pull request this head was stamped from. */
    pr: number;
    /** The commit — normally a merge commit — that must be an ancestor of the trunk ref. */
    head: string;
}

export type VerifyTrunkResult = { ok: true } | { ok: false; error: PrWorktreeDiagnostic };

export function verifyTrunkContainsHeads(
    run: Runner,
    cwd: string,
    trunkRef: string,
    items: TrunkCheckItem[],
): VerifyTrunkResult {
    for (const item of items) {
        const anc = run("git", ["merge-base", "--is-ancestor", item.head, trunkRef], { cwd });
        if (anc.status !== 0) {
            return {
                ok: false,
                error: {
                    problem: "trunk-missing-head",
                    message:
                        `PR #${item.pr}'s stamped head ${item.head} is not an ancestor of trunk ref ${trunkRef}; ` +
                        `the local trunk is stale. Run 'git fetch origin main' and retry.`,
                },
            };
        }
    }
    return { ok: true };
}
