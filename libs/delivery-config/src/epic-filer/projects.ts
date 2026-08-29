/**
 * Which project board the epic lands on (story #384).
 *
 * The lookups themselves already exist in TypeScript from the story filer's port and are reused
 * rather than re-ported; this wires them to the single issue this capability files, and renders the
 * lines in this filer's own vocabulary. A declared `none` and `--no-project` are deliberate
 * absences: no lookup, no discovery, no project call and no missing-project warning (Invariant 14).
 */

import { type GhRunner } from "../gh.js";
import { type ProjectTarget, resolveProjectTarget } from "../publishing.js";
import { type RootLayers, resolveKeyFromLayers } from "../resolve.js";
import { type DiscoveredProject, type FoundProject, type LookupFailure, ProjectLookup } from "../story-filer/projects.js";
import { type EpicArgs } from "./args.js";
import { type EpicOutput } from "./output.js";

export interface ProjectPlan {
    /** The project node id the issue joins, or null for none. */
    projectId: string | null;
    /** Whether this run probed the repository — the only path with a value to write back. */
    ranAutoDiscovery: boolean;
    /** The `owner/number` auto-discovery found, or null. */
    discoveredRef: string | null;
}

const NO_PROJECT: ProjectPlan = { projectId: null, ranAutoDiscovery: false, discoveredRef: null };

/**
 * Announce what a lookup produced, in this capability's wording.
 *
 * A lookup that could not run is a different report from one that ran and found nothing: the second
 * is the caller's own "not found" warning, the first names the step that stopped it (Invariant 16).
 */
function announce(found: FoundProject, out: EpicOutput): string | null {
    if (found.failure !== null) {
        const { step, detail }: LookupFailure = found.failure;
        if (step === "owner") out.warn(`Error getting repo owner: ${detail}`);
        else if (step === "repository-name") out.warn(`Could not determine repository name: ${detail}`);
        else out.warn(`Unexpected repository name format: ${detail}`);
    }
    if (found.id !== null) out.line(`📊 Found project: ${found.title}`);
    return found.id;
}

export function planProject(layers: RootLayers, args: EpicArgs, run: GhRunner, out: EpicOutput): ProjectPlan {
    if (args.noProject) return NO_PROJECT;
    const lookup: ProjectLookup = new ProjectLookup(run);

    // The invocation-time flag is the override and always wins; it is never frozen into config.
    if (args.project !== null) {
        out.line(`🔍 Looking up project: ${args.project}`);
        const found: string | null = announce(lookup.byName(args.project), out);
        if (found === null) out.warn(`Project '${args.project}' not found, issue will not be added to a project`);
        return { projectId: found, ranAutoDiscovery: false, discoveredRef: null };
    }

    const target: ProjectTarget = resolveProjectTarget({ project: resolveKeyFromLayers(layers, "project") ?? "" });
    if (target.mode === "none") return NO_PROJECT;
    if (target.mode === "explicit") {
        out.line(`🔍 Looking up project from config: ${target.value}`);
        const found: string | null = announce(lookup.byName(target.value), out);
        if (found === null) {
            out.warn(`Project '${target.value}' from config not found, issue will not be added to a project`);
        }
        return { projectId: found, ranAutoDiscovery: false, discoveredRef: null };
    }

    out.line("🔍 Looking for repository project...");
    const discovered: DiscoveredProject = lookup.forRepository();
    const found: string | null = announce(discovered, out);
    if (found === null) out.warn("No project found for repository, issue will not be added to a project");
    return { projectId: found, ranAutoDiscovery: true, discoveredRef: discovered.ref };
}
