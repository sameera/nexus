/**
 * The shipped ledger — what an epic shipped, recorded on the epic issue at the moment it shipped
 * (epic #769, decision record #777).
 *
 * The conformance gate is the writer, and it writes only against a merged pull request, because the
 * facts worth recording — the merge commit and the range anchored to it — do not exist before the
 * merge. Every later gate is a reader, and a reader needs no copy of the repository the code merged
 * in: the record already carries the range.
 *
 * One record per merged pull request, each its own comment on the epic issue, keyed by the code
 * repository together with the pull-request number (invariant 2). A re-run finds its own record by
 * that key and replaces that body alone, so two leads analysing two pull requests minutes apart
 * cannot drop each other's work — which one shared ledger comment, rewritten on every run, could
 * not give.
 *
 * Trust is the author's association with the issues repository (invariant 12), the same rule the
 * pipeline already applies to a published conformance review. The marker on its own confers
 * nothing: anyone who can comment on the issues repository can write one.
 */

import { MAINTAINER_ASSOCIATIONS } from "@nexus/pr-acceptance/receipt-blocks";
import { formatIssueRef, parseRepoIdentity, sameRepo } from "@nexus/workspace/issue-ref";
import { type EpicVerdictsDiagnostic } from "./diagnostic.js";
import { type Runner } from "./run.js";

/** The marker a shipped record is published under — never on its own a reason to trust one. */
export const SHIPPED_MARKER = "<!-- nexus:shipped-record -->";

export type FindingCounts = { critical: number; high: number; medium: number; low: number };

export interface ShippedRecord {
    /** The epic issue, bare or fully qualified (concept "Provenance Reference"). */
    epic: string;
    /** The story issue numbers this pull request shipped, in the issues repository. */
    stories: number[];
    /** The code repository the pull request merged in, normalised (invariant 3). */
    repo: string;
    pr: number;
    /** The merge commit the platform reported at write time. */
    mergeCommit: string;
    /** The platform's merge timestamp — the ordering key for two records of one story. */
    mergedAt: string;
    /** The commit range the pull request shipped, from the merge-anchored derivation (invariant 4). */
    base: string;
    head: string;
    findings: FindingCounts;
    /** The decision record's digest at analysis time, or null in degraded mode. */
    recordHash: string | null;
    nexusVersion: string | null;
}

const ZERO: FindingCounts = { critical: 0, high: 0, medium: 0, low: 0 };

/**
 * The identity of a record: the code repository and the pull-request number, and nothing else.
 *
 * Normalisation goes through the shared repository identity rule rather than the raw string the
 * writer happened to hold, so a record stamped `github.com/acme/member` and one stamped
 * `acme/member` are the same record rather than two (invariant 3).
 */
export function shippedRecordKey(repo: string, pr: number): string {
    const identity = parseRepoIdentity(repo);
    const name = identity === null ? repo.trim().toLowerCase() : `${identity.owner}/${identity.name}`;
    return `${name}#${pr}`;
}

function renderFindings(f: FindingCounts): string {
    return `{ critical: ${f.critical}, high: ${f.high}, medium: ${f.medium}, low: ${f.low} }`;
}

/** Compose the durable record body for one merged pull request. */
export function renderShippedRecord(record: ShippedRecord): string {
    const key = shippedRecordKey(record.repo, record.pr);
    const storyList = record.stories.map((s) => `#${s}`).join(", ");
    return [
        SHIPPED_MARKER,
        `<!-- nexus:shipped-key ${key} -->`,
        "",
        `**Shipped** — ${key} merged as \`${record.mergeCommit}\`, covering ${storyList || "no story"}.`,
        "",
        "```yaml",
        `epic: "${record.epic}"`,
        `stories: [${record.stories.join(", ")}]`,
        `repo: ${record.repo}`,
        `pr: ${record.pr}`,
        `merge_commit: ${record.mergeCommit}`,
        `merged_at: ${record.mergedAt}`,
        `range: { base: ${record.base}, head: ${record.head} }`,
        `findings: ${renderFindings(record.findings)}`,
        `record_hash: ${record.recordHash ?? ""}`,
        `nexus_version: ${record.nexusVersion ?? ""}`,
        "```",
        "",
    ].join("\n");
}

/** Read a record back from a comment body, or null when the body carries none. */
export function parseShippedRecord(body: string): ShippedRecord | null {
    const i = body.indexOf(SHIPPED_MARKER);
    if (i < 0) return null;
    const fence = /```(?:yaml)?\s*\n([\s\S]*?)```/.exec(body.slice(i + SHIPPED_MARKER.length));
    if (fence === null) return null;
    const fields = new Map<string, string>();
    for (const line of fence[1].split("\n")) {
        const m = /^\s*([A-Za-z][A-Za-z0-9_-]*):\s*(.*?)\s*$/.exec(line);
        if (m) fields.set(m[1], m[2].replace(/^["']|["']$/g, ""));
    }
    const repo = fields.get("repo")?.trim() ?? "";
    const pr = Number(fields.get("pr"));
    const mergeCommit = fields.get("merge_commit")?.trim() ?? "";
    if (repo.length === 0 || !Number.isInteger(pr) || pr <= 0 || mergeCommit.length === 0) return null;

    const findings: FindingCounts = { ...ZERO };
    for (const [, k, v] of (fields.get("findings") ?? "").matchAll(/([a-z]+)\s*:\s*(\d+)/g)) {
        if (k in findings) findings[k as keyof FindingCounts] = Number(v);
    }
    const range = /base:\s*([^\s,}]+)\s*,\s*head:\s*([^\s,}]+)/.exec(fields.get("range") ?? "");
    return {
        epic: fields.get("epic") ?? "",
        stories: [...(fields.get("stories") ?? "").matchAll(/\d+/g)].map((m) => Number(m[0])),
        repo,
        pr,
        mergeCommit,
        mergedAt: fields.get("merged_at")?.trim() ?? "",
        base: range?.[1] ?? "",
        head: range?.[2] ?? "",
        findings,
        recordHash: fields.get("record_hash")?.trim() || null,
        nexusVersion: fields.get("nexus_version")?.trim() || null,
    };
}

/** A record found on the epic issue, with the comment carrying it. */
export interface FoundRecord {
    record: ShippedRecord;
    /** The comment's node id, so a re-run can replace this body in place. */
    commentId: string;
    key: string;
}

/** A marker-bearing comment whose author cannot speak for the issues repository (invariant 12). */
export interface UntrustedRecord {
    commentId: string;
    key: string | null;
    author: string;
    authorAssociation: string;
}

export interface CollectedRecords {
    records: FoundRecord[];
    untrusted: UntrustedRecord[];
}

/**
 * Every shipped record on an epic issue's comments payload, trusted ones separated from the rest.
 *
 * An untrusted record is carried out rather than dropped: the report names it, so a story reported
 * as unshipped is never indistinguishable from a story whose record was refused.
 */
export function collectShippedRecords(doc: Record<string, unknown>): CollectedRecords {
    const records: FoundRecord[] = [];
    const untrusted: UntrustedRecord[] = [];
    const comments = doc["comments"];
    if (!Array.isArray(comments)) return { records, untrusted };

    // Later comments win a duplicate key: a record posted twice for one pull request (a failed
    // edit retried as a fresh comment) reads as the newer one rather than the abandoned one.
    const byKey = new Map<string, FoundRecord>();
    for (const item of comments) {
        if (item === null || typeof item !== "object") continue;
        const rec = item as Record<string, unknown>;
        const body = typeof rec["body"] === "string" ? rec["body"] : "";
        if (!body.includes(SHIPPED_MARKER)) continue;
        const commentId = typeof rec["id"] === "string" ? rec["id"] : "";
        const association = typeof rec["authorAssociation"] === "string" ? rec["authorAssociation"] : "";
        const parsed = parseShippedRecord(body);
        if (!MAINTAINER_ASSOCIATIONS.includes(association.toUpperCase())) {
            const author = rec["author"];
            untrusted.push({
                commentId,
                key: parsed === null ? null : shippedRecordKey(parsed.repo, parsed.pr),
                author:
                    author !== null && typeof author === "object" && typeof (author as Record<string, unknown>)["login"] === "string"
                        ? String((author as Record<string, unknown>)["login"])
                        : "",
                authorAssociation: association,
            });
            continue;
        }
        if (parsed === null) continue;
        const key = shippedRecordKey(parsed.repo, parsed.pr);
        byKey.set(key, { record: parsed, commentId, key });
    }
    records.push(...byKey.values());
    records.sort((a, b) => a.key.localeCompare(b.key));
    return { records, untrusted };
}

const COMMENTS_QUERY_FIELDS = "comments";

/** Fetch every shipped record on `epic`'s issue in `issuesRepo`. */
export function fetchShippedRecords(
    run: Runner,
    cwd: string,
    issuesRepo: string,
    epic: number,
): { ok: true; collected: CollectedRecords } | { ok: false; error: EpicVerdictsDiagnostic } {
    const r = run("gh", ["issue", "view", String(epic), "--repo", issuesRepo, "--json", COMMENTS_QUERY_FIELDS], { cwd });
    if (r.status !== 0) {
        return {
            ok: false,
            error: { problem: "gh-failed", message: `could not read the comments of epic #${epic} in ${issuesRepo}: ${r.stderr.trim()}` },
        };
    }
    try {
        const parsed: unknown = JSON.parse(r.stdout);
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
        return { ok: true, collected: collectShippedRecords(parsed as Record<string, unknown>) };
    } catch (e) {
        return {
            ok: false,
            error: {
                problem: "malformed-json",
                message: `the comments of epic #${epic} in ${issuesRepo} could not be read as JSON: ${e instanceof Error ? e.message : String(e)}`,
            },
        };
    }
}

const UPDATE_COMMENT_MUTATION =
    "mutation($id:ID!,$body:String!){updateIssueComment(input:{id:$id,body:$body}){clientMutationId}}";

export type PostShippedRecordResult =
    | { ok: true; action: "created" | "updated"; key: string; body: string }
    /**
     * The post failed. The composed body comes back with the failure so the run can name the retry
     * instead of reporting a success it did not achieve (invariant 10) — the same footing the
     * durable close comment's failed-post rule stands on.
     */
    | { ok: false; error: EpicVerdictsDiagnostic; body: string };

/**
 * Write `record` onto `epic`'s issue in `issuesRepo`: replace the existing record for this
 * repository and pull request, or add one when there is none.
 *
 * The epic issue is named explicitly on every call, so the gate writes where the epic lives even
 * when the pull request merged somewhere else, and never asks which repository the story numbers
 * belong to (invariant 11).
 */
export function postShippedRecord(
    run: Runner,
    cwd: string,
    issuesRepo: string,
    epic: number,
    record: ShippedRecord,
    existing: readonly FoundRecord[],
): PostShippedRecordResult {
    const body = renderShippedRecord(record);
    const key = shippedRecordKey(record.repo, record.pr);
    const prior = existing.find((f) => f.key === key);

    if (prior !== undefined && prior.commentId.length > 0) {
        const r = run(
            "gh",
            ["api", "graphql", "-f", `query=${UPDATE_COMMENT_MUTATION}`, "-f", `id=${prior.commentId}`, "-f", `body=${body}`],
            { cwd },
        );
        if (r.status !== 0) {
            return {
                ok: false,
                body,
                error: {
                    problem: "gh-failed",
                    message: `the shipped record for ${key} on epic #${epic} in ${issuesRepo} could not be replaced: ${r.stderr.trim()}`,
                },
            };
        }
        return { ok: true, action: "updated", key, body };
    }

    const r = run("gh", ["issue", "comment", String(epic), "--repo", issuesRepo, "--body", body], { cwd });
    if (r.status !== 0) {
        return {
            ok: false,
            body,
            error: {
                problem: "gh-failed",
                message: `the shipped record for ${key} could not be posted on epic #${epic} in ${issuesRepo}: ${r.stderr.trim()}`,
            },
        };
    }
    return { ok: true, action: "created", key, body };
}

/** The epic reference a record states, written for `codeRepo`'s point of view. */
export function epicRefForRecord(epic: number, issuesRepo: string | null, codeRepo: string | null): string {
    return formatIssueRef(
        { repo: issuesRepo, number: epic },
        codeRepo !== null && !sameRepo(issuesRepo, codeRepo) ? { kind: "repo", repo: codeRepo } : { kind: "none" },
    );
}
