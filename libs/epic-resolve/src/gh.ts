/**
 * The GitHub read layer for the epic resolver — the only place the resolver talks to GitHub.
 *
 * Every call goes through the injected Runner (specs feed canned `gh` stdout; no network), and
 * every call is read-only: `gh issue view` / `gh api graphql` / `gh api …/dependencies/blocked_by`
 * fetch, never mutate (Invariant 6). Failures map to structured diagnostics so the orchestrator
 * can be fail-closed — any unfetchable referenced issue aborts the run with no epic output.
 *
 * `gh` runs with `cwd` = the resolved target repo root, so its calls target that repo; the REST
 * `{owner}`/`{repo}` placeholders are auto-filled by `gh` from that checkout, and the GraphQL
 * query (which has no auto-fill) takes the owner/repo resolved once up front.
 */

import { type EpicResolveDiagnostic } from "./diagnostic.js";
import { type Runner } from "./run.js";

/** One issue fetched from GitHub — the fields the resolver reconstructs the epic from. */
export interface IssueContent {
    number: number;
    title: string;
    body: string;
    state: string;
    /** GitHub's closure reason (e.g. `NOT_PLANNED`, `DUPLICATE`, `COMPLETED`), or "" when open/unset. */
    stateReason: string;
    /** Label names, used to tell a decision-record sub-issue from a story (STORY-139.01). */
    labels: string[];
}

export type RepoSlug = { owner: string; repo: string };

type Ok<T> = { ok: true } & T;
type Err = { ok: false; error: EpicResolveDiagnostic };

/** The GraphQL query that lists an epic issue's sub-issues (mirrors the one /nxs.close uses). */
const SUB_ISSUES_QUERY =
    "query($owner:String!,$repo:String!,$num:Int!){" +
    "repository(owner:$owner,name:$repo){" +
    "issue(number:$num){subIssues(first:100){nodes{number title state}}}}}";

/** The GraphQL query that reads each sub-issue's GitHub issue type (type-based classification). */
const SUB_ISSUE_TYPES_QUERY =
    "query($owner:String!,$repo:String!,$num:Int!){" +
    "repository(owner:$owner,name:$repo){" +
    "issue(number:$num){subIssues(first:100){nodes{number issueType{name}}}}}}";

/** The GraphQL query that reads an issue's parent (non-null iff the issue is itself a sub-issue). */
const PARENT_QUERY =
    "query($owner:String!,$repo:String!,$num:Int!){" +
    "repository(owner:$owner,name:$repo){issue(number:$num){parent{number}}}}";

/** Parse newline-delimited issue numbers from a `--jq '…number'` stream; reject non-integers. */
function parseNumberLines(stdout: string): number[] | null {
    const out: number[] = [];
    for (const line of stdout.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.length === 0) continue;
        if (!/^\d+$/.test(trimmed)) return null;
        out.push(Number(trimmed));
    }
    return out;
}

/** Resolve the target repo's `owner/repo` for the GraphQL sub-issues query. */
export function resolveRepoSlug(run: Runner, cwd: string): Ok<{ slug: RepoSlug }> | Err {
    const r = run("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"], { cwd });
    if (r.status !== 0) {
        const msg = r.stderr.trim();
        const problem = /not a git repository|could not determine|no git remote/i.test(msg)
            ? "not-a-git-repo"
            : "gh-failed";
        return {
            ok: false,
            error: { problem, message: `gh repo view failed: ${msg || "unknown gh error"}` },
        };
    }
    const nameWithOwner = r.stdout.trim();
    const slash = nameWithOwner.indexOf("/");
    if (slash <= 0 || slash === nameWithOwner.length - 1) {
        return {
            ok: false,
            error: {
                problem: "gh-failed",
                message: `gh repo view returned an unexpected repository identity: ${JSON.stringify(nameWithOwner)}`,
            },
        };
    }
    return { ok: true, slug: { owner: nameWithOwner.slice(0, slash), repo: nameWithOwner.slice(slash + 1) } };
}

/**
 * Fetch one issue's number/title/body/state. `notFoundProblem` names the diagnostic when `gh`
 * reports the issue does not exist — `epic-not-found` for the epic itself, `subissue-fetch-failed`
 * for a referenced story (a missing story is the fail-closed trigger).
 */
export function fetchIssue(
    run: Runner,
    cwd: string,
    number: number,
    notFoundProblem: EpicResolveDiagnostic["problem"],
): Ok<{ issue: IssueContent }> | Err {
    const r = run("gh", ["issue", "view", String(number), "--json", "number,title,body,state,stateReason,labels"], { cwd });
    if (r.status !== 0) {
        const msg = r.stderr.trim();
        const problem = /not found|could not resolve|no such|no issues/i.test(msg) ? notFoundProblem : "gh-failed";
        return {
            ok: false,
            error: { problem, message: `gh issue view ${number} failed: ${msg || "unknown gh error"}` },
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
                problem: "malformed-json",
                message: `gh issue view ${number} returned unparseable JSON: ${e instanceof Error ? e.message : String(e)}`,
            },
        };
    }
    return {
        ok: true,
        issue: {
            number,
            title: typeof doc["title"] === "string" ? doc["title"] : "",
            body: typeof doc["body"] === "string" ? doc["body"] : "",
            state: typeof doc["state"] === "string" ? doc["state"] : "",
            stateReason: typeof doc["stateReason"] === "string" ? doc["stateReason"] : "",
            labels: parseLabelNames(doc["labels"]),
        },
    };
}

/** Label names out of `gh issue view --json labels` ({name}[]); anything else reads as no labels. */
function parseLabelNames(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    const names: string[] = [];
    for (const entry of raw) {
        if (entry !== null && typeof entry === "object" && typeof (entry as { name?: unknown }).name === "string") {
            names.push((entry as { name: string }).name);
        }
    }
    return names;
}

/**
 * Read each sub-issue's GitHub issue type, for the type-based classification mode.
 *
 * Issue types are not exposed by `gh issue view --json`, so they come from GraphQL. The caller
 * decides how a failure is treated: fatal when the declared mode classifies *by* type (the answer
 * is load-bearing), tolerable under `legacy-auto`, where the label is the primary marker and a repo
 * without the issue-types feature must keep resolving.
 */
export function fetchSubIssueTypes(
    run: Runner,
    cwd: string,
    slug: RepoSlug,
    epicNumber: number,
): Ok<{ types: Map<number, string> }> | Err {
    const r = run(
        "gh",
        [
            "api",
            "graphql",
            "-f",
            `query=${SUB_ISSUE_TYPES_QUERY}`,
            "-F",
            `owner=${slug.owner}`,
            "-F",
            `repo=${slug.repo}`,
            "-F",
            `num=${epicNumber}`,
            "--jq",
            '.data.repository.issue.subIssues.nodes[] | select(.issueType != null) | "\\(.number) \\(.issueType.name)"',
        ],
        { cwd },
    );
    if (r.status !== 0) {
        return {
            ok: false,
            error: {
                problem: "gh-failed",
                message: `reading sub-issue types of #${epicNumber} failed: ${r.stderr.trim() || "unknown gh error"}`,
            },
        };
    }
    const types = new Map<number, string>();
    for (const line of r.stdout.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.length === 0) continue;
        const space = trimmed.indexOf(" ");
        if (space <= 0) {
            return {
                ok: false,
                error: {
                    problem: "malformed-json",
                    message: `sub-issue type list for #${epicNumber} was not a clean stream: ${JSON.stringify(r.stdout)}`,
                },
            };
        }
        types.set(Number(trimmed.slice(0, space)), trimmed.slice(space + 1));
    }
    return { ok: true, types };
}

/** List an epic's sub-issue numbers in GitHub's return order (the resolver re-sorts canonically). */
export function fetchSubIssueNumbers(
    run: Runner,
    cwd: string,
    slug: RepoSlug,
    epicNumber: number,
): Ok<{ numbers: number[] }> | Err {
    const r = run(
        "gh",
        [
            "api",
            "graphql",
            "-f",
            `query=${SUB_ISSUES_QUERY}`,
            "-F",
            `owner=${slug.owner}`,
            "-F",
            `repo=${slug.repo}`,
            "-F",
            `num=${epicNumber}`,
            "--jq",
            ".data.repository.issue.subIssues.nodes[].number",
        ],
        { cwd },
    );
    if (r.status !== 0) {
        return {
            ok: false,
            error: {
                problem: "gh-failed",
                message: `listing sub-issues of #${epicNumber} failed: ${r.stderr.trim() || "unknown gh error"}`,
            },
        };
    }
    const numbers = parseNumberLines(r.stdout);
    if (numbers === null) {
        return {
            ok: false,
            error: {
                problem: "malformed-json",
                message: `sub-issue list for #${epicNumber} was not a clean number stream: ${JSON.stringify(r.stdout)}`,
            },
        };
    }
    return { ok: true, numbers };
}

/**
 * Read an issue's parent issue number, or null when it has none. A non-null parent means the issue
 * is itself a sub-issue — i.e. a story, not an epic — which the `--from` security boundary rejects.
 */
export function fetchParentNumber(
    run: Runner,
    cwd: string,
    slug: RepoSlug,
    issueNumber: number,
): Ok<{ parent: number | null }> | Err {
    const r = run(
        "gh",
        [
            "api",
            "graphql",
            "-f",
            `query=${PARENT_QUERY}`,
            "-F",
            `owner=${slug.owner}`,
            "-F",
            `repo=${slug.repo}`,
            "-F",
            `num=${issueNumber}`,
            "--jq",
            ".data.repository.issue.parent.number // empty",
        ],
        { cwd },
    );
    if (r.status !== 0) {
        return {
            ok: false,
            error: {
                problem: "gh-failed",
                message: `reading the parent of #${issueNumber} failed: ${r.stderr.trim() || "unknown gh error"}`,
            },
        };
    }
    const trimmed = r.stdout.trim();
    if (trimmed.length === 0) return { ok: true, parent: null };
    if (!/^\d+$/.test(trimmed)) {
        return {
            ok: false,
            error: { problem: "malformed-json", message: `parent of #${issueNumber} was not a number: ${JSON.stringify(r.stdout)}` },
        };
    }
    return { ok: true, parent: Number(trimmed) };
}

/** Read one story's native `blocked_by` dependency edges as blocker issue numbers. */
export function fetchBlockedBy(run: Runner, cwd: string, storyNumber: number): Ok<{ numbers: number[] }> | Err {
    const r = run(
        "gh",
        ["api", `repos/{owner}/{repo}/issues/${storyNumber}/dependencies/blocked_by`, "--jq", ".[].number"],
        { cwd },
    );
    if (r.status !== 0) {
        return {
            ok: false,
            error: {
                problem: "subissue-fetch-failed",
                message: `reading blocked_by of #${storyNumber} failed: ${r.stderr.trim() || "unknown gh error"}`,
            },
        };
    }
    const numbers = parseNumberLines(r.stdout);
    if (numbers === null) {
        return {
            ok: false,
            error: {
                problem: "malformed-json",
                message: `blocked_by list for #${storyNumber} was not a clean number stream: ${JSON.stringify(r.stdout)}`,
            },
        };
    }
    return { ok: true, numbers };
}

/**
 * The GraphQL query that reads everything the kind classification needs about one issue —
 * its parent, its issue type and its labels — in a single call.
 */
const ISSUE_FACTS_QUERY =
    "query($owner:String!,$repo:String!,$num:Int!){" +
    "repository(owner:$owner,name:$repo){" +
    "issue(number:$num){parent{number} issueType{name} state stateReason labels(first:100){nodes{name}}}}}";

/** The same three facts for every sub-issue of one epic, in a single call. */
const SUB_ISSUE_FACTS_QUERY =
    "query($owner:String!,$repo:String!,$num:Int!){" +
    "repository(owner:$owner,name:$repo){" +
    "issue(number:$num){subIssues(first:100){nodes{number issueType{name} state stateReason labels(first:100){nodes{name}}}}}}}";

/** One issue's classification facts. `exists` is false for a number that names no issue. */
export interface IssueFacts {
    exists: boolean;
    /** The parent issue number, or null when the issue is not itself a sub-issue. */
    parent: number | null;
    issueType: string | null;
    labels: string[];
    /** OPEN | CLOSED, as GitHub reports it. */
    state: string;
    /** GitHub's closure reason (COMPLETED / NOT_PLANNED / DUPLICATE), or "" when open/unset. */
    stateReason: string;
}

/**
 * Does this failure say the *issue* lookup resolved to nothing?
 *
 * GitHub reports a number that names no issue as a failed call carrying a GraphQL error, and
 * never as a successful empty answer — so absence can only be read out of the failure itself.
 * The match is deliberately narrow: an unreachable host, a rejected credential, a rate limit and
 * a missing *repository* are all failures that stay failures, because reading any of them as
 * "that issue is absent" silently shrinks a story list and lets a gate pass over unread code.
 */
function isIssueNotFound(stderr: string): boolean {
    return /could not resolve to an issue with the (?:number|name)/i.test(stderr);
}

function graphql(
    run: Runner,
    cwd: string,
    slug: RepoSlug,
    query: string,
    num: number,
    what: string,
): Ok<{ doc: unknown }> | (Err & { stderr: string }) {
    const r = run(
        "gh",
        ["api", "graphql", "-f", `query=${query}`, "-F", `owner=${slug.owner}`, "-F", `repo=${slug.repo}`, "-F", `num=${num}`],
        { cwd },
    );
    if (r.status !== 0) {
        return {
            ok: false,
            stderr: r.stderr,
            error: { problem: "gh-failed", message: `reading ${what} of #${num} failed: ${r.stderr.trim() || "unknown gh error"}` },
        };
    }
    try {
        return { ok: true, doc: JSON.parse(r.stdout) as unknown };
    } catch (e) {
        return {
            ok: false,
            stderr: r.stderr,
            error: {
                problem: "malformed-json",
                message: `reading ${what} of #${num} returned unparseable JSON: ${e instanceof Error ? e.message : String(e)}`,
            },
        };
    }
}

function at(value: unknown, ...keys: string[]): unknown {
    let cursor: unknown = value;
    for (const key of keys) {
        if (cursor === null || typeof cursor !== "object") return null;
        cursor = (cursor as Record<string, unknown>)[key];
    }
    return cursor ?? null;
}

/** Label names out of a GraphQL `labels(first:N){nodes{name}}` selection. */
function graphqlLabelNames(node: unknown): string[] {
    const nodes: unknown = at(node, "labels", "nodes");
    if (!Array.isArray(nodes)) return [];
    return nodes
        .map((entry) => at(entry, "name"))
        .filter((name): name is string => typeof name === "string");
}

function graphqlString(node: unknown, key: string): string {
    const value: unknown = at(node, key);
    return typeof value === "string" ? value : "";
}

function issueTypeName(node: unknown): string | null {
    const name: unknown = at(node, "issueType", "name");
    return typeof name === "string" && name.length > 0 ? name : null;
}

const ABSENT: IssueFacts = { exists: false, parent: null, issueType: null, labels: [], state: "", stateReason: "" };

/**
 * Read one issue's parent, issue type and labels together.
 *
 * A number naming no issue is not a failure — a candidate lifted out of a branch name may be
 * anything — so it comes back as `exists: false` for the caller to decide about. This is the
 * boundary where absence is told apart from a genuine platform failure: every other failure
 * stays an error and stops the run.
 */
export function fetchIssueFacts(run: Runner, cwd: string, slug: RepoSlug, number: number): Ok<{ facts: IssueFacts }> | Err {
    const r = graphql(run, cwd, slug, ISSUE_FACTS_QUERY, number, "issue facts");
    if (!r.ok) {
        if (r.error.problem === "gh-failed" && isIssueNotFound(r.stderr)) return { ok: true, facts: ABSENT };
        return { ok: false, error: r.error };
    }
    const issue: unknown = at(r.doc, "data", "repository", "issue");
    if (issue === null) {
        return { ok: true, facts: ABSENT };
    }
    const parent: unknown = at(issue, "parent", "number");
    return {
        ok: true,
        facts: {
            exists: true,
            parent: typeof parent === "number" ? parent : null,
            issueType: issueTypeName(issue),
            labels: graphqlLabelNames(issue),
            state: graphqlString(issue, "state"),
            stateReason: graphqlString(issue, "stateReason"),
        },
    };
}

/** The same facts for every sub-issue of `epicNumber`, keyed by sub-issue number. */
export function fetchSubIssueFacts(
    run: Runner,
    cwd: string,
    slug: RepoSlug,
    epicNumber: number,
): Ok<{ facts: Map<number, IssueFacts> }> | Err {
    const r = graphql(run, cwd, slug, SUB_ISSUE_FACTS_QUERY, epicNumber, "sub-issue facts");
    if (!r.ok) return { ok: false, error: r.error };
    const nodes: unknown = at(r.doc, "data", "repository", "issue", "subIssues", "nodes");
    const facts = new Map<number, IssueFacts>();
    if (!Array.isArray(nodes)) return { ok: true, facts };
    for (const node of nodes) {
        const number: unknown = at(node, "number");
        if (typeof number !== "number") continue;
        facts.set(number, {
            exists: true,
            parent: epicNumber,
            issueType: issueTypeName(node),
            labels: graphqlLabelNames(node),
            state: graphqlString(node, "state"),
            stateReason: graphqlString(node, "stateReason"),
        });
    }
    return { ok: true, facts };
}
