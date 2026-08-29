/**
 * What this run files, how it is classified, and where it goes (story #380).
 *
 * Every value is read through the shared publishing resolver rather than from settings directly, so
 * this filer, the story filer, `/nxs.epic` and `/nxs.close` cannot disagree about what a repository
 * declared (Invariant 15). This module wires the decision; the resolution rules are not its own.
 *
 * The asymmetry between a label and a type is forced by the platform: creating an issue with a
 * label that does not exist fails outright, so the label is passed at creation and upserted before
 * it; a type can only be set by mutating an issue that already exists, so it is applied after.
 */

import { resolveClassification } from "../publishing.js";
import { type RootLayers, resolveKeyFromLayers, resolveSetting } from "../resolve.js";

export interface EpicConfig {
    /** `owner/repo` the epic is filed into, or null for the current repository. */
    epicRepo: string | null;
    /** The declared classification mode: `types`, `labels` or `legacy-auto`. */
    classification: string;
    /** The epic classification label this repository uses. */
    epicLabel: string;
    /** The unplanned-state marker promotion is legal against, and that promotion removes. */
    unplannedLabel: string;
    /** The marker declaring an epic warrants a decision record. */
    needsDesignLabel: string;
    /** The issue type resolved for this epic, the draft's own `type` outranking the configured one. */
    issueType: string | null;
}

export function resolveEpicConfig(layers: RootLayers, frontmatter: Record<string, string>): EpicConfig {
    return {
        epicRepo: resolveKeyFromLayers(layers, "epic-repo") || null,
        classification: resolveClassification({
            classification: resolveKeyFromLayers(layers, "classification") ?? "",
        }),
        epicLabel: resolveKeyFromLayers(layers, "epic-label") ?? "",
        unplannedLabel: resolveKeyFromLayers(layers, "unplanned-label") ?? "",
        needsDesignLabel: resolveKeyFromLayers(layers, "needs-design-label") ?? "",
        // The draft's own `type` is per-item intent and outranks the configured epic type
        // (Invariant 12); the chain resolves it, this only names the layers.
        issueType:
            resolveSetting("epicType", {
                frontmatter: { epicType: frontmatter["type"] ?? "" },
                repo: layers.repo,
                hub: layers.hub,
            }) || null,
    };
}

/** What classification this run will apply, and by which of the two mechanisms. */
export interface ClassificationPlan {
    /** A GitHub issue type to apply *after* creation, or null. */
    issueType: string | null;
    /** A label to pass *at* creation, or null. */
    createLabel: string | null;
    /** The warning the mode produced, or null when nothing needed saying. */
    warning: string | null;
}

/**
 * Decide the mechanism before anything is filed.
 *
 * In `types` mode a missing type warns and files the epic untyped: the repository declared that it
 * types its issues, so a type it cannot resolve is a configuration error worth surfacing rather
 * than something to paper over with a label it deliberately does not use (Invariant 11). Only the
 * legacy compatibility mode falls back, and it does so after the type application fails.
 */
export function planClassification(config: EpicConfig): ClassificationPlan {
    if (config.classification === "types") {
        return {
            issueType: config.issueType,
            createLabel: null,
            warning:
                config.issueType === null
                    ? "classification: types but no epic issue-type resolved (frontmatter 'type' / github.epic-type) — filing untyped"
                    : null,
        };
    }
    if (config.classification === "labels") {
        return { issueType: null, createLabel: config.epicLabel, warning: null };
    }
    // legacy-auto — probe-then-fallback, with the fallback label decided only if the type fails.
    return {
        issueType: config.issueType,
        createLabel: config.issueType === null ? config.epicLabel : null,
        warning: null,
    };
}
