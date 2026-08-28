/**
 * The `hub` layer of the precedence chain: workspace-wide github defaults (D5).
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
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { resolveWorkspace, type ResolveResult } from "@nexus/workspace/resolve";
import { type GithubKey, keyEntry } from "./keys.js";
import { type DeliveryConfig } from "./settings.js";

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

/** The hub layer's contribution for `projectRoot` — empty whenever it cannot be established. */
export function readHubDefaults(projectRoot: string): DeliveryConfig {
    if (!declaresWorkspace(projectRoot)) return {};
    const result: ResolveResult = resolveWorkspace(projectRoot);
    if (!result.ok) return {};
    const github: Record<string, unknown> =
        result.workspace.mode === "workspace" ? ((result.workspace.github ?? {}) as Record<string, unknown>) : {};
    return normalizeHubDefaults(github);
}
