/**
 * What this run publishes, and where (story #368).
 *
 * Every value here is read through the shared publishing resolver rather than from settings
 * directly, so this filer, the epic filer, `/nxs.epic` and `/nxs.close` cannot disagree about what
 * a repository declared (Invariant 10). The caller's own `--classification-*` outranks the resolved
 * defaults, which is how a batch of backlog stubs is filed through the same capability as a batch
 * of stories.
 */

import { type ToolkitIo } from "../io.js";
import { resolveClassification } from "../publishing.js";
import { type RootLayers, resolveKeyFromLayers } from "../resolve.js";
import { type FilerArgs } from "./args.js";

/** The colour and description the story label has always been created with. */
export const STORY_LABEL_STYLE: [string, string] = ["BFD4F2", "User story (created by nxs-gh-create-story)"];

export interface FilerConfig {
    /** `owner/repo` the issues are filed into, or null for the current repository. */
    issuesRepo: string | null;
    /** The declared classification mode: `types`, `labels` or `legacy-auto`. */
    classification: string;
    /** The canonical label applied to everything this run creates. */
    classificationLabel: string;
    /** The canonical issue type applied in `types` mode, or null when none is configured. */
    classificationType: string | null;
    /** The repository's own story label — the one key that carries an established style. */
    storyLabel: string;
}

export function resolveFilerConfig(layers: RootLayers, args: FilerArgs): FilerConfig {
    const storyLabel: string = resolveKeyFromLayers(layers, "story-label") ?? "";
    return {
        issuesRepo: resolveKeyFromLayers(layers, "story-repo") || null,
        classification: resolveClassification({
            classification: resolveKeyFromLayers(layers, "classification") ?? "",
        }),
        classificationLabel: args.classificationLabel ?? storyLabel,
        classificationType: args.classificationType ?? resolveKeyFromLayers(layers, "story-type") ?? null,
        storyLabel,
    };
}

/** Report the repository every issue command this run issues will target. */
export function reportIssuesRepo(config: FilerConfig, io: ToolkitIo): void {
    if (config.issuesRepo !== null) io.stdout(`Story repo (from config): ${config.issuesRepo}`);
}
