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
 * Only merged pull requests come back. An open or closed-unmerged pull request shipped nothing, and
 * every caller here is asking what shipped.
 */

import { type RepoSlug } from "@nexus/epic-resolve/gh";
import { claimsIssue } from "@nexus/pr-worktree/story-candidates";
import { sameRepo } from "@nexus/workspace/issue-ref";
import { type Runner } from "./run.js";

/** How the issue graph tied this pull request to the story. */
export type StoryPrEdge = "closing" | "cross-reference";

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

export interface StoryMergedPrsResult {
    story: number;
    /** Every merged pull request that shipped part of this story — empty when none did. */
    prs: StoryMergedPr[];
}

const STORY_PRS_QUERY =
    "query($owner:String!,$repo:String!,$num:Int!){" +
    "repository(owner:$owner,name:$repo){issue(number:$num){" +
    "closedByPullRequestsReferences(first:50,includeClosedPrs:true){nodes{" +
    "number merged mergedAt mergeCommit{oid} body repository{nameWithOwner}}}" +
    "timelineItems(first:100,itemTypes:[CROSS_REFERENCED_EVENT]){nodes{...on CrossReferencedEvent{source{...on PullRequest{" +
    "number merged mergedAt mergeCommit{oid} body repository{nameWithOwner}}}}}}" +
    "}}}";

interface RawPr {
    number: number;
    merged: boolean;
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
    return {
        number,
        merged: rec["merged"] === true,
        mergedAt: typeof rec["mergedAt"] === "string" ? rec["mergedAt"] : "",
        mergeCommit,
        body: typeof rec["body"] === "string" ? rec["body"] : "",
        repo,
    };
}

function nodesOf(container: unknown, key: string): unknown[] {
    if (container === null || typeof container !== "object") return [];
    const inner = (container as Record<string, unknown>)[key];
    if (inner === null || typeof inner !== "object") return [];
    const nodes = (inner as Record<string, unknown>)["nodes"];
    return Array.isArray(nodes) ? nodes : [];
}

/**
 * Every merged pull request that shipped part of `story`, wherever it merged.
 *
 * `slug` is the **issues** repository — the one the story number belongs to, and the only
 * repository this ever queries. The repositories the pull requests merged in come back from the
 * platform; none of them has to be checked out, or even reachable, for this to answer.
 */
export function resolveStoryMergedPrs(run: Runner, cwd: string, slug: RepoSlug, story: number): StoryMergedPrsResult {
    const r = run(
        "gh",
        ["api", "graphql", "-f", `query=${STORY_PRS_QUERY}`, "-F", `owner=${slug.owner}`, "-F", `repo=${slug.repo}`, "-F", `num=${story}`],
        { cwd },
    );
    if (r.status !== 0) return { story, prs: [] };

    let issue: unknown;
    try {
        const doc = JSON.parse(r.stdout) as Record<string, unknown>;
        const data = doc["data"] as Record<string, unknown> | undefined;
        const repository = data?.["repository"] as Record<string, unknown> | undefined;
        issue = repository?.["issue"];
    } catch {
        return { story, prs: [] };
    }
    if (issue === null || issue === undefined || typeof issue !== "object") return { story, prs: [] };

    const byKey = new Map<string, StoryMergedPr>();
    const add = (raw: RawPr | null, edge: StoryPrEdge): void => {
        if (raw === null || !raw.merged) return;
        // A cross-reference is a mention until the pull request states this story as its own scope.
        // A bare `#N` counts only inside the issues repository, where that is what it names.
        if (edge === "cross-reference" && !claimsIssue(raw.body, story, slug, sameRepo(raw.repo, `${slug.owner}/${slug.repo}`))) return;
        const key = `${raw.repo.toLowerCase()}#${raw.number}`;
        if (byKey.has(key)) return; // the stronger edge was read first and wins
        byKey.set(key, {
            story,
            pr: raw.number,
            repo: raw.repo,
            mergeCommit: raw.mergeCommit,
            mergedAt: raw.mergedAt,
            edge,
        });
    };

    for (const node of nodesOf(issue, "closedByPullRequestsReferences")) add(readPr(node), "closing");
    for (const node of nodesOf(issue, "timelineItems")) {
        if (node === null || typeof node !== "object") continue;
        add(readPr((node as Record<string, unknown>)["source"]), "cross-reference");
    }

    // Merge time is the platform's, so ordering never needs a copy of the repository it merged in
    // (invariant 14). Repository and number break a tie only to keep the result deterministic.
    const prs = [...byKey.values()].sort(
        (a, b) => a.mergedAt.localeCompare(b.mergedAt) || a.repo.localeCompare(b.repo) || a.pr - b.pr,
    );
    return { story, prs };
}
