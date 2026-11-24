/**
 * Reading a repository's declared delivery configuration.
 *
 * The parse is deliberately shallow and line-oriented rather than a YAML document read (D8): its
 * observable behaviour includes quirks a real parser does not have — surrounding quotes are kept
 * verbatim, which the backlog-query quoting rule depends on; values are raw text with no type
 * coercion; and only two levels are recognised. Those are the behaviours consumers were built
 * against, so they are preserved rather than improved.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { DECLARED_KEYS, GITHUB_KEYS, nameInSection, sectionOf } from "./keys.js";

/** The keys the `github:` block may declare: every catalogued key that lives in that block. */
const GITHUB_BLOCK_KEYS: ReadonlySet<string> = new Set<string>(GITHUB_KEYS.map((key) => key.githubKey));

/** The declared configuration, keyed by the resolver's normalized names. */
export type DeliveryConfig = Record<string, string>;

/** Parse the two-level nested settings format. Deeper nesting is not recognised. */
export function parseSimpleYaml(content: string): Record<string, Record<string, string>> {
    const result: Record<string, Record<string, string>> = {};
    let currentSection: string | null = null;
    for (const line of content.split("\n")) {
        const stripped: string = line.trim();
        if (stripped === "" || stripped.startsWith("#")) continue;
        if (!/^\s/.test(line) && line.includes(":")) {
            const key: string = line.split(":")[0].trim();
            result[key] = {};
            currentSection = key;
        } else if (currentSection !== null && line.includes(":")) {
            const at: number = line.indexOf(":");
            result[currentSection][line.slice(0, at).trim()] = line.slice(at + 1).trim();
        }
    }
    return result;
}

/**
 * Read the delivery configuration declared at `projectRoot`.
 *
 * `settings.yml` is the canonical name; `config.yml` is kept only as a legacy one, because earlier
 * versions read that name and silently dropped a `github:` block written into settings.
 *
 * Every declared github-block key is read through the one catalogue, which is also what the hub
 * layer and the `resolve <key>` argument translate through. Enumerating the keys here separately is
 * what once let a key be *read* by a resolver but never *populated* here, losing a declared value
 * silently to a built-in.
 *
 * A `github:` key the catalogue does not declare throws, naming the key. A misspelt or retired key
 * would otherwise be ignored, and the stage would run on a built-in the repository did not choose.
 */
export function readDeliveryConfig(projectRoot: string): DeliveryConfig {
    const raw = readRawSettings(projectRoot);
    if (raw === null) return {};
    for (const key of Object.keys(raw["github"] ?? {})) {
        if (!GITHUB_BLOCK_KEYS.has(key)) throw new Error(`.nexus/config/settings.yml: unknown key '${key}' on 'github'`);
    }
    const result: DeliveryConfig = {};
    const crossRef: Record<string, string> = raw["cross-ref"] ?? {};
    if (crossRef["docs-root"]) result["docRoot"] = crossRef["docs-root"];
    for (const key of DECLARED_KEYS) {
        const value: string | undefined = raw[sectionOf(key)]?.[nameInSection(key)];
        // A sectioned key keeps a declared empty value, so its one reader can refuse it by name
        // (decision record #1051, D14); the chain still treats it as unset.
        if (value || (key.section !== undefined && value !== undefined)) result[key.normalized] = value;
    }
    return result;
}

/** The raw sections of the settings file at `projectRoot`, or null when there is none. */
export function readRawSettings(projectRoot: string): Record<string, Record<string, string>> | null {
    const deliveryDir: string = path.join(projectRoot, ".nexus", "config");
    for (const name of ["settings.yml", "config.yml"]) {
        const file: string = path.join(deliveryDir, name);
        if (!fs.existsSync(file)) continue;
        try {
            return parseSimpleYaml(fs.readFileSync(file, "utf8"));
        } catch {
            continue;
        }
    }
    return null;
}

/**
 * The nearest ancestor of `start` holding a `.nexus/config` directory, or `start` itself.
 *
 * Keyed to the config directory rather than to a repository marker, so a checkout with no config
 * resolves to `start` and reads as empty instead of climbing into an unrelated repository above a
 * temporary directory.
 */
export function findConfigRoot(start: string): string {
    let current: string = path.resolve(start);
    for (;;) {
        if (fs.existsSync(path.join(current, ".nexus", "config"))) return current;
        const parent: string = path.dirname(current);
        if (parent === current) return path.resolve(start);
        current = parent;
    }
}
