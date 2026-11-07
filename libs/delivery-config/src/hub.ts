/**
 * The `hub` layer of the precedence chain: the hub's own settings, then its workspace-wide github
 * defaults (decision record #1003, D1 and D2; the defaults alone before it, #362 D5).
 *
 * The workspace manifest is owned by the workspace library — the single authority on workspace
 * shape — so this toolkit never parses it. Both halves are now TypeScript in one workspace, so the
 * resolved workspace is read as a value rather than obtained as text from another process: that
 * deletes a spawn from every key resolution and removes the whole degradation surface that existed
 * only to describe an inter-process channel.
 *
 * The layer stays guarded on the checkout declaring a workspace, so a single-repo checkout pays
 * nothing, and it stays best-effort: an unresolvable workspace contributes nothing rather than
 * failing a resolution.
 *
 * The hub's own settings sit above the manifest's defaults, key by key, so a member that leaves a
 * key unset resolves exactly what the hub checkout resolves. They are read from the hub checkout the
 * workspace lookup located and verified, with the same reader a repository's own settings go
 * through, so no path is ever built from a setting's value. Only publishing keys cross: a
 * repository-specific key such as the test command, and the hub's docs location, never reach a
 * member (D3). Each source fails on its own: an unreadable hub settings file drops only the hub's
 * own settings, and the defaults still apply (D6).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { resolveWorkspace, type ResolveResult } from "@nexus/workspace/resolve";
import { GITHUB_KEYS, type GithubKey, keyEntry } from "./keys.js";
import { type DeliveryConfig, readDeliveryConfig } from "./settings.js";

/** The manifest names whose presence declares a checkout part of a workspace. */
const WORKSPACE_MANIFESTS: readonly string[] = ["hub.yml", "workspace.yml"];

/** Whether `projectRoot` declares a workspace at all — the guard that keeps single-repo free. */
export function declaresWorkspace(projectRoot: string): boolean {
    const configDir: string = path.join(projectRoot, ".nexus", "config");
    return WORKSPACE_MANIFESTS.some((name) => fs.existsSync(path.join(configDir, name)));
}

/**
 * Map a hub's github block onto the resolver's normalized keys, dropping anything unknown.
 *
 * Membership is the catalogue lookup itself, never a comparison of the two spellings: a row whose
 * normalized name equals its github spelling (`project`, `classification`) is as declared as any
 * other, and testing `normalized !== githubKey` silently drops exactly those from the hub layer.
 */
export function normalizeHubDefaults(github: Record<string, unknown>): DeliveryConfig {
    const result: DeliveryConfig = {};
    for (const [githubKey, value] of Object.entries(github)) {
        const entry: GithubKey | undefined = keyEntry(githubKey);
        if (entry && typeof value === "string" && value.trim() !== "") {
            result[entry.normalized] = value.trim();
        }
    }
    return result;
}

/** The publishing keys a hub may hand a member — every catalogued key but the repository-specific. */
export function publishingKeysOnly(config: DeliveryConfig): DeliveryConfig {
    const result: DeliveryConfig = {};
    for (const key of GITHUB_KEYS) {
        const value: string | undefined = config[key.normalized];
        if (!key.repoSpecific && value !== undefined && value !== "") result[key.normalized] = value;
    }
    return result;
}

/** The hub checkout's own declared settings, or nothing when they cannot be read. */
function readHubOwnSettings(hubRoot: string): DeliveryConfig {
    try {
        return readDeliveryConfig(hubRoot);
    } catch {
        return {};
    }
}

/** The hub layer's contribution for `projectRoot` — empty whenever it cannot be established. */
export function readHubDefaults(projectRoot: string): DeliveryConfig {
    if (!declaresWorkspace(projectRoot)) return {};
    const result: ResolveResult = resolveWorkspace(projectRoot);
    if (!result.ok || result.workspace.mode !== "workspace") return {};
    const defaults: DeliveryConfig = normalizeHubDefaults((result.workspace.github ?? {}) as Record<string, unknown>);
    return publishingKeysOnly({ ...defaults, ...readHubOwnSettings(result.workspace.hubRoot) });
}
