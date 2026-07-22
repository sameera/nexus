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
}

export type RepoSlug = { owner: string; repo: string };

type Ok<T> = { ok: true } & T;
type Err = { ok: false; error: EpicResolveDiagnostic };

/** The GraphQL query that lists an epic issue's sub-issues (mirrors the one /nxs.close uses). */
const SUB_ISSUES_QUERY =
    "query($owner:String!,$repo:String!,$num:Int!){" +
    "repository(owner:$owner,name:$repo){" +
    "issue(number:$num){subIssues(first:100){nodes{number title state}}}}}";

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
    const r = run("gh", ["issue", "view", String(number), "--json", "number,title,body,state"], { cwd });
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
        },
    };
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
