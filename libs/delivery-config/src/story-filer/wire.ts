/**
 * Pass 2: the ordering the author wrote becomes real dependency edges (story #371).
 *
 * A batch wires its edges from refs because no issue numbers exist yet, but an edge can also point
 * *out* of the batch, at work already filed — which a migration of historical dependencies can only
 * express as a literal `#<n>`. The `#` sigil is what says "issue number": a bare number is
 * indistinguishable from a batch ref and is deliberately not matched.
 *
 * The map is built once, from this run and the ledger together, so a blocker created hours ago in a
 * prior run still resolves — that is what makes a resumed run correct rather than merely quiet.
 */

import { type ToolkitIo } from "../io.js";
import { type CreatedRecord } from "./create.js";
import { type Ledger } from "./ledger.js";
import { type Platform } from "./platform.js";

/** A dependency reference naming an issue that already exists, rather than one this batch creates. */
const LITERAL_REF = /^#(\d+)$/;

/**
 * Normalized ref → the blocker's REST database id, spanning this run and every prior one.
 *
 * This run's records win over the ledger's, since a backfilled id is the fresher answer.
 */
export function refToDbId(created: CreatedRecord[], ledger: Ledger): Map<string, string> {
    const map: Map<string, string> = new Map();
    for (const record of created) if (record.dbId) map.set(record.ref, record.dbId);
    for (const [ref, entry] of Object.entries(ledger)) {
        if (entry.db_id && !map.has(ref)) map.set(ref, entry.db_id);
    }
    return map;
}

export interface WireResult {
    wired: number;
    /** Edges the platform already carried — a re-run re-checks rather than re-applies. */
    present: number;
    /** `[dependent issue number, the ref that resolved to nothing]`. */
    unresolved: [string, string][];
    failed: [string, string][];
}

export function wirePass(
    created: CreatedRecord[],
    refMap: Map<string, string>,
    platform: Platform,
    io: ToolkitIo,
): WireResult {
    const result: WireResult = { wired: 0, present: 0, unresolved: [], failed: [] };

    for (const record of created) {
        if (record.number === null || record.blockedBy.length === 0) continue;
        const number: string = record.number;
        const existing: Set<string> | null = platform.blockedByDbIds(number);

        for (const ref of record.blockedBy) {
            const literal: RegExpExecArray | null = LITERAL_REF.exec(ref);
            const blockerDbId: string | null =
                refMap.get(ref) ?? (literal !== null ? platform.issueDbId(literal[1]) : null);
            if (blockerDbId === null || blockerDbId === "") {
                io.stderr(`  Unresolved: blocked_by ref '${ref}' for #${number} not among created issues`);
                result.unresolved.push([number, ref]);
                continue;
            }
            if (!refMap.has(ref)) refMap.set(ref, blockerDbId);
            if (existing !== null && existing.has(String(blockerDbId))) {
                result.present++;
                continue;
            }
            if (platform.addBlockedBy(number, blockerDbId)) {
                io.stdout(`  #${number} blocked_by ref '${ref}'`);
                result.wired++;
            } else {
                result.failed.push([number, ref]);
            }
        }
    }
    return result;
}
