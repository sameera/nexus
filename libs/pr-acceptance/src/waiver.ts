/**
 * The one trusted waiver reader (epic #828, story #856, decision record #849, D11).
 *
 * Close stops on two stale causes that a lead may knowingly accept: a reviewed file that did not
 * land as reviewed, and a decision record revised after the analysis. The lead accepts them by
 * posting a comment on the pull request before close runs, in a fixed form, and close reads that
 * comment here. Close never asks for a waiver and never reads comment threads by hand.
 *
 * The form is a marker followed by a fenced block, the shape the analyze receipt already uses:
 *
 *     <!-- nexus:close-waiver -->
 *     ```yaml
 *     waive: landed-change
 *     files:
 *       - src/a.ts
 *     reason: <optional, one line>
 *     ```
 *
 *     <!-- nexus:close-waiver -->
 *     ```yaml
 *     waive: record-revised
 *     record: "#849"
 *     digest: <the record's full current digest>
 *     reason: <optional, one line>
 *     ```
 *
 * A waiver covers only what it names. A landed-change waiver must name every changed file, or it
 * clears nothing. A revised-record waiver accepts one revision, so a later revision stops close
 * again. No other cause can be waived this way.
 *
 * Trust is the receipt reader's rule (`maintainerAuthored`), not a second copy of it: a comment
 * counts only from an author who can speak for the repository. An untrusted or unreadable waiver is
 * reported, never dropped, so the lead can see why it cleared nothing. The reader only reads; which
 * waiver clears which stop is the matchers' answer, so a later reader of answers on a pull request
 * (#829) can reuse the read without inheriting close's rules.
 */

import { parseIssueRef } from "@nexus/workspace/issue-ref";
import { type Result, fail, ok } from "./diagnostic.js";
import { maintainerAuthored, newestReceiptBlock } from "./receipt-blocks.js";
import { type Runner } from "./run.js";

/** The comment marker a waiver is posted under. */
export const WAIVER_MARKER = "<!-- nexus:close-waiver -->";

/** The stale causes a waiver comment can clear. */
export type WaiverCause = "landed-change" | "record-revised";

/** What a waiver says it accepts. */
export type WaiverTerms =
    /** The reviewed files that did not land as reviewed, by path. */
    | { cause: "landed-change"; files: string[] }
    /** The record revision accepted: the record reference as written, and its full digest, lowercased. */
    | { cause: "record-revised"; record: string; digest: string };

/** A waiver block as parsed: its terms, or why it could not be read. */
export type ParsedWaiver = { ok: true; terms: WaiverTerms; reason: string | null } | { ok: false; problem: string };

/** One waiver comment on the pull request. */
export interface WaiverComment {
    /** The author's login, or "" when the platform stated none. */
    author: string;
    /** The comment's own link. */
    url: string;
    /** The platform's timestamp on the comment. */
    at: string;
    /** Whether its author can speak for the repository, by the receipt reader's rule. */
    trusted: boolean;
    waiver: ParsedWaiver;
}

export interface PrWaivers {
    pr: number;
    /** Every comment carrying the waiver marker, in the order the platform returned them. */
    comments: WaiverComment[];
}

/** Why a waiver comment cleared nothing. */
export type RejectedWaiver =
    | { author: string; url: string; why: "untrusted" }
    | { author: string; url: string; why: "malformed"; problem: string }
    | { author: string; url: string; why: "incomplete"; uncovered: string[] }
    | { author: string; url: string; why: "other-revision"; record: string; digest: string };

/** The waiver applied to one stop, if any, and every waiver comment that tried and cleared nothing. */
export interface WaiverMatch {
    applied: WaiverComment | null;
    rejected: RejectedWaiver[];
}

const unquote = (v: string): string => v.trim().replace(/^["']|["']$/g, "");

/** Parse the waiver block in `body`. Null when the body carries no waiver marker. */
export function parseWaiverBlock(body: string): ParsedWaiver | null {
    const i = body.indexOf(WAIVER_MARKER);
    if (i < 0) return null;
    const fence = /```(?:yaml)?\s*\n([\s\S]*?)```/.exec(body.slice(i + WAIVER_MARKER.length));
    if (fence === null) return { ok: false, problem: "no fenced block follows the waiver marker" };

    const fields = new Map<string, string>();
    const files: string[] = [];
    let inFiles = false;
    for (const line of fence[1].split("\n")) {
        const item = /^\s+-\s+(.+?)\s*$/.exec(line);
        if (item && inFiles) {
            files.push(unquote(item[1]));
            continue;
        }
        const m = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*?)\s*$/.exec(line);
        if (m === null) continue;
        inFiles = m[1] === "files";
        if (inFiles && m[2].startsWith("[")) files.push(...m[2].replace(/^\[|\]$/g, "").split(",").map(unquote).filter((f) => f.length > 0));
        else fields.set(m[1], unquote(m[2]));
    }

    const reason = fields.get("reason") || null;
    const waive = fields.get("waive") ?? "";
    if (waive === "landed-change") {
        if (files.length === 0) return { ok: false, problem: "a landed-change waiver names no file under `files:`" };
        return { ok: true, terms: { cause: "landed-change", files: [...new Set(files)] }, reason };
    }
    if (waive === "record-revised") {
        const record = fields.get("record") ?? "";
        const digest = (fields.get("digest") ?? "").toLowerCase();
        if (record === "" || digest === "") return { ok: false, problem: "a record-revised waiver must name both `record:` and `digest:`" };
        return { ok: true, terms: { cause: "record-revised", record, digest }, reason };
    }
    return { ok: false, problem: `\`waive: ${waive}\` is not a cause a waiver can clear (landed-change or record-revised)` };
}

export interface ReadPrWaiversOptions {
    /** The repository the pull request lives in, when it is not the checkout's own. */
    ghRepo?: string;
}

/**
 * Every waiver comment on pull request `pr`. `gh pr view --json comments` follows every page before
 * it answers, as the receipt reader's read does. A failed or unparseable read fails: it is never "no
 * waiver".
 */
export function readPrWaivers(run: Runner, cwd: string, pr: number, opts: ReadPrWaiversOptions = {}): Result<PrWaivers> {
    const repoArgs = opts.ghRepo === undefined ? [] : ["--repo", opts.ghRepo];
    const r = run("gh", ["pr", "view", String(pr), ...repoArgs, "--json", "comments"], { cwd });
    if (r.status !== 0) return fail("gh-failed", `gh pr view ${pr} --json comments failed: ${r.stderr.trim()}`);
    let doc: Record<string, unknown>;
    try {
        doc = JSON.parse(r.stdout) as Record<string, unknown>;
    } catch (e) {
        return fail("gh-failed", `gh pr view ${pr} returned unparseable JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
    const comments: WaiverComment[] = [];
    for (const item of Array.isArray(doc["comments"]) ? doc["comments"] : []) {
        if (item === null || typeof item !== "object") continue;
        const c = item as Record<string, unknown>;
        const waiver = parseWaiverBlock(typeof c["body"] === "string" ? c["body"] : "");
        if (waiver === null) continue;
        const author = c["author"] !== null && typeof c["author"] === "object" ? (c["author"] as Record<string, unknown>)["login"] : undefined;
        comments.push({
            author: typeof author === "string" ? author : "",
            url: typeof c["url"] === "string" ? c["url"] : "",
            at: typeof c["createdAt"] === "string" ? c["createdAt"] : "",
            trusted: maintainerAuthored({ authorAssociation: typeof c["authorAssociation"] === "string" ? c["authorAssociation"] : null }),
            waiver,
        });
    }
    return ok({ pr, comments });
}

/**
 * Sort the waiver comments that address `cause` into the one that clears it — the newest trusted
 * comment `covers` accepts — and every other one, with why it cleared nothing. A comment that
 * waives the other cause is not about this stop and is left out; an unreadable one is named,
 * because close cannot tell which stop it meant.
 */
function match(waivers: PrWaivers, cause: WaiverCause, covers: (terms: WaiverTerms, c: WaiverComment) => RejectedWaiver | null): WaiverMatch {
    const accepted: WaiverComment[] = [];
    const rejected: RejectedWaiver[] = [];
    for (const c of waivers.comments) {
        const who = { author: c.author, url: c.url };
        if (!c.waiver.ok) {
            rejected.push({ ...who, why: "malformed", problem: c.waiver.problem });
            continue;
        }
        if (c.waiver.terms.cause !== cause) continue;
        if (!c.trusted) {
            rejected.push({ ...who, why: "untrusted" });
            continue;
        }
        const refused = covers(c.waiver.terms, c);
        if (refused === null) accepted.push(c);
        else rejected.push(refused);
    }
    const applied = newestReceiptBlock(accepted);
    return applied === null ? { applied: null, rejected } : { applied, rejected: [] };
}

/** The waiver that clears a landed-change stop on `changed` files: it must name every one (G31). */
export function matchLandedChangeWaiver(waivers: PrWaivers, changed: readonly string[]): WaiverMatch {
    return match(waivers, "landed-change", (terms, c) => {
        const named = new Set(terms.cause === "landed-change" ? terms.files : []);
        const uncovered = changed.filter((f) => !named.has(f));
        return uncovered.length === 0 ? null : { author: c.author, url: c.url, why: "incomplete", uncovered };
    });
}

/** The waiver that clears a revised-record stop: it must name record `issue` at its `digest` now (G35). */
export function matchRecordWaiver(waivers: PrWaivers, issue: number, digest: string): WaiverMatch {
    return match(waivers, "record-revised", (terms, c) => {
        if (terms.cause !== "record-revised") return null;
        return parseIssueRef(terms.record)?.number === issue && terms.digest === digest.toLowerCase()
            ? null
            : { author: c.author, url: c.url, why: "other-revision", record: terms.record, digest: terms.digest };
    });
}
