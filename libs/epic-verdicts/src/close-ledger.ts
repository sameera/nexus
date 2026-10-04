/**
 * The epic's findings, summed from its shipped records, for the derivation close still calls
 * (`nexus epic-verdicts derive`, epic #769, decision record #777).
 *
 * The ledger gate that once took merge state and the combined range from the records is gone: close
 * derives its ranges itself (epic #828, decision record #849, D8), and analyze's aggregate mode,
 * the last reader of that range, is removed (epic #829, story #859, decision record #871, D11).
 */

import { shippedRecordKey, type FindingCounts, type ShippedRecord } from "./ledger.js";

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
