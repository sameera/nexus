/**
 * Resolve a PR's merge state and commit SHAs via `gh pr view --json`.
 *
 * The one place the helper talks to GitHub. Every field the analyze and close
 * flows need comes from a single call; the result is a flat typed record so the
 * CLI can emit it as JSON and the specs never re-shape `gh` output. Pure over the
 * injected Runner — specs feed canned `gh` stdout, no network.
 */

import { type PrWorktreeDiagnostic } from "./diagnostic.js";
import { type Runner } from "./run.js";

export interface PrInfo {
    number: number;
    /** OPEN | MERGED | CLOSED (as `gh` reports it). */
    state: string;
    merged: boolean;
    /** baseRefOid — the PR base tip (full SHA). */
    base: string;
    /** headRefOid — the PR branch tip (full SHA). */
    head: string;
    /** mergeCommit.oid — null for an open PR. */
    mergeCommitOid: string | null;
    /** Number of commits on the PR (drives rebase-merge range derivation). */
    commitCount: number;
    headRef: string;
    url: string;
    crossRepo: boolean;
    authorLogin: string;
}

export type ResolvePrResult =
    | { ok: true; pr: PrInfo }
    | { ok: false; error: PrWorktreeDiagnostic };

const GH_FIELDS =
    "state,mergedAt,baseRefOid,headRefOid,mergeCommit,commits,headRefName,url,isCrossRepository,author";

function asString(v: unknown, fallback = ""): string {
    return typeof v === "string" ? v : fallback;
}

function nestedString(v: unknown, key: string): string | null {
    if (v !== null && typeof v === "object" && key in v) {
        const inner = (v as Record<string, unknown>)[key];
        if (typeof inner === "string" && inner.length > 0) return inner;
    }
    return null;
}

export function resolvePr(
    run: Runner,
    cwd: string,
    prNumber: number,
    opts: { requireMerged: boolean },
): ResolvePrResult {
    const r = run("gh", ["pr", "view", String(prNumber), "--json", GH_FIELDS], { cwd });
    if (r.status !== 0) {
        const msg = r.stderr.trim();
        const problem = /not found|no pull requests|could not resolve|no such/i.test(msg)
            ? "pr-not-found"
            : "gh-failed";
        return {
            ok: false,
            error: { problem, message: `gh pr view ${prNumber} failed: ${msg || "unknown gh error"}` },
        };
    }
    let doc: Record<string, unknown>;
    try {
        const parsed: unknown = JSON.parse(r.stdout);
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("expected a JSON object");
        }
        doc = parsed as Record<string, unknown>;
    } catch (e) {
        return {
            ok: false,
            error: {
                problem: "malformed-pr-json",
                message: `gh pr view ${prNumber} returned unparseable JSON: ${e instanceof Error ? e.message : String(e)}`,
            },
        };
    }

    const mergedAt = doc["mergedAt"];
    const merged = typeof mergedAt === "string" && mergedAt.length > 0;
    const commits = doc["commits"];
    const pr: PrInfo = {
        number: prNumber,
        state: asString(doc["state"], "UNKNOWN"),
        merged,
        base: asString(doc["baseRefOid"]),
        head: asString(doc["headRefOid"]),
        mergeCommitOid: nestedString(doc["mergeCommit"], "oid"),
        commitCount: Array.isArray(commits) ? commits.length : 0,
        headRef: asString(doc["headRefName"]),
        url: asString(doc["url"]),
        crossRepo: doc["isCrossRepository"] === true,
        authorLogin: nestedString(doc["author"], "login") ?? "",
    };

    if (opts.requireMerged && !merged) {
        return {
            ok: false,
            error: {
                problem: "pr-not-merged",
                message:
                    `PR #${prNumber} is ${pr.state}, not merged; /nxs.close --pr requires a merged PR. ` +
                    `Merge the PR first (analyze may run pre-merge; close may not).`,
            },
        };
    }
    return { ok: true, pr };
}
