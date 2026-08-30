/**
 * Which project board an issue lands on (story #370).
 *
 * The three targets are resolved through the shared project-target resolver; this wires the lookups
 * and the membership calls behind it. A declared `none` is a deliberate absence — no configuration
 * lookup, no auto-discovery, no project call and no false-alarm warning — which is what lets a
 * personal repository with no board say so once instead of paying discovery on every run.
 *
 * None of the lookups retry. Which calls carry retry decoration is observable as latency and as
 * warning lines, and normalising the tiers would be an improvement (decision record #375).
 *
 * The lookups themselves print nothing: each returns what it found, the project's title included,
 * and the caller renders its own line. Two filers reach these lookups with two different output
 * vocabularies, and a lookup that printed would hand one of them the other's wording (#387).
 *
 * "Found nothing" and "could not look" are different answers, and a lookup that collapsed them
 * would strand the operator with a silent absence where the real story is an unauthenticated client
 * (Invariant 16). A lookup that could not run names the step that failed and what the platform said;
 * the caller turns that into a line, because the two filers word the same failure differently.
 */

import { type GhRunner, type RunResult } from "../gh.js";
import { type ToolkitIo } from "../io.js";
import { type ProjectTarget, resolveProjectTarget } from "../publishing.js";
import { type RootLayers, resolveKeyFromLayers } from "../resolve.js";
import { type FilerArgs } from "./args.js";
import { type ProjectAssignment } from "./create.js";
import { type WorkItem } from "./frontmatter.js";
import { type Platform } from "./platform.js";

const BY_NUMBER = (scope: string): string => `
    query($owner: String!, $number: Int!) {
        ${scope}(login: $owner) {
            projectV2(number: $number) {
                id
                title
            }
        }
    }
    `;

const BY_TITLE = (scope: string): string => `
    query($owner: String!, $title: String!) {
        ${scope}(login: $owner) {
            projectsV2(first: 100, query: $title) {
                nodes {
                    id
                    title
                }
            }
        }
    }
    `;

const FOR_REPOSITORY = `
    query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
            projectsV2(first: 1) {
                nodes {
                    id
                    number
                    title
                }
            }
        }
    }
    `;

interface ProjectNode {
    id?: string;
    number?: number;
    title?: string;
}

/**
 * Which step of a lookup could not be completed, and what the platform said about it.
 *
 * The step is named rather than phrased: the epic filer and the story filer report the same failed
 * step in different words, so the sentence belongs to the caller and only the fact belongs here.
 */
export interface LookupFailure {
    step:
        | "owner"
        | "repository-name"
        | "repository-name-format"
        | "project-by-number"
        | "project-by-title"
        | "repository-projects"
        | "parse";
    detail: string;
}

/** A project that was looked up: its node id, and the title a caller announces it by. */
export interface FoundProject {
    id: string | null;
    title: string;
    /** Why the lookup could not run, or null when it ran and simply found no project. */
    failure: LookupFailure | null;
}

/** The `owner/number` a repository probe found, beside the node id the membership call takes. */
export interface DiscoveredProject extends FoundProject {
    ref: string | null;
}

export const NOT_FOUND: FoundProject = { id: null, title: "", failure: null };

/** What one GraphQL call produced: the parsed payload, or the step that stopped it. */
interface QueryOutcome {
    data: unknown | null;
    /** The platform's raw answer, which the numbered lookup reads to decide whether it was answered. */
    stdout: string;
    /** Whether the call itself was refused, as distinct from answering something unreadable. */
    refused: boolean;
    failure: LookupFailure | null;
}

/** What a thrown value says for itself, for the parse failure a caller renders. */
const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** A lookup that could not run, carrying the step that stopped it. */
const notLookedUp = (step: LookupFailure["step"], detail: string): FoundProject => ({
    ...NOT_FOUND,
    failure: { step, detail },
});

/** The project lookups, each answered by the platform and none of them retried. */
export class ProjectLookup {
    constructor(private readonly run: GhRunner) {}

    private query(
        step: LookupFailure["step"],
        query: string,
        variables: [string, string][],
        numbers: [string, string][] = [],
    ): QueryOutcome {
        const args: string[] = ["api", "graphql", "-f", `query=${query}`];
        for (const [key, value] of variables) args.push("-f", `${key}=${value}`);
        for (const [key, value] of numbers) args.push("-F", `${key}=${value}`);
        const result: RunResult = this.run(args);
        if (result.status !== 0) {
            return { data: null, stdout: result.stdout, refused: true, failure: { step, detail: result.stderr } };
        }
        try {
            return { data: JSON.parse(result.stdout), stdout: result.stdout, refused: false, failure: null };
        } catch (error) {
            return {
                data: null,
                stdout: result.stdout,
                refused: false,
                failure: { step: "parse", detail: messageOf(error) },
            };
        }
    }

    private found(project: ProjectNode | null | undefined): FoundProject {
        if (project === null || project === undefined) return NOT_FOUND;
        return { id: project.id ?? null, title: project.title ?? "Unknown", failure: null };
    }

    /**
     * A project named as `owner/<number>`, a bare `<number>`, or a title.
     *
     * A bare reference takes its owner from the current repository, which is what makes a
     * configuration value portable across the checkouts of one repository.
     */
    byName(name: string): FoundProject {
        let owner: string;
        let reference: string;
        if (name.includes("/")) {
            const at: number = name.lastIndexOf("/");
            owner = name.slice(0, at);
            reference = name.slice(at + 1);
        } else {
            const result: RunResult = this.run(["repo", "view", "--json", "owner", "--jq", ".owner.login"]);
            if (result.status !== 0) return notLookedUp("owner", result.stderr);
            owner = result.stdout.trim();
            reference = name;
        }
        return /^\d+$/.test(reference.trim())
            ? this.byNumber(owner, reference.trim())
            : this.byTitle(owner, reference);
    }

    /**
     * A project by number, asked of the organization scope and only then of the user scope.
     *
     * The second scope is a fallback for a first that did not answer *as a scope* — a refused call,
     * or a body that is not organization-shaped — never for one that answered "no such project".
     * A login is either an organization or a user, so asking the other scope about an organization
     * is a question the platform refuses; asking it anyway would turn an ordinary miss into a
     * reported failure the lookup never had (Invariant 19).
     */
    byNumber(owner: string, projectNumber: string): FoundProject {
        const ask = (scope: string): QueryOutcome =>
            this.query("project-by-number", BY_NUMBER(scope), [["owner", owner]], [["number", projectNumber]]);

        let outcome: QueryOutcome = ask("organization");
        if (outcome.refused || !outcome.stdout.includes("organization")) outcome = ask("user");
        if (outcome.failure !== null) return { ...NOT_FOUND, failure: outcome.failure };

        const data = outcome.data as {
            data?: {
                organization?: { projectV2?: ProjectNode | null } | null;
                user?: { projectV2?: ProjectNode | null } | null;
            };
        } | null;
        return this.found(data?.data?.organization?.projectV2 ?? data?.data?.user?.projectV2);
    }

    /**
     * A project by title, with the same organization-then-user fallback.
     *
     * The title search never inspects the body to decide, only whether the call was refused: a
     * scope that answered with no matches has answered, and the search ends there.
     */
    byTitle(owner: string, title: string): FoundProject {
        const ask = (scope: string): QueryOutcome =>
            this.query("project-by-title", BY_TITLE(scope), [
                ["owner", owner],
                ["title", title],
            ]);

        let outcome: QueryOutcome = ask("organization");
        if (outcome.refused) outcome = ask("user");
        if (outcome.failure !== null) return { ...NOT_FOUND, failure: outcome.failure };

        const data = outcome.data as {
            data?: {
                organization?: { projectsV2?: { nodes?: ProjectNode[] } | null } | null;
                user?: { projectsV2?: { nodes?: ProjectNode[] } | null } | null;
            };
        } | null;
        const organization: ProjectNode[] = data?.data?.organization?.projectsV2?.nodes ?? [];
        const nodes: ProjectNode[] =
            organization.length > 0 ? organization : (data?.data?.user?.projectsV2?.nodes ?? []);
        if (nodes.length === 0) return NOT_FOUND;
        const exact: ProjectNode | undefined = nodes.find(
            (node) => (node.title ?? "").toLowerCase() === title.toLowerCase(),
        );
        return this.found(exact ?? nodes[0]);
    }

    /** The repository's first project, and the concrete `owner/number` a write-back can persist. */
    forRepository(): DiscoveredProject {
        const named: RunResult = this.run(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
        if (named.status !== 0) return { ...notLookedUp("repository-name", named.stderr), ref: null };
        const nameWithOwner: string = named.stdout.trim();
        if (!nameWithOwner.includes("/")) {
            return { ...notLookedUp("repository-name-format", nameWithOwner), ref: null };
        }
        const at: number = nameWithOwner.indexOf("/");
        const owner: string = nameWithOwner.slice(0, at);
        const outcome: QueryOutcome = this.query("repository-projects", FOR_REPOSITORY, [
            ["owner", owner],
            ["repo", nameWithOwner.slice(at + 1)],
        ]);
        const data = outcome.data as {
            data?: { repository?: { projectsV2?: { nodes?: ProjectNode[] } | null } | null };
        } | null;
        const nodes: ProjectNode[] = data?.data?.repository?.projectsV2?.nodes ?? [];
        if (nodes.length === 0) return { ...NOT_FOUND, failure: outcome.failure, ref: null };
        const project: ProjectNode = nodes[0];
        return {
            ...this.found(project),
            ref: project.number !== undefined ? `${owner}/${project.number}` : null,
        };
    }
}

export interface ProjectPlan {
    /** The batch-wide project from the declared target, looked up once. */
    batchProjectId: string | null;
    /** Whether this run probed the repository — the only path that yields a value to write back. */
    ranAutoDiscovery: boolean;
    /** The `owner/number` auto-discovery found, or null. */
    discoveredRef: string | null;
}

export const NO_PROJECT_PLAN: ProjectPlan = { batchProjectId: null, ranAutoDiscovery: false, discoveredRef: null };

/** A failed lookup, in this filer's wording. Absence is reported by the caller, not here. */
function reportFailure(found: FoundProject, io: ToolkitIo): void {
    if (found.failure === null) return;
    const { step, detail }: LookupFailure = found.failure;
    if (step === "owner") io.stderr(`Error getting repo owner: ${detail}`);
    else if (step === "repository-name" || step === "repository-projects") {
        io.stderr(`Error fetching repository projects: ${detail}`);
    } else if (step === "project-by-number") io.stderr(`Error fetching project by number: ${detail}`);
    else if (step === "project-by-title") io.stderr(`Error searching for project by title: ${detail}`);
    else if (step === "parse") io.stderr(`Error parsing project response: ${detail}`);
    else io.stderr(`Unexpected repository name format: ${detail}`);
}

/** Resolve the batch's project target, once, for the whole run. */
export function planProjects(
    layers: RootLayers,
    args: FilerArgs,
    lookup: ProjectLookup,
    io: ToolkitIo,
): ProjectPlan {
    if (args.noProject) return NO_PROJECT_PLAN;
    const target: ProjectTarget = resolveProjectTarget({ project: resolveKeyFromLayers(layers, "project") ?? "" });
    if (target.mode === "none") return NO_PROJECT_PLAN;
    if (target.mode === "explicit") {
        io.stdout(`Looking up project from config: ${target.value}`);
        const found: FoundProject = lookup.byName(target.value);
        reportFailure(found, io);
        if (found.id === null) io.stderr(`Warning: Project '${target.value}' from config not found`);
        else io.stdout(`Found project: ${found.title}`);
        return { batchProjectId: found.id, ranAutoDiscovery: false, discoveredRef: null };
    }
    io.stdout("Looking for repository project (fallback)...");
    const discovered: DiscoveredProject = lookup.forRepository();
    reportFailure(discovered, io);
    if (discovered.id === null) io.stdout("No repository project found (will use frontmatter project if available)");
    else io.stdout(`Found project: ${discovered.title}`);
    return { batchProjectId: discovered.id, ranAutoDiscovery: true, discoveredRef: discovered.ref };
}

/**
 * Where each issue's board membership comes from.
 *
 * A work item's own `project:` outranks the batch target for that issue alone; a target it names
 * that does not resolve warns and leaves that one issue off a board, rather than falling back to the
 * batch's, because the item asked for something specific.
 */
export function projectAssignment(plan: ProjectPlan, lookup: ProjectLookup, platform: Platform, io: ToolkitIo): ProjectAssignment {
    return {
        idFor: (item: WorkItem): string | null => {
            if (item.project === "") return plan.batchProjectId;
            const found: FoundProject = lookup.byName(item.project);
            reportFailure(found, io);
            if (found.id === null) io.stderr(`  Warning: Project '${item.project}' not found`);
            else io.stdout(`Found project: ${found.title}`);
            return found.id;
        },
        add: (projectId: string, issueNodeId: string): boolean => {
            const added = platform.addToProject(projectId, issueNodeId);
            if (added.error !== null) io.stderr(`Error adding issue to project: ${added.error}`);
            return added.value === true;
        },
    };
}
