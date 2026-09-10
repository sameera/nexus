/**
 * The story-to-pull-request candidate ladder (decision record #505, key decision "Story-to-pull-
 * request discovery is a validated candidate ladder …").
 *
 * Record #495's ladder resolves a pull request to the story it implements; this is that ladder run
 * in the opposite direction. The same property makes the weak rungs safe here too: a candidate is
 * only ever a candidate — `verdict.ts` accepts one only when it carries a trusted verdict that
 * stamps the target epic and names this story, so a false positive here is rejected downstream, and
 * a false negative just means one candidate fewer to try.
 *
 * Priority order, gathered in full and de-duplicated (first rung a candidate appears on wins its
 * recorded source): the story issue's own closing/cross-referencing timeline, a pull-request search
 * over the repository for a head branch carrying the story number as a whole segment, then whatever
 * explicit list the lead supplies.
 */

import { type RepoSlug } from "@nexus/epic-resolve/gh";
import { type Runner } from "./run.js";

export type CandidateSource = "closing-issue" | "branch-name" | "explicit";

export interface DiscoveredCandidate {
    pr: number;
    source: CandidateSource;
}

const CLOSED_BY_PRS_QUERY =
    "query($owner:String!,$repo:String!,$num:Int!){" +
    "repository(owner:$owner,name:$repo){" +
    "issue(number:$num){closedByPullRequestsReferences(first:50){nodes{number}}}}}";

function closingIssueCandidates(run: Runner, cwd: string, slug: RepoSlug, story: number): number[] {
    const r = run(
        "gh",
        [
            "api",
            "graphql",
            "-f",
            `query=${CLOSED_BY_PRS_QUERY}`,
            "-F",
            `owner=${slug.owner}`,
            "-F",
            `repo=${slug.repo}`,
            "-F",
            `num=${story}`,
            "--jq",
            ".data.repository.issue.closedByPullRequestsReferences.nodes[].number",
        ],
        { cwd },
    );
    if (r.status !== 0) return [];
    return r.stdout
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => /^\d+$/.test(l))
        .map(Number);
}

function branchNameCandidates(run: Runner, cwd: string, slug: RepoSlug, story: number): number[] {
    const r = run(
        "gh",
        ["pr", "list", "--repo", `${slug.owner}/${slug.repo}`, "--state", "all", "--json", "number,headRefName", "--limit", "200"],
        { cwd },
    );
    if (r.status !== 0) return [];
    let list: unknown;
    try {
        list = JSON.parse(r.stdout);
    } catch {
        return [];
    }
    if (!Array.isArray(list)) return [];
    const re = new RegExp(`(?:^|[/_-])${story}(?:[/_-]|$)`);
    const out: number[] = [];
    for (const item of list) {
        if (item === null || typeof item !== "object") continue;
        const rec = item as Record<string, unknown>;
        const n = rec["number"];
        const head = rec["headRefName"];
        if (typeof n === "number" && typeof head === "string" && re.test(head)) out.push(n);
    }
    return out;
}

/** Discover candidate pull requests for `story`, in priority order, de-duplicated. */
export function discoverCandidatePrs(
    run: Runner,
    cwd: string,
    slug: RepoSlug,
    story: number,
    explicit: number[] = [],
): DiscoveredCandidate[] {
    const seen = new Set<number>();
    const out: DiscoveredCandidate[] = [];
    const push = (n: number, source: CandidateSource): void => {
        if (seen.has(n)) return;
        seen.add(n);
        out.push({ pr: n, source });
    };

    for (const n of closingIssueCandidates(run, cwd, slug, story)) push(n, "closing-issue");
    for (const n of branchNameCandidates(run, cwd, slug, story)) push(n, "branch-name");
    for (const n of explicit) push(n, "explicit");

    return out;
}
