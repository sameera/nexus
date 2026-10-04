/**
 * A story resolved to the pull requests that *shipped* it, from the issue graph (epic #769,
 * decision record #777, key decision "A story's merged pull requests come from the epic's issue
 * graph, across repositories").
 *
 * The predecessor enumerated pull requests per repository — the story's own timeline, then a
 * branch-name search over whatever checkouts the lead happened to hold. That is the defect: a
 * story whose code merged in a repository nobody has a copy of read back as unimplemented. A graph
 * query is answered by the platform, so the pull request is visible wherever it merged, and each
 * result names the repository it merged in rather than inheriting the caller's.
 *
 * Two edges are read, and they are not equally strong:
 *
 *   - **closing** (`closedByPullRequestsReferences`) — the platform's own statement that the pull
 *     request closes this issue. Accepted as it stands.
 *   - **cross-reference** — a pull request that merely mentioned the issue. Anyone can write a
 *     mention, and GitHub's closing link is same-repository by construction, so a cross-repository
 *     pull request normally arrives on this weaker edge. It stays a candidate until it *claims* the
 *     story under the one shared claim rule ({@link claimsIssue}), which is why a wrong number can
 *     only ever cost a candidate, never add one.
 *
 * Every claiming pull request comes back with its state: merged, open, or closed without merging
 * (epic #828, story #847, decision record #849, D7). Only close's classification uses the extra
 * states: an open pull request is work still in flight, and a story whose claims all closed unmerged
 * shipped nothing. Every other caller is asking what *shipped*, and filters to the merged ones
 * explicitly with {@link mergedOnly} or {@link mergedClaims} at its own call site, so an open pull
 * request can never read as shipped code. Paging, the claim rule and failure handling stay here, in
 * the one read.
 *
 * The read is complete or it fails (epic #827, decision record #837, D1). Both edges are read to
 * their last page, because cross-references include mentions from plain issues and a busy story can
 * fill its first page before the pull request that shipped it appears. A failure on any page — a
 * refused call, an unparseable answer, a story the platform does not know — fails the whole read
 * and names the story and the cause. There is no third outcome, so an empty list means only that
 * nothing merged claims the story. Analyze and close both read through here and keep no query of
 * their own (D2).
 */

import { type RepoSlug } from "@nexus/epic-resolve/gh";
import { claimsIssue } from "@nexus/pr-worktree/story-candidates";
import { sameRepo } from "@nexus/workspace/issue-ref";
import { type Runner } from "./run.js";

/** How the issue graph tied this pull request to the story. */
export type StoryPrEdge = "closing" | "cross-reference";

/** Where a claiming pull request stands: merged, still open, or closed without merging. */
export type StoryPrState = "merged" | "open" | "closed";

/** One pull request that claims a story, in whatever state it is in. */
export interface StoryClaimingPr {
    /** The story issue number, in the issues repository. */
    story: number;
    pr: number;
    /** The repository the pull request lives in, as the platform names it (`owner/repo`). */
    repo: string;
    state: StoryPrState;
    /** The merge commit the platform reports, or null when it reported none (always null unless merged). */
    mergeCommit: string | null;
    /** The platform's own merge timestamp, or "" for a pull request that has not merged. */
    mergedAt: string;
    edge: StoryPrEdge;
}

/** A claiming pull request that merged — the only kind a caller asking what shipped ever sees. */
export interface StoryMergedPr {
    /** The story issue number, in the issues repository. */
    story: number;
    pr: number;
    /** The repository the pull request merged in, as the platform names it (`owner/repo`). */
    repo: string;
    /** The merge commit the platform reports, or null when it reported none. */
    mergeCommit: string | null;
    /** The platform's own merge timestamp — the ordering key, never a date anyone wrote. */
    mergedAt: string;
    edge: StoryPrEdge;
}

export interface StoryClaimsResult {
    story: number;
    /** Every pull request that claims this story, in any state — empty when none does. */
    prs: StoryClaimingPr[];
}

export interface StoryMergedPrsResult {
    story: number;
    /** Every merged pull request that shipped part of this story — empty when none did. */
    prs: StoryMergedPr[];
}

/** The claiming read could not produce a complete answer for `story`. */
export interface StoryReadFailure {
    story: number;
    /** What went wrong, in words a lead can act on: the platform's own message where it gave one. */
    cause: string;
}

export type StoryClaimsRead = { ok: true; result: StoryClaimsResult } | { ok: false; failure: StoryReadFailure };

export type StoryMergedPrsRead = { ok: true; result: StoryMergedPrsResult } | { ok: false; failure: StoryReadFailure };

const PR_FIELDS = "number state merged mergedAt mergeCommit{oid} body repository{nameWithOwner}";

/** One query per edge, each paged on its own cursor. */
const EDGE_QUERIES: ReadonlyArray<{ edge: StoryPrEdge; field: string; query: string }> = [
    {
        edge: "closing",
        field: "closedByPullRequestsReferences",
        query:
            "query($owner:String!,$repo:String!,$num:Int!,$cursor:String){" +
            "repository(owner:$owner,name:$repo){issue(number:$num){" +
            "closedByPullRequestsReferences(first:100,after:$cursor,includeClosedPrs:true){" +
            `pageInfo{hasNextPage endCursor} nodes{${PR_FIELDS}}}` +
            "}}}",
    },
    {
        edge: "cross-reference",
        field: "timelineItems",
        query:
            "query($owner:String!,$repo:String!,$num:Int!,$cursor:String){" +
            "repository(owner:$owner,name:$repo){issue(number:$num){" +
            "timelineItems(first:100,after:$cursor,itemTypes:[CROSS_REFERENCED_EVENT]){" +
            `pageInfo{hasNextPage endCursor} nodes{...on CrossReferencedEvent{source{...on PullRequest{${PR_FIELDS}}}}}}` +
            "}}}",
    },
];

interface RawPr {
    number: number;
    state: StoryPrState;
    mergedAt: string;
    mergeCommit: string | null;
    body: string;
    repo: string;
}

function readPr(node: unknown): RawPr | null {
    if (node === null || typeof node !== "object") return null;
    const rec = node as Record<string, unknown>;
    const number = rec["number"];
    if (typeof number !== "number") return null;
    const repoNode = rec["repository"];
    const repo =
        repoNode !== null && typeof repoNode === "object" && typeof (repoNode as Record<string, unknown>)["nameWithOwner"] === "string"
            ? String((repoNode as Record<string, unknown>)["nameWithOwner"])
            : "";
    if (repo.length === 0) return null;
    const mergeNode = rec["mergeCommit"];
    const mergeCommit =
        mergeNode !== null && typeof mergeNode === "object" && typeof (mergeNode as Record<string, unknown>)["oid"] === "string"
            ? String((mergeNode as Record<string, unknown>)["oid"])
            : null;
    // Anything not merged and not stated closed counts as open: unknown work blocks, never ships.
    const state: StoryPrState = rec["merged"] === true ? "merged" : rec["state"] === "CLOSED" ? "closed" : "open";
    return {
        number,
        state,
        mergedAt: typeof rec["mergedAt"] === "string" ? rec["mergedAt"] : "",
        mergeCommit,
        body: typeof rec["body"] === "string" ? rec["body"] : "",
        repo,
    };
}

type EdgeRead = { ok: true; nodes: unknown[] } | { ok: false; cause: string };

/** Every node one edge holds for `story`, read to the last page, or the reason it could not be. */
function readEdge(run: Runner, cwd: string, slug: RepoSlug, story: number, edge: (typeof EDGE_QUERIES)[number]): EdgeRead {
    const nodes: unknown[] = [];
    let cursor: string | null = null;
    for (let pageNo = 1; ; pageNo++) {
        const args = ["api", "graphql", "-f", `query=${edge.query}`, "-F", `owner=${slug.owner}`, "-F", `repo=${slug.repo}`, "-F", `num=${story}`];
        if (cursor !== null) args.push("-f", `cursor=${cursor}`);
        const r = run("gh", args, { cwd });
        const where = `the ${edge.edge === "closing" ? "closing links" : "cross-references"} (page ${pageNo})`;
        if (r.status !== 0) return { ok: false, cause: `reading ${where} failed: ${r.stderr.trim() || `gh exited ${r.status}`}` };

        let doc: Record<string, unknown>;
        try {
            const parsed: unknown = JSON.parse(r.stdout);
            if (parsed === null || typeof parsed !== "object") throw new Error("expected an object");
            doc = parsed as Record<string, unknown>;
        } catch (e) {
            return { ok: false, cause: `reading ${where} returned unparseable JSON: ${e instanceof Error ? e.message : String(e)}` };
        }
        if (Array.isArray(doc["errors"]) && doc["errors"].length > 0) {
            return { ok: false, cause: `reading ${where} returned errors: ${JSON.stringify(doc["errors"])}` };
        }
        const data = doc["data"] as Record<string, unknown> | undefined;
        const repository = data?.["repository"] as Record<string, unknown> | null | undefined;
        if (repository === null || repository === undefined) {
            return { ok: false, cause: `${slug.owner}/${slug.repo} could not be read while reading ${where}.` };
        }
        const issue = repository["issue"];
        if (issue === null || issue === undefined || typeof issue !== "object") {
            return { ok: false, cause: `GitHub does not know issue #${story} in ${slug.owner}/${slug.repo}.` };
        }
        const conn = (issue as Record<string, unknown>)[edge.field] as Record<string, unknown> | null | undefined;
        const pageNodes = conn?.["nodes"];
        const pageInfo = conn?.["pageInfo"] as Record<string, unknown> | null | undefined;
        if (!Array.isArray(pageNodes) || pageInfo === null || typeof pageInfo !== "object") {
            return { ok: false, cause: `reading ${where} returned no ${edge.field} page.` };
        }
        nodes.push(...pageNodes);
        if (pageInfo["hasNextPage"] !== true) return { ok: true, nodes };
        const next = pageInfo["endCursor"];
        if (typeof next !== "string" || next.length === 0 || next === cursor) {
            return { ok: false, cause: `reading ${where} reported a further page but no cursor to reach it.` };
        }
        cursor = next;
    }
}

/**
 * Every pull request that claims `story`, wherever it lives and in whatever state it is in.
 *
 * `slug` is the **issues** repository — the one the story number belongs to, and the only
 * repository this ever queries. The repositories the pull requests live in come back from the
 * platform; none of them has to be checked out, or even reachable, for this to answer.
 */
export function readStoryClaims(run: Runner, cwd: string, slug: RepoSlug, story: number): StoryClaimsRead {
    const byKey = new Map<string, StoryClaimingPr>();
    const add = (raw: RawPr | null, edge: StoryPrEdge): void => {
        if (raw === null) return;
        // A cross-reference is a mention until the pull request states this story as its own scope.
        // A bare `#N` counts only inside the issues repository, where that is what it names.
        if (edge === "cross-reference" && !claimsIssue(raw.body, story, slug, sameRepo(raw.repo, `${slug.owner}/${slug.repo}`))) return;
        const key = `${raw.repo.toLowerCase()}#${raw.number}`;
        if (byKey.has(key)) return; // the stronger edge was read first and wins
        const merged = raw.state === "merged";
        byKey.set(key, {
            story,
            pr: raw.number,
            repo: raw.repo,
            state: raw.state,
            mergeCommit: merged ? raw.mergeCommit : null,
            mergedAt: merged ? raw.mergedAt : "",
            edge,
        });
    };

    // The closing edge is read in full before any cross-reference, so it wins wherever both carry
    // the same pull request, however the two edges happen to page.
    for (const edge of EDGE_QUERIES) {
        const read = readEdge(run, cwd, slug, story, edge);
        if (!read.ok) return { ok: false, failure: { story, cause: read.cause } };
        for (const node of read.nodes) {
            if (edge.edge === "closing") add(readPr(node), "closing");
            else if (node !== null && typeof node === "object") add(readPr((node as Record<string, unknown>)["source"]), "cross-reference");
        }
    }

    // Merge time is the platform's, so ordering never needs a copy of the repository it merged in
    // (invariant 14). An unmerged pull request has none and sorts first; repository and number
    // break a tie only to keep the result deterministic.
    const prs = [...byKey.values()].sort(
        (a, b) => a.mergedAt.localeCompare(b.mergedAt) || a.repo.localeCompare(b.repo) || a.pr - b.pr,
    );
    return { ok: true, result: { story, prs } };
}

/**
 * The merged pull requests among `prs`, in the shape every caller asking what shipped has always
 * read. An open or closed-unmerged pull request shipped nothing, so it never gets through.
 */
export function mergedClaims(prs: readonly StoryClaimingPr[]): StoryMergedPr[] {
    return prs
        .filter((p) => p.state === "merged")
        .map((p) => ({ story: p.story, pr: p.pr, repo: p.repo, mergeCommit: p.mergeCommit, mergedAt: p.mergedAt, edge: p.edge }));
}

/** A claiming read narrowed to what shipped: the same failure, or only the merged pull requests. */
export function mergedOnly(read: StoryClaimsRead): StoryMergedPrsRead {
    return read.ok ? { ok: true, result: { story: read.result.story, prs: mergedClaims(read.result.prs) } } : read;
}

export type EveryStoryClaimsRead =
    | { ok: true; byStory: Record<number, StoryClaimingPr[]> }
    | { ok: false; failures: StoryReadFailure[] };

/**
 * The claiming read for each of `stories`, every state included. Every story is read even after one fails, so a single
 * run names every unreadable story rather than only the first (decision record #837, D3).
 */
export function readEveryStoryClaims(run: Runner, cwd: string, slug: RepoSlug, stories: readonly number[]): EveryStoryClaimsRead {
    const byStory: Record<number, StoryClaimingPr[]> = {};
    const failures: StoryReadFailure[] = [];
    for (const story of stories) {
        const read = readStoryClaims(run, cwd, slug, story);
        if (read.ok) byStory[story] = read.result.prs;
        else failures.push(read.failure);
    }
    return failures.length > 0 ? { ok: false, failures } : { ok: true, byStory };
}

/**
 * The one way a failed claiming read is told to the lead: every failed story, qualified by the
 * issues repository its number belongs to, with its cause. The remedy is a plain re-run once the
 * read succeeds — nothing here retries on its own (R2).
 */
export function describeStoryReadFailures(failures: readonly StoryReadFailure[], issuesRepo: string): string {
    const lines = failures.map((f) => `  ${issuesRepo}#${f.story} — ${f.cause}`);
    return [
        `the pull requests claiming ${failures.length} stor${failures.length === 1 ? "y" : "ies"} could not be read:`,
        ...lines,
        "A failed read is not the same as no pull request. Re-run once the read succeeds.",
    ].join("\n");
}
