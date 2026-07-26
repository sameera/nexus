/**
 * Fetching the record body the digest is taken over (epic #139, STORY-139.02).
 *
 * Invariant 7 says the digest is computed over the record body **as fetched back from GitHub** —
 * never the locally submitted text — because the platform's own storage normalisation would
 * otherwise make a record report as stale the instant it was filed. Keeping the fetch beside the
 * digest is what makes that structural rather than a rule each caller must remember: the program
 * every stage invokes goes and gets the body itself.
 *
 * One REST read supplies everything the stages need: the body (the hashed artifact), the state
 * (closed = approved), and the state reason — a sub-issue closed as **not planned** is a withdrawn
 * design, not an approval, and blocks exactly as an open record does.
 *
 * Read-only: this module fetches and hashes; it never edits, closes, or comments.
 */

import { recordDigest } from "./digest.js";
import { type Runner } from "./run.js";

export interface RecordDigestProblem {
    problem: "gh-failed" | "issue-not-found" | "malformed-json";
    message: string;
}

export interface FetchedRecord {
    issue: number;
    /** The `owner/repo` the record was read from, or null for the invoking checkout's repo. */
    repo: string | null;
    state: "open" | "closed";
    /** GitHub's close reason (`completed` / `not_planned`), or null while the issue is open. */
    stateReason: string | null;
    /**
     * Whether the record counts as approved: closed, and not closed as not-planned. Approval is
     * the close of the sub-issue and nothing else — Nexus writes no approval field anywhere.
     */
    approved: boolean;
    /** The canonical digest of the fetched body. */
    digest: string;
    body: string;
}

export type FetchRecordResult = { ok: true; record: FetchedRecord } | { ok: false; error: RecordDigestProblem };

/** Fetch one record issue and hash its body. `repo` (an `owner/repo`) targets another repository. */
export function fetchRecord(run: Runner, cwd: string, issue: number, repo: string | null = null): FetchRecordResult {
    const path: string = repo === null ? `repos/{owner}/{repo}/issues/${issue}` : `repos/${repo}/issues/${issue}`;
    const r = run("gh", ["api", path], { cwd });
    if (r.status !== 0) {
        const msg: string = r.stderr.trim();
        const problem = /not found|404/i.test(msg) ? "issue-not-found" : "gh-failed";
        return {
            ok: false,
            error: { problem, message: `reading record issue #${issue} failed: ${msg || "unknown gh error"}` },
        };
    }

    let doc: Record<string, unknown>;
    try {
        const parsed: unknown = JSON.parse(r.stdout);
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("expected an object");
        doc = parsed as Record<string, unknown>;
    } catch (e) {
        return {
            ok: false,
            error: {
                problem: "malformed-json",
                message: `record issue #${issue} returned unparseable JSON: ${e instanceof Error ? e.message : String(e)}`,
            },
        };
    }

    // An absent body is an empty record, not a fetch failure — but it must still hash, so a record
    // emptied by accident is detectably different from the one that was approved.
    const body: string = typeof doc["body"] === "string" ? doc["body"] : "";
    const state: "open" | "closed" = String(doc["state"] ?? "").toLowerCase() === "closed" ? "closed" : "open";
    const stateReason: string | null = typeof doc["state_reason"] === "string" ? doc["state_reason"] : null;

    return {
        ok: true,
        record: {
            issue,
            repo,
            state,
            stateReason,
            approved: state === "closed" && stateReason !== "not_planned",
            digest: recordDigest(body),
            body,
        },
    };
}
