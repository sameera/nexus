#!/usr/bin/env tsx
/**
 * Convert a repository-relative path to an absolute GitHub URL.
 *
 * Reads the `docRoot` attribute from docs/system/delivery/config.yml
 * (cross-ref.docs-root) or config.json (docRoot) and appends the provided
 * relative path.
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
 *     e.g., https://github.com/user/repo/tree/main/docs/features/tagging/README.md
 *
 * Exit codes:
 *     0 - Success
 *     1 - Config file not found (neither config.yml nor config.json)
 *     2 - docRoot not found in config
 *     3 - Invalid arguments
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";

interface DeliveryConfig {
	docRoot?: string;
	project?: string;
	epicType?: string;
}

/** Parse the 2-level nested config.yml format without external dependencies. */
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

/**
 * Read delivery config from config.yml (preferred) or config.json (fallback).
 * Returns a normalized dict with keys: docRoot, project, epicType.
 */
function readDeliveryConfig(projectRoot: string): DeliveryConfig {
	const deliveryDir = join(projectRoot, "docs", "system", "delivery");

	const ymlPath = join(deliveryDir, "config.yml");
	if (existsSync(ymlPath)) {
		try {
			const raw = parseSimpleYaml(readFileSync(ymlPath, "utf-8"));
			const result: DeliveryConfig = {};
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
			// fall through to JSON
		}
	}

	const jsonPath = join(deliveryDir, "config.json");
	if (existsSync(jsonPath)) {
		try {
			return JSON.parse(readFileSync(jsonPath, "utf-8")) as DeliveryConfig;
		} catch {
			// fall through to empty
		}
	}

	return {};
}

/** Find the repository root by looking for common markers. */
function findRepoRoot(): string {
	let current = process.cwd();
	const { root } = parse(current);

	// Walk up looking for .git or delivery config
	while (true) {
		if (existsSync(join(current, ".git"))) {
			return current;
		}
		const delivery = join(current, "docs", "system", "delivery");
		if (existsSync(join(delivery, "config.yml")) || existsSync(join(delivery, "config.json"))) {
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

/** Read docRoot from delivery config (config.yml or config.json). */
function getDocRoot(repoRoot: string): string {
	const config = readDeliveryConfig(repoRoot);
	const docRoot = config.docRoot;

	if (!docRoot) {
		const deliveryDir = join(repoRoot, "docs", "system", "delivery");
		if (!existsSync(join(deliveryDir, "config.yml")) && !existsSync(join(deliveryDir, "config.json"))) {
			process.stderr.write(`Error: Config file not found in ${deliveryDir}\n`);
			process.exit(1);
		}
		process.stderr.write("Error: 'docRoot' / 'cross-ref.docs-root' not found in delivery config\n");
		process.exit(2);
	}

	// Ensure docRoot ends with a slash for proper concatenation
	return docRoot.replace(/\/+$/, "") + "/";
}

/** Normalize the relative path (remove leading ./ or /). */
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
