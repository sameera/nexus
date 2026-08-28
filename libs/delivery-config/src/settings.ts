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
import { GITHUB_KEYS } from "./keys.js";

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
 */
export function readDeliveryConfig(projectRoot: string): DeliveryConfig {
    const deliveryDir: string = path.join(projectRoot, ".nexus", "config");
    for (const name of ["settings.yml", "config.yml"]) {
        const file: string = path.join(deliveryDir, name);
        if (!fs.existsSync(file)) continue;
        let raw: Record<string, Record<string, string>>;
        try {
            raw = parseSimpleYaml(fs.readFileSync(file, "utf8"));
        } catch {
            continue;
        }
        const result: DeliveryConfig = {};
        const crossRef: Record<string, string> = raw["cross-ref"] ?? {};
        const github: Record<string, string> = raw["github"] ?? {};
        if (crossRef["docs-root"]) result["docRoot"] = crossRef["docs-root"];
        for (const key of GITHUB_KEYS) {
            const value: string | undefined = github[key.githubKey];
            if (value) result[key.normalized] = value;
        }
        return result;
    }
    return {};
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
