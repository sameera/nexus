/**
 * A draft's promised epic and story changes, and whether a live issue carries them (epic #787,
 * story #791, D8).
 *
 * A decision that changes what the epic or a story says gives the change as its "Epic commitment
 * affected" field: the issue, the exact old wording, the exact new wording and a status. A link to
 * the epic proves nothing about whether the change was made, so the record stage checks each one
 * against the live issue. This module holds the two pure halves of that check: reading the
 * commitments out of a draft, and matching one against an issue body. Fetching the body is the
 * caller's.
 *
 * Matching is exact after normalising whitespace and case, and nothing else (D8). A change applied
 * in different words reads as not made. That is the design's accepted cost: one answer anyone can
 * reproduce, rather than the drafter judging whether its own promise was kept.
 */

import { readRecord, type RecordDecision, type RecordField } from "./record.js";

/** A commitment line read into its parts. */
export interface Commitment {
    /** The decision it belongs to, `D10`; the heading when the decision has no ID. */
    decision: string;
    /** 1-indexed line of the draft the field is written on. */
    line: number;
    /** The reference as written before the old wording, `#791 criterion 4`. */
    ref: string;
    /** The first issue number the reference names. */
    issue: number;
    /** The `owner/repo` a qualified reference names, or null for a bare one. */
    repo: string | null;
    /** The exact old and new wording. Absent only for an unresolved commitment that gives none. */
    old: string | undefined;
    new: string | undefined;
    /** The status as written, `pending`, `amended (verified 2026-09-25)` or `unresolved (…)`. */
    recorded: string;
    problem?: undefined;
}

/** A commitment line that does not read as the template's form. */
export interface UnreadableCommitment {
    decision: string;
    line: number;
    text: string;
    problem: string;
}

const COMMITMENT: RegExp = /^Epic commitment affected$/i;
const NONE: RegExp = /^none\.?$/i;
/** `<ref>. Old: "<old>". New: "<new>". Status: <status>.` The new wording runs to the last `". Status:`. */
const FULL: RegExp = /^(.+?)\.?\s+Old:\s*"(.*?)"\.?\s+New:\s*"(.*)"\.?\s+Status:\s*(.+?)\.?\s*$/;
/** An unresolved commitment may give its reason instead of the wording. */
const STATUS_ONLY: RegExp = /^(.+?)\.?\s+Status:\s*(unresolved\b.*?)\.?\s*$/i;
const STATUS: RegExp = /^(pending|amended|unresolved)\b/i;
const REF: RegExp = /(?:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+))?#(\d+)/;

const EXPECTED = 'expected `<issue>. Old: "…". New: "…". Status: <pending | amended (verified <date>) | unresolved (<reason>)>.`';

function readOne(d: RecordDecision, field: RecordField): Commitment | UnreadableCommitment {
    const decision: string = d.id ?? d.heading;
    const value: string = field.value.replace(/\s*<!--.*?-->\s*$/, "").trim();
    const full: RegExpMatchArray | null = value.match(FULL);
    const statusOnly: RegExpMatchArray | null = full === null ? value.match(STATUS_ONLY) : null;
    const ref: string | undefined = full?.[1] ?? statusOnly?.[1];
    const recorded: string | undefined = full?.[4] ?? statusOnly?.[2];
    const issue: RegExpMatchArray | null | undefined = ref?.match(REF);
    if (ref === undefined || recorded === undefined || !STATUS.test(recorded) || issue === null || issue === undefined) {
        return { decision, line: field.line, text: value, problem: EXPECTED };
    }
    if (full !== null && full[3].trim() === "") {
        return { decision, line: field.line, text: value, problem: "the new wording is empty; give the exact text the issue should carry" };
    }
    return {
        decision,
        line: field.line,
        ref: ref.trim(),
        issue: Number(issue[2]),
        repo: issue[1] ?? null,
        old: full?.[2],
        new: full?.[3],
        recorded: recorded.trim(),
    };
}

/**
 * Every "Epic commitment affected" field of a draft's decisions, in order. A field written as
 * `none` is skipped. A field that does not read as the template's form is returned with a problem,
 * never skipped, so a misformatted commitment cannot pass unchecked.
 */
export function commitmentsIn(draft: string): Array<Commitment | UnreadableCommitment> {
    const found: Array<Commitment | UnreadableCommitment> = [];
    for (const d of readRecord(draft).decisions) {
        for (const field of d.fields) {
            if (!COMMITMENT.test(field.name) || NONE.test(field.value.trim())) continue;
            found.push(readOne(d, field));
        }
    }
    return found;
}

/** Whitespace collapsed to one space and case folded. Nothing else changes: markdown is compared as written. */
export function normaliseWording(text: string): string {
    return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Whether an issue body carries a commitment's new wording and its old wording (D8). */
export function matchCommitment(body: string, wording: { old: string; new: string }): { newPresent: boolean; oldPresent: boolean } {
    const haystack: string = normaliseWording(body);
    return {
        newPresent: haystack.includes(normaliseWording(wording.new)),
        // An empty old wording is an addition: there is nothing old to find.
        oldPresent: normaliseWording(wording.old) !== "" && haystack.includes(normaliseWording(wording.old)),
    };
}
