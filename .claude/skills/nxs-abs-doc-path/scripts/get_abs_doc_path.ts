#!/usr/bin/env tsx
/**
 * Convert a repository-relative path to an absolute GitHub URL.
 *
 * Reads `cross-ref.docs-root` from .nexus/config/settings.yml and appends the
 * provided relative path. Falls back to a placeholder default if the settings
 * file is missing or the setting isn't set.
 *
 * Usage:
 *     tsx get_abs_doc_path.ts <relative-path>
 *     tsx get_abs_doc_path.ts <relative-path1> <relative-path2> ...
 *
 * Examples:
 *     tsx get_abs_doc_path.ts docs/features/tagging/README.md
 *     tsx get_abs_doc_path.ts "docs/features/tagging/README.md" "docs/system/delivery/task-labels.md"
 *
 * Output:
 *     The absolute URL(s), one per line
 *     e.g., https://github.com/user/repo/blob/main/docs/features/tagging/README.md
 *
 * Exit codes:
 *     0 - Success
 *     3 - Invalid arguments
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";

const DEFAULT_DOC_ROOT = "https://github.com/{username|orgname}/{reponame}/blob/main/docs";

interface Settings {
	docRoot?: string;
	project?: string;
	epicType?: string;
}

/** Parse the 2-level nested settings.yml format without external dependencies. */
function parseSimpleYaml(content: string): Record<string, Record<string, string>> {
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
function readSettings(projectRoot: string): Settings {
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

/** Find the repository root by looking for common markers. */
function findRepoRoot(): string {
	let current = process.cwd();
	const { root } = parse(current);

	// Walk up looking for .git or settings file
	while (true) {
		if (existsSync(join(current, ".git"))) {
			return current;
		}
		if (existsSync(join(current, ".nexus", "config", "settings.yml"))) {
			return current;
		}
		if (current === root) {
			break;
		}
		current = dirname(current);
	}

	// Fallback to current directory
	return process.cwd();
}

/** Read docRoot from settings, defaulting to a placeholder if missing. */
function getDocRoot(repoRoot: string): string {
	const settings = readSettings(repoRoot);
	const docRoot = settings.docRoot ?? DEFAULT_DOC_ROOT;

	// Ensure docRoot ends with a slash for proper concatenation
	return docRoot.replace(/\/+$/, "") + "/";
}

/**
 * Normalize the relative path: remove leading ./ or /, and strip a leading
 * docs/ segment since docRoot already points at the docs directory.
 */
function normalizeRelativePath(path: string): string {
	let normalized = path.trim();

	// Handle relative path prefixes
	while (normalized.startsWith("./")) {
		normalized = normalized.slice(2);
	}
	// For parent references (../), we keep them as-is; the caller should
	// provide paths relative to the repo root.

	// Remove leading slash if present
	normalized = normalized.replace(/^\/+/, "");

	// docRoot already points at the docs/ directory; strip a leading docs/
	// segment so callers can keep passing repo-relative paths unchanged.
	normalized = normalized.replace(/^docs\//, "");

	return normalized;
}

/** Convert a relative path to an absolute GitHub URL. */
function toAbsoluteUrl(relativePath: string): string {
	const repoRoot = findRepoRoot();
	const docRoot = getDocRoot(repoRoot);
	const normalizedPath = normalizeRelativePath(relativePath);

	return `${docRoot}${normalizedPath}`;
}

function main(): void {
	const args = process.argv.slice(2);
	if (args.length < 1) {
		process.stderr.write("Usage: tsx get_abs_doc_path.ts <relative-path>\n");
		process.stderr.write("       tsx get_abs_doc_path.ts <path1> <path2> ...\n");
		process.exit(3);
	}

	// Support multiple paths
	for (const relPath of args) {
		process.stdout.write(toAbsoluteUrl(relPath) + "\n");
	}
}

main();
