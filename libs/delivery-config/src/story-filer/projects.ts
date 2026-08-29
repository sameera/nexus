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

/** The project lookups, each answered by the platform and none of them retried. */
export class ProjectLookup {
    constructor(
        private readonly run: GhRunner,
        private readonly io: ToolkitIo,
    ) {}

    private query(query: string, variables: [string, string][], numbers: [string, string][] = []): unknown | null {
        const args: string[] = ["api", "graphql", "-f", `query=${query}`];
        for (const [key, value] of variables) args.push("-f", `${key}=${value}`);
        for (const [key, value] of numbers) args.push("-F", `${key}=${value}`);
        const result: RunResult = this.run(args);
        if (result.status !== 0) return null;
        try {
            return JSON.parse(result.stdout);
        } catch {
            return null;
        }
    }

    private report(project: ProjectNode | null): string | null {
        if (project === null || project === undefined) return null;
        this.io.stdout(`Found project: ${project.title ?? "Unknown"}`);
        return project.id ?? null;
    }

    /**
     * A project named as `owner/<number>`, a bare `<number>`, or a title.
     *
     * A bare reference takes its owner from the current repository, which is what makes a
     * configuration value portable across the checkouts of one repository.
     */
    byName(name: string): string | null {
        let owner: string;
        let reference: string;
        if (name.includes("/")) {
            const at: number = name.lastIndexOf("/");
            owner = name.slice(0, at);
            reference = name.slice(at + 1);
        } else {
            const result: RunResult = this.run(["repo", "view", "--json", "owner", "--jq", ".owner.login"]);
            if (result.status !== 0) {
                this.io.stderr(`Error getting repo owner: ${result.stderr}`);
                return null;
            }
            owner = result.stdout.trim();
            reference = name;
        }
        return /^\d+$/.test(reference.trim())
            ? this.byNumber(owner, reference.trim())
            : this.byTitle(owner, reference);
    }

    byNumber(owner: string, projectNumber: string): string | null {
        for (const scope of ["organization", "user"]) {
            const data = this.query(BY_NUMBER(scope), [["owner", owner]], [["number", projectNumber]]) as {
                data?: Record<string, { projectV2?: ProjectNode | null } | null>;
            } | null;
            const project: ProjectNode | null | undefined = data?.data?.[scope]?.projectV2;
            if (project) return this.report(project);
        }
        return null;
    }

    byTitle(owner: string, title: string): string | null {
        let nodes: ProjectNode[] = [];
        for (const scope of ["organization", "user"]) {
            const data = this.query(BY_TITLE(scope), [
                ["owner", owner],
                ["title", title],
            ]) as { data?: Record<string, { projectsV2?: { nodes?: ProjectNode[] } | null } | null> } | null;
            nodes = data?.data?.[scope]?.projectsV2?.nodes ?? [];
            if (nodes.length > 0) break;
        }
        if (nodes.length === 0) return null;
        const exact: ProjectNode | undefined = nodes.find(
            (node) => (node.title ?? "").toLowerCase() === title.toLowerCase(),
        );
        return this.report(exact ?? nodes[0]);
    }

    /** The repository's first project, and the concrete `owner/number` a write-back can persist. */
    forRepository(): { id: string | null; ref: string | null } {
        const named: RunResult = this.run(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
        if (named.status !== 0) {
            this.io.stderr(`Error fetching repository projects: ${named.stderr}`);
            return { id: null, ref: null };
        }
        const nameWithOwner: string = named.stdout.trim();
        if (!nameWithOwner.includes("/")) {
            this.io.stderr(`Unexpected repository name format: ${nameWithOwner}`);
            return { id: null, ref: null };
        }
        const at: number = nameWithOwner.indexOf("/");
        const owner: string = nameWithOwner.slice(0, at);
        const data = this.query(FOR_REPOSITORY, [
            ["owner", owner],
            ["repo", nameWithOwner.slice(at + 1)],
        ]) as { data?: { repository?: { projectsV2?: { nodes?: ProjectNode[] } | null } | null } } | null;
        const nodes: ProjectNode[] = data?.data?.repository?.projectsV2?.nodes ?? [];
        if (nodes.length === 0) return { id: null, ref: null };
        const project: ProjectNode = nodes[0];
        return {
            id: this.report(project),
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
        const found: string | null = lookup.byName(target.value);
        if (found === null) io.stderr(`Warning: Project '${target.value}' from config not found`);
        return { batchProjectId: found, ranAutoDiscovery: false, discoveredRef: null };
    }
    io.stdout("Looking for repository project (fallback)...");
    const discovered = lookup.forRepository();
    if (discovered.id === null) io.stdout("No repository project found (will use frontmatter project if available)");
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
            const found: string | null = lookup.byName(item.project);
            if (found === null) io.stderr(`  Warning: Project '${item.project}' not found`);
            return found;
        },
        add: (projectId: string, issueNodeId: string): boolean => platform.addToProject(projectId, issueNodeId),
    };
}
