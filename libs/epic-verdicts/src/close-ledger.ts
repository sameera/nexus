/**
 * The shipped ledger's reader for the ranges analyze's aggregate mode judges (epic #769, story
 * #773, decision record #777, key decision "The close gate takes merge state and range from the
 * ledger, and checks only merge-commit identity live").
 *
 * Close no longer runs this gate (epic #828, story #843, decision record #849, D8): it derives its
 * ranges itself, takes a record's stamped range verbatim where one exists, and blocks on a moved
 * recorded merge commit there (D2, G18). A story with no record no longer blocks anything, since
 * nothing writes records any more. Analyze's aggregate mode still takes its combined range from
 * here until #829 removes that mode (G15).
 *
 * The range is not derived here. It was stamped while the conformance gate held the merged code.
 * One live question remains: does the platform still report the same merge commit for each
 * recorded pull request? A merge commit that moved means the recorded range describes commits
 * that are not on the trunk. It needs the network and nothing else.
 */

import { sameRepo } from "@nexus/workspace/issue-ref";
import { shippedRecordKey, type FindingCounts, type ShippedRecord } from "./ledger.js";
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
    { kind: "merge-commit-moved"; repo: string; pr: number; recorded: string; reported: string | null };

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
    /**
     * The epic's live story set, and the stories marked as shipping without a pull request of
     * their own. Neither decides anything since story #843: a story with no record is not a block.
     */
    stories?: number[];
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

/** Decide merge state, the combined range, and what blocks, from the epic's records alone. */
export function ledgerCloseGate(run: Runner, cwd: string, input: LedgerCloseGateInput): LedgerCloseGate {
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

    return { merged, range, blocking, ok: blocking.length === 0 };
}

/**
 * The records in history order: the merge time each one stamped, then the repository and the
 * pull-request number to break a tie (invariant 14).
 *
 * The merge time is the platform's, recorded when the gate held the merged code, so ordering two
 * records of one story never needs a copy of the repository they merged in. Pull-request number is
 * not the order: two pull requests of one story can be numbered in one order and merged in the
 * other, and it is the merge order the range has to follow.
 */
function orderRecords(records: readonly ShippedRecord[]): ShippedRecord[] {
    return [...records].sort(
        (a, b) => a.mergedAt.localeCompare(b.mergedAt) || (sameRepo(a.repo, b.repo) ? a.pr - b.pr : a.repo.localeCompare(b.repo)),
    );
}

/**
 * The epic's findings, summed once per record (invariant 13).
 *
 * The unit is the record, not the story. A pull request that implements two stories was judged
 * once, so counting per record makes it count once without a de-duplication rule anyone has to
 * remember — and a story that shipped as two pull requests contributes both, because each is its
 * own record rather than two claimants on one per-story slot.
 */
export function sumLedgerFindings(records: readonly ShippedRecord[]): FindingCounts {
    const total: FindingCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    const seen = new Set<string>();
    for (const r of records) {
        const key = shippedRecordKey(r.repo, r.pr);
        if (seen.has(key)) continue;
        seen.add(key);
        for (const severity of Object.keys(total) as Array<keyof FindingCounts>) total[severity] += r.findings[severity] ?? 0;
    }
    return total;
}
