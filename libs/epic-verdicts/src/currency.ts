/**
 * Per-story currency, on both staleness axes, never collapsed into one statement about the epic
 * (decision record #505, key decision "Both staleness axes are evaluated per story against live
 * state, and the record axis compares to the record").
 *
 * Code currency compares a verdict's analyzed head to its own pull request's **current** head, by
 * full-SHA equality — the same rule record #495 fixed for a single pull request. Record currency
 * compares each verdict's stamped digest to the decision record's **current** digest, never to
 * another verdict's digest: comparing verdicts to each other would make the epic's record axis
 * depend on every verdict having stamped the same digest, which a record revised mid-epic breaks. A
 * verdict stamping no record at all, once the epic carries an approved one, is record-stale for its
 * story — it was analyzed before the record existed or in a mode that never checked it.
 */

import { type Runner } from "./run.js";
import { type StoryVerdict } from "./verdict.js";

export interface StoryCurrency {
    story: number;
    codeCurrent: boolean;
    recordCurrent: boolean;
    currentHead: string | null;
}

export interface CheckCurrencyOptions {
    /** The decision record's digest right now, or null when the epic carries no record. */
    currentRecordDigest: string | null;
}

function currentPrHead(run: Runner, cwd: string, pr: number): string | null {
    const r = run("gh", ["pr", "view", String(pr), "--json", "headRefOid"], { cwd });
    if (r.status !== 0) return null;
    try {
        const doc = JSON.parse(r.stdout) as Record<string, unknown>;
        return typeof doc["headRefOid"] === "string" ? doc["headRefOid"] : null;
    } catch {
        return null;
    }
}

/** Check one story's verdict for currency on both axes against live state. */
export function checkStoryCurrency(run: Runner, cwd: string, verdict: StoryVerdict, opts: CheckCurrencyOptions): StoryCurrency {
    const currentHead = currentPrHead(run, cwd, verdict.pr);
    const codeCurrent = currentHead !== null && currentHead === verdict.head;

    let recordCurrent: boolean;
    if (opts.currentRecordDigest === null) {
        recordCurrent = true; // no record axis to evaluate
    } else if (verdict.receipt.recordHash === null) {
        recordCurrent = false; // stamped no record while the epic now has an approved one
    } else {
        recordCurrent = verdict.receipt.recordHash === opts.currentRecordDigest;
    }

    return { story: verdict.story, codeCurrent, recordCurrent, currentHead };
}

export interface EpicCurrency {
    stories: StoryCurrency[];
    allCurrent: boolean;
}

/** Check every story's verdict for currency, naming each stale one — never collapsed. */
export function checkEpicCurrency(run: Runner, cwd: string, verdicts: StoryVerdict[], opts: CheckCurrencyOptions): EpicCurrency {
    const stories = verdicts.map((v) => checkStoryCurrency(run, cwd, v, opts));
    return { stories, allCurrent: stories.every((s) => s.codeCurrent && s.recordCurrent) };
}
