/**
 * The GitHub probes and label helpers the filers share (story #360).
 *
 * Everything here takes its process runner as an injected dependency, reusing the runner shape the
 * other libraries already share, so every case is exercised with canned results and no network call
 * and no spawn. Nothing raises: an absent or failing command-line client, unparseable output, or a
 * repository without the issue-types feature all resolve to a reported outcome, because these run
 * inside a filing path where an exception strands a half-created batch.
 */

export interface RunResult {
    status: number;
    stdout: string;
    stderr: string;
}

/**
 * The process seam. It must translate a failed spawn into a failed *result*: on this runtime,
 * invoking a binary that is not installed throws rather than exiting non-zero, so without the
 * translation the "client absent" case would raise instead of reporting its outcome.
 */
export type GhRunner = (args: string[]) => RunResult;

/** Split `repo` into owner and name, or ask the client for the current repository's. */
export function resolveOwnerRepo(run: GhRunner, repo: string | null): { owner: string; name: string } | null {
    if (repo && repo.includes("/")) {
        const at: number = repo.indexOf("/");
        return { owner: repo.slice(0, at), name: repo.slice(at + 1) };
    }
    const result: RunResult = run(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
    if (result.status !== 0) return null;
    const nameWithOwner: string = result.stdout.trim();
    if (!nameWithOwner.includes("/")) return null;
    const at: number = nameWithOwner.indexOf("/");
    return { owner: nameWithOwner.slice(0, at), name: nameWithOwner.slice(at + 1) };
}

function graphql(run: GhRunner, query: string, variables: Record<string, string>): unknown | null {
    const args: string[] = ["api", "graphql", "-f", `query=${query}`];
    for (const [key, value] of Object.entries(variables)) args.push("-f", `${key}=${value}`);
    const result: RunResult = run(args);
    if (result.status !== 0) return null;
    try {
        return JSON.parse(result.stdout);
    } catch {
        return null;
    }
}

const ISSUE_TYPES_QUERY = `
    query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
            issueTypes(first: 50) {
                nodes { id name }
            }
        }
    }
    `;

interface IssueTypeNode {
    id?: string;
    name?: string;
}

function issueTypeNodes(data: unknown): { present: boolean; nodes: IssueTypeNode[] } {
    const repository = ((data as { data?: { repository?: unknown } })?.data?.repository ?? {}) as {
        issueTypes?: { nodes?: IssueTypeNode[] } | null;
    };
    // A repository without the issue-types feature answers `issueTypes: null`, which is a different
    // fact from "the feature is there and no type is defined".
    if (repository.issueTypes === null || repository.issueTypes === undefined) return { present: false, nodes: [] };
    return { present: true, nodes: repository.issueTypes.nodes ?? [] };
}

/** The node id of a named issue type in `repo`, or null when it does not exist or the query fails. */
export function lookupIssueTypeId(typeName: string, run: GhRunner, repo: string | null = null): string | null {
    const resolved = resolveOwnerRepo(run, repo);
    if (resolved === null) return null;
    const data: unknown | null = graphql(run, ISSUE_TYPES_QUERY, { owner: resolved.owner, repo: resolved.name });
    if (data === null) return null;
    for (const node of issueTypeNodes(data).nodes) {
        if ((node.name ?? "").toLowerCase() === typeName.toLowerCase()) return node.id ?? null;
    }
    return null;
}

/**
 * Whether `repo` exposes usable issue types.
 *
 * True when the feature is present and at least one type is defined — there is something to apply.
 * False when the feature is absent or no type is defined. Null when the probe could not run at all,
 * which is the signal a bootstrap uses to seed safe defaults rather than a guess.
 */
export function repoHasIssueTypes(run: GhRunner, repo: string | null = null): boolean | null {
    const resolved = resolveOwnerRepo(run, repo);
    if (resolved === null) return null;
    const data: unknown | null = graphql(run, ISSUE_TYPES_QUERY, { owner: resolved.owner, repo: resolved.name });
    if (data === null) return null;
    const types = issueTypeNodes(data);
    return types.present && types.nodes.length > 0;
}

const SET_TYPE_MUTATION = `
    mutation($issueId: ID!, $typeId: ID!) {
        updateIssue(input: {id: $issueId, issueTypeId: $typeId}) {
            issue { number issueType { name } }
        }
    }
    `;

/** Set an issue's type. Success or failure is returned, never raised. */
export function setIssueType(issueId: string, typeId: string, run: GhRunner): boolean {
    const args: string[] = [
        "api",
        "graphql",
        "-f",
        `query=${SET_TYPE_MUTATION}`,
        "-f",
        `issueId=${issueId}`,
        "-f",
        `typeId=${typeId}`,
    ];
    return run(args).status === 0;
}

/** The grey a stub label is created in when a caller states no style of its own. */
export const DEFAULT_LABEL_COLOR = "EDEDED";

/** Idempotently upsert one label before it is applied. A failure is reported, not raised. */
export function ensureLabel(
    name: string,
    run: GhRunner,
    repo: string | null = null,
    color: string = DEFAULT_LABEL_COLOR,
    description = "",
): boolean {
    const args: string[] = ["label", "create", name, "--color", color, "--description", description, "--force"];
    if (repo) args.push("-R", repo);
    return run(args).status === 0;
}

/** Whether `repo` already carries the named label. Null when the query itself fails. */
export function labelExists(name: string, run: GhRunner, repo: string | null = null): boolean | null {
    const args: string[] = ["label", "list", "--limit", "200", "--json", "name", "--jq", ".[].name"];
    if (repo) args.push("-R", repo);
    const result: RunResult = run(args);
    if (result.status !== 0) return null;
    const names: Set<string> = new Set(
        result.stdout
            .split("\n")
            .map((line) => line.trim().toLowerCase())
            .filter((line) => line !== ""),
    );
    return names.has(name.trim().toLowerCase());
}

/**
 * Upsert every label a filing run will apply, before any issue exists. Returns those it could
 * neither create nor find.
 *
 * A failed upsert is ambiguous on its own — the token may lack label scope, or the call may have
 * been transient — so the existence query resolves it: a label already there is fine to apply, one
 * that is not is a gap the caller must report before creating anything. A query that itself fails
 * resolves the same way, because stranding half a filed batch is the worse outcome.
 */
export function ensureLabels(
    names: string[],
    run: GhRunner,
    repo: string | null = null,
    styles: Record<string, [string, string]> = {},
): string[] {
    const missing: string[] = [];
    const seen: Set<string> = new Set();
    for (const raw of names) {
        const name: string = raw.trim();
        if (name === "" || seen.has(name.toLowerCase())) continue;
        seen.add(name.toLowerCase());
        const [color, description] = styles[name] ?? [DEFAULT_LABEL_COLOR, ""];
        if (ensureLabel(name, run, repo, color, description)) continue;
        if (labelExists(name, run, repo) !== true) missing.push(name);
    }
    return missing;
}

/** The runner the CLI runs with: the real client, with a failed spawn reported as a failed result. */
export function defaultGhRunner(spawn: (args: string[]) => RunResult): GhRunner {
    return (args: string[]): RunResult => {
        try {
            return spawn(args);
        } catch (error) {
            return { status: 1, stdout: "", stderr: String(error) };
        }
    };
}
