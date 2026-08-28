/**
 * The one precedence chain every publishing consumer resolves a key through.
 *
 * Most-specific first: the imperative invocation-time argument, then per-item frontmatter, then the
 * repository's declared settings, then the workspace hub defaults, then the built-in that
 * guarantees a value exists. An absent key and an empty value are treated identically as unset at
 * every layer, so an empty repo-level value falls through to the hub instead of masking it.
 */

import { readHubDefaults } from "./hub.js";
import { normalizedKey } from "./keys.js";
import { type DeliveryConfig, findConfigRoot, readDeliveryConfig } from "./settings.js";

/** The precedence order, most-specific first. */
export const PRECEDENCE: readonly string[] = ["invocation", "frontmatter", "repo", "hub", "builtin"];

export interface ResolveLayers {
    invocation?: DeliveryConfig | null;
    frontmatter?: DeliveryConfig | null;
    repo?: DeliveryConfig | null;
    hub?: DeliveryConfig | null;
    builtin?: string | null;
}

/** Resolve one normalized key through the chain. Null when no layer sets it and there is no built-in. */
export function resolveSetting(key: string, layers: ResolveLayers = {}): string | null {
    for (const layer of [layers.invocation, layers.frontmatter, layers.repo, layers.hub]) {
        if (!layer) continue;
        const value: string | undefined = layer[key];
        if (value !== undefined && value !== "") return value;
    }
    return layers.builtin ?? null;
}

/** The repo and hub layers for a config root — the pair every consumer resolves against. */
export interface RootLayers {
    root: string;
    repo: DeliveryConfig;
    hub: DeliveryConfig;
}

/**
 * The layers declared at (or above) `start`.
 *
 * A `--root` below its repository's config directory resolves to the nearest ancestor holding one;
 * a root with none at or above it is used as given and reads as empty.
 */
export function layersAt(start: string): RootLayers {
    const root: string = findConfigRoot(start);
    return { root, repo: readDeliveryConfig(root), hub: readHubDefaults(root) };
}

/**
 * Resolve one github-block key at `start` — the single entry the CLI and the toolkit's own
 * libraries both go through, so a stage and a library can never disagree about what a repository
 * declared. Returns the empty string when the key resolves to nothing.
 */
export function resolvePublishingKey(start: string, githubKey: string): string {
    const layers: RootLayers = layersAt(start);
    return resolveKeyFromLayers(layers, githubKey) ?? "";
}

/** Resolve one github-block key against already-read layers. */
export function resolveKeyFromLayers(layers: RootLayers, githubKey: string): string | null {
    return resolveSetting(normalizedKey(githubKey), { repo: layers.repo, hub: layers.hub });
}
