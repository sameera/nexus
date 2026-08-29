/**
 * The resume ledger (story #369).
 *
 * This is what makes a bulk filing safe to re-run: the issue exists on GitHub the moment it is
 * created, so a crash before the ledger records it is the one path that can produce a duplicate.
 * Its file name, location, key set and serialisation are frozen (Invariant 12) — a batch interrupted
 * under the retained Python implementation must resume under this one, and the reverse during
 * rollout, and anything less than a shape-identical ledger breaks that.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { type ToolkitIo } from "../io.js";

export const LEDGER_NAME = ".nxs-created.json";

export interface LedgerEntry {
    number?: string;
    db_id?: string | null;
    url?: string;
    title?: string;
}

export type Ledger = Record<string, LedgerEntry>;

export function ledgerPathFor(targetFolder: string): string {
    return path.join(targetFolder, LEDGER_NAME);
}

/**
 * Load the ledger. An unreadable or malformed one is treated as empty with a warning, never as a
 * failure (Invariant 5): the batch is still fileable, and the worst case is that already-created
 * issues are re-created — which the platform itself, not the ledger, is the record of.
 */
export function loadLedger(file: string, io: ToolkitIo): Ledger {
    if (!fs.existsSync(file)) return {};
    try {
        const data: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
        if (data === null || typeof data !== "object" || Array.isArray(data)) return {};
        return data as Ledger;
    } catch (error) {
        io.stderr(`Warning: ignoring unreadable manifest ${file}: ${error instanceof Error ? error.message : error}`);
        return {};
    }
}

/** Serialise with sorted keys and two-space indent — the shape the ledger has always been written in. */
export function serializeLedger(ledger: Ledger): string {
    const sorted: Ledger = {};
    for (const ref of Object.keys(ledger).sort()) {
        const entry: LedgerEntry = ledger[ref];
        const sortedEntry: Record<string, unknown> = {};
        for (const key of Object.keys(entry).sort()) sortedEntry[key] = (entry as Record<string, unknown>)[key];
        sorted[ref] = sortedEntry as LedgerEntry;
    }
    return JSON.stringify(sorted, null, 2);
}

/** Persist by atomic replace, so no crash can leave a partially written ledger (Invariant 3). */
export function saveLedger(file: string, ledger: Ledger, io: ToolkitIo): void {
    const temporary = `${file}.tmp`;
    try {
        fs.writeFileSync(temporary, serializeLedger(ledger), "utf8");
        fs.renameSync(temporary, file);
    } catch (error) {
        io.stderr(`Warning: could not persist manifest ${file}: ${error instanceof Error ? error.message : error}`);
    }
}

/** Drop the ledger after a clean run. A failure to remove it warns and nothing more. */
export function removeLedger(file: string, io: ToolkitIo): void {
    if (!fs.existsSync(file)) return;
    try {
        fs.unlinkSync(file);
    } catch (error) {
        io.stderr(`Warning: could not remove manifest ${file}: ${error instanceof Error ? error.message : error}`);
    }
}
