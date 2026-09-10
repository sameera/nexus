/**
 * The merge gate — the PR-merged half of the close gate for an epic that shipped as several pull
 * requests (issue #500, decision record #509). Sub-issue-closed is Phase 1.1's existing job; this
 * checks a narrower, separate fact: whether every story's pull request is actually merged.
 *
 * Deliberately not folded into `checkEpicCurrency` (record #505's shared trust/recency program):
 * merge state is a hard gate with no waiver, while currency is a reported staleness the lead can
 * choose to waive. Collapsing them would either grow a waiver path for an unmerged PR (which the
 * acceptance criteria forbid) or drop currency's waiver for a case that should keep it.
 */

import { type EpicReceipt } from "./receipt.js";
import { type Runner } from "./run.js";

export interface StoryMergeState {
    story: number;
    repo: string;
    pr: number;
    merged: boolean;
    /** GitHub's raw PR state string ("OPEN", "MERGED", "CLOSED", or "UNKNOWN" when `gh` failed), for diagnostics. */
    state: string;
}

export interface EpicMergeGate {
    stories: StoryMergeState[];
    allMerged: boolean;
    unmerged: StoryMergeState[];
}

function prMergeState(run: Runner, cwd: string, pr: number): { state: string; merged: boolean } {
    const r = run("gh", ["pr", "view", String(pr), "--json", "state,mergedAt"], { cwd });
    if (r.status !== 0) return { state: "UNKNOWN", merged: false };
    try {
        const doc = JSON.parse(r.stdout) as Record<string, unknown>;
        const state = typeof doc["state"] === "string" ? doc["state"] : "UNKNOWN";
        const mergedAt = doc["mergedAt"];
        const merged = typeof mergedAt === "string" && mergedAt.length > 0;
        return { state, merged };
    } catch {
        return { state: "UNKNOWN", merged: false };
    }
}

/** Check every story pull request's merge state, naming each one still unmerged — never a crash. */
export function checkEpicMergeGate(run: Runner, cwd: string, receipt: EpicReceipt): EpicMergeGate {
    const stories: StoryMergeState[] = receipt.stories.map((s) => {
        const { state, merged } = prMergeState(run, cwd, s.pr);
        return { story: s.story, repo: s.repo, pr: s.pr, merged, state };
    });
    const unmerged = stories.filter((s) => !s.merged);
    return { stories, allMerged: unmerged.length === 0, unmerged };
}
