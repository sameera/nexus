/**
 * The close gate's reader of the shipped ledger (epic #769, story #773, decision record #777, key
 * decision "The close gate takes merge state and range from the ledger, and checks only
 * merge-commit identity live").
 *
 * Merge state is not asked of the platform any more. Asking gave a wrong answer whenever the
 * question went to the wrong repository — merged work read back as unmerged — and it was never a
 * question worth asking: a record exists only because a run saw the merge. The range is not derived
 * here either. It was stamped while the conformance gate held the merged code, which is what lets
 * the close gate close an epic whose code merged in a repository the lead holds no copy of.
 *
 * One live question remains, and it is a hard block with no waiver: does the platform still report
 * the same merge commit for each recorded pull request? A merge commit that moved means the
 * recorded range describes commits that are not on the trunk, and no judgment a lead could make
 * would change that. It needs the network and nothing else — never a checkout of the repository the
 * pull request merged in.
 */

import { sameRepo } from "@nexus/workspace/issue-ref";
import { type ShippedRecord } from "./ledger.js";
import { type Runner } from "./run.js";

/** One entry of the close record's range, attributed to the repository its record names. */
export interface LedgerRangeEntry {
    /** The repository the pull request merged in — never the repository the close was started from. */
    repo: string;
    pr: number;
    base: string;
    head: string;
}

export interface LedgerMergeState {
    repo: string;
    pr: number;
    /** Always true: a record exists only for a pull request a gate run saw merged. */
    merged: boolean;
    /** The merge commit the record stamped. */
    mergeCommit: string;
}

export type LedgerBlock =
    /** The platform no longer reports the merge commit the record stamped (invariant 6). */
    | { kind: "merge-commit-moved"; repo: string; pr: number; recorded: string; reported: string | null }
    /** A live story with no record and no exclusion marker (invariant 7). */
    | { kind: "story-unrecorded"; story: number };

export interface LedgerCloseGate {
    /** Every recorded pull request's merge state, taken from the ledger. */
    merged: LedgerMergeState[];
    /** The close record's range, one entry per recorded pull request. */
    range: LedgerRangeEntry[];
    blocking: LedgerBlock[];
    /** True when nothing blocks — never a waiver, on either axis. */
    ok: boolean;
}

export interface LedgerCloseGateInput {
    /** The epic's live story set. */
    stories: number[];
    /** Stories marked as shipping without a pull request of their own. */
    excluded?: number[];
    records: readonly ShippedRecord[];
}

/**
 * Ask the platform what merge commit it reports for `pr` in `repo` now. Null when it reports none,
 * or when the question could not be asked — both are "not the recorded commit", which is the only
 * answer this gate acts on.
 */
function reportedMergeCommit(run: Runner, cwd: string, repo: string, pr: number): string | null {
    const r = run("gh", ["pr", "view", String(pr), "--repo", repo, "--json", "mergeCommit", "--jq", ".mergeCommit.oid"], { cwd });
    if (r.status !== 0) return null;
    const oid = r.stdout.trim();
    return oid.length > 0 && oid !== "null" ? oid : null;
}

/** Decide merge state, the close range, and what blocks, from the epic's records alone. */
export function ledgerCloseGate(run: Runner, cwd: string, input: LedgerCloseGateInput): LedgerCloseGate {
    const excluded = input.excluded ?? [];
    const records = orderRecords(input.records);

    const merged: LedgerMergeState[] = records.map((r) => ({ repo: r.repo, pr: r.pr, merged: true, mergeCommit: r.mergeCommit }));
    const range: LedgerRangeEntry[] = records.map((r) => ({ repo: r.repo, pr: r.pr, base: r.base, head: r.head }));
    const blocking: LedgerBlock[] = [];

    for (const r of records) {
        const reported = reportedMergeCommit(run, cwd, r.repo, r.pr);
        if (reported === null || reported !== r.mergeCommit) {
            blocking.push({ kind: "merge-commit-moved", repo: r.repo, pr: r.pr, recorded: r.mergeCommit, reported });
        }
    }

    for (const story of [...input.stories].sort((a, b) => a - b)) {
        if (excluded.includes(story)) continue;
        if (!records.some((r) => r.stories.includes(story))) blocking.push({ kind: "story-unrecorded", story });
    }

    return { merged, range, blocking, ok: blocking.length === 0 };
}

/** The records in a deterministic order: repository, then pull-request number. */
function orderRecords(records: readonly ShippedRecord[]): ShippedRecord[] {
    return [...records].sort((a, b) => (sameRepo(a.repo, b.repo) ? a.pr - b.pr : a.repo.localeCompare(b.repo)));
}
