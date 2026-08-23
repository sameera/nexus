/**
 * Reading `.nexus/config/settings.yml` for the doc-path resolver: `cross-ref.docs-root` (the
 * absolute URL prefix a relative path is appended to) and the `github.*` fields the resolver
 * carries through unchanged. The parser is a hand-rolled two-level reader, not the full YAML
 * parser this repo already inlines elsewhere — decision record #277 keeps it that way: the two
 * parsers disagree on malformed and unusual input, and unifying them changes observable behaviour
 * mid-migration, which the parity gate exists to catch.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const DEFAULT_DOC_ROOT = "https://github.com/{username|orgname}/{reponame}/blob/main/docs";

export interface Settings {
    docRoot?: string;
    project?: string;
    epicType?: string;
}

/** Parse the 2-level nested settings.yml format without external dependencies. */
export function parseSimpleYaml(content: string): Record<string, Record<string, string>> {
    const result: Record<string, Record<string, string>> = {};
    let currentSection: string | null = null;
    for (const line of content.split(/\r?\n/)) {
        const stripped = line.trim();
        if (!stripped || stripped.startsWith("#")) {
            continue;
        }
        if (!/^\s/.test(line) && line.includes(":")) {
            const key = line.split(":")[0].trim();
            result[key] = {};
            currentSection = key;
        } else if (currentSection && line.includes(":")) {
            const idx = line.indexOf(":");
            const key = line.slice(0, idx).trim();
            const value = line.slice(idx + 1).trim();
            result[currentSection][key] = value;
        }
    }
    return result;
}

/** Read settings from .nexus/config/settings.yml. Returns {} if missing or unparsable. */
export function readSettings(projectRoot: string): Settings {
    const settingsPath = join(projectRoot, ".nexus", "config", "settings.yml");
    if (!existsSync(settingsPath)) {
        return {};
    }

    try {
        const raw = parseSimpleYaml(readFileSync(settingsPath, "utf-8"));
        const result: Settings = {};
        const crossRef = raw["cross-ref"] ?? {};
        const github = raw["github"] ?? {};
        if (crossRef["docs-root"]) {
            result.docRoot = crossRef["docs-root"];
        }
        if (github["project"]) {
            result.project = github["project"];
        }
        if (github["epic-type"]) {
            result.epicType = github["epic-type"];
        }
        return result;
    } catch {
        return {};
    }
}

/** Read docRoot from settings, defaulting to a placeholder if missing. */
export function getDocRoot(repoRoot: string): string {
    const settings = readSettings(repoRoot);
    const docRoot = settings.docRoot ?? DEFAULT_DOC_ROOT;

    // Ensure docRoot ends with a slash for proper concatenation
    return docRoot.replace(/\/+$/, "") + "/";
}
