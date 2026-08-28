/**
 * The named publishing decisions that ride the precedence chain (story #358).
 *
 * These are the answers a filing stage needs as *decisions* rather than as raw strings: which
 * classification mode a repository uses, whether an epic of a given complexity warrants a decision
 * record, and whether a project is targeted at all. Each is resolved here, once, so publishing
 * consults declared intent instead of discovering it through GitHub calls that can fail.
 */

import { type DeliveryConfig } from "./settings.js";

/** The three classification modes. `legacy-auto` names and preserves probe-then-fallback filing. */
export const CLASSIFICATION_MODES: readonly string[] = ["types", "labels", "legacy-auto"];
export const DEFAULT_CLASSIFICATION = "legacy-auto";

/**
 * The declared classification mode. An absent or unrecognised value resolves to `legacy-auto`, the
 * behaviour-preserving default a repository with no declared block has always had.
 */
export function resolveClassification(config: DeliveryConfig): string {
    const mode: string = (config["classification"] ?? "").trim().toLowerCase();
    return CLASSIFICATION_MODES.includes(mode) ? mode : DEFAULT_CLASSIFICATION;
}

/**
 * The complexity rollups that do *not* warrant a decision record.
 *
 * Stated as the exempt set rather than as the threshold, so an absent or unrecognised rollup errs
 * toward needing design rather than silently skipping the gate. The lead can always remove the
 * label from the issue.
 */
export const DESIGN_EXEMPT_COMPLEXITIES: readonly string[] = ["s", "xs"];

/** Whether an epic of this complexity rollup warrants a decision record. */
export function epicNeedsDesign(complexity: string | null | undefined): boolean {
    return !DESIGN_EXEMPT_COMPLEXITIES.includes((complexity ?? "").trim().toLowerCase());
}

/** The two reserved project keywords. Any other value is an explicit target. */
export const PROJECT_NONE = "none";
export const PROJECT_AUTO = "auto";

export type ProjectTarget =
    | { mode: "none" }
    | { mode: "auto" }
    | { mode: "explicit"; value: string };

/**
 * The Project V2 target.
 *
 * `none` is a deliberate absence — no lookup, no add-to-project call, no false-alarm warning —
 * which is what lets a repository with no project say so once instead of paying discovery on every
 * run. `auto` is today's discovery and the default when nothing is declared. The two keywords match
 * case-insensitively; an explicit target keeps its own case, since project titles and owner
 * references are case-sensitive.
 */
export function resolveProjectTarget(config: DeliveryConfig): ProjectTarget {
    const raw: string = (config["project"] ?? "").trim();
    if (raw === "") return { mode: PROJECT_AUTO };
    const keyword: string = raw.toLowerCase();
    if (keyword === PROJECT_NONE) return { mode: PROJECT_NONE };
    if (keyword === PROJECT_AUTO) return { mode: PROJECT_AUTO };
    return { mode: "explicit", value: raw };
}
