#!/usr/bin/env tsx
/**
 * Convert a repository-relative path to an absolute GitHub URL.
 *
 * Reads `cross-ref.docs-root` from .nexus/config/settings.yml and appends the
 * provided relative path, after stripping exactly the resolved workspace docs
 * root (epic #74) — `docs/` for a single-repo checkout or a workspace member,
 * or nothing for a hub whose docs root is the repo root. The resolver
 * (`@nexus/workspace/resolve`) is the sole producer of that value; this script
 * never re-derives it. Falls back to a placeholder cross-ref URL if the
 * settings file is missing or the setting isn't set.
 *
 * The resolved docs root and the cross-ref URL must agree (Invariant 7): if
 * the URL's trailing path segment doesn't match the resolved docs root, that
 * is an operator misconfiguration, surfaced as an error rather than a dead
 * link.
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
 *     1 - Workspace resolution failed, or the cross-ref URL disagrees with the resolved docs root
 *     3 - Invalid arguments
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { localDocsRoot } from "@nexus/workspace/resolve";

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
 * Normalize the relative path: remove leading ./ or /, then strip exactly the
 * resolved docs root once. A "." docs root (repo root) strips nothing.
 */
function normalizeRelativePath(path: string, docsRoot: string): string {
	let normalized = path.trim();

	// Handle relative path prefixes
	while (normalized.startsWith("./")) {
		normalized = normalized.slice(2);
	}
	// For parent references (../), we keep them as-is; the caller should
	// provide paths relative to the repo root.

	// Remove leading slash if present
	normalized = normalized.replace(/^\/+/, "");

	// Strip exactly the resolved docs root, once — never a hardcoded "docs/".
	if (docsRoot !== ".") {
		const prefix = `${docsRoot.replace(/\/+$/, "")}/`;
		if (normalized.startsWith(prefix)) {
			normalized = normalized.slice(prefix.length);
		}
	}

	return normalized;
}

/**
 * Extract the in-repo path the cross-ref URL points at — the segment after
 * `/blob/<ref>/` or `/tree/<ref>/` — normalized like a resolved docs root:
 * "." for the repo root (no trailing path after the ref), else the trailing
 * path with no trailing slash. Returns null when the URL carries no
 * recognizable GitHub blob/tree path, in which case the agreement check is
 * skipped rather than guessed at.
 */
function extractUrlDocsRoot(url: string): string | null {
	const match = url.replace(/\/+$/, "").match(/\/(?:blob|tree)\/[^/]+(?:\/(.*))?$/);
	if (!match) {
		return null;
	}
	return match[1] && match[1] !== "" ? match[1] : ".";
}

/** Convert a relative path to an absolute GitHub URL. */
function toAbsoluteUrl(relativePath: string, docRoot: string, docsRoot: string): string {
	const normalizedPath = normalizeRelativePath(relativePath, docsRoot);
	return `${docRoot}${normalizedPath}`;
}

function main(): void {
	const args = process.argv.slice(2);
	if (args.length < 1) {
		process.stderr.write("Usage: tsx get_abs_doc_path.ts <relative-path>\n");
		process.stderr.write("       tsx get_abs_doc_path.ts <path1> <path2> ...\n");
		process.exit(3);
	}

	const repoRoot = findRepoRoot();
	const docsRootResult = localDocsRoot(repoRoot);
	if (!docsRootResult.ok) {
		process.stderr.write(
			`Workspace resolution failed: ${docsRootResult.error.problem} — ${docsRootResult.error.message}\n`,
		);
		process.exit(1);
	}
	const docsRoot = docsRootResult.docsRoot;

	const docRoot = getDocRoot(repoRoot);
	const urlDocsRoot = extractUrlDocsRoot(docRoot);
	if (urlDocsRoot !== null && urlDocsRoot !== docsRoot) {
		const describe = (root: string) => (root === "." ? "the repo root" : `'${root}'`);
		process.stderr.write(
			`cross-ref.docs-root URL disagrees with the resolved docs root: the URL points at ` +
				`${describe(urlDocsRoot)} but the resolved docs root is ${describe(docsRoot)}. Fix ` +
				`.nexus/config/settings.yml's cross-ref.docs-root (or the workspace docs-root ` +
				`override) so they agree.\n`,
		);
		process.exit(1);
	}

	// Support multiple paths
	for (const relPath of args) {
		process.stdout.write(toAbsoluteUrl(relPath, docRoot, docsRoot) + "\n");
	}
}

main();
