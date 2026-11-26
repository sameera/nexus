/**
 * The shipped payload, as an explicit set (story #309).
 *
 * The payload used to be "whatever is on disk under the directories we copy". That shipped files
 * an adopter would never run. What ships is now stated here.
 *
 * The filter is a denylist of *incidental* entries rather than an allowlist of files, because a
 * new file that belongs in the payload must ship the moment it is written. Story #392 emptied it:
 * every entry it carried existed to exclude an interpreter's byte-code or an interpreter's tests,
 * and the payload no longer walks a tree that can contain either.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { authoredTemplateMasterDir, RELEASE_TEMPLATES, TEMPLATE_PAYLOAD_DIRNAME } from "./template-lookup.js";
import { authoredComponentRoot, COMPONENT_PAYLOAD_DIRNAME, listComponentFiles } from "./vendor-components.js";

/**
 * The stated ignore filter. Each entry is a directory or file name matched exactly, or a
 * `*.<ext>` suffix pattern.
 *
 * It is empty: the four entries it carried — `__pycache__`, `*.pyc`, `tests`, `test_*.py` —
 * existed only to keep an interpreter's byte-code and an interpreter's tests out of the payload,
 * and story #392 removed the tree that held them. Naming a pattern that can never match again
 * would read as though the payload still carried an interpreter's output. The mechanism stays,
 * because the next incidental category is named here rather than in a new filter.
 */
export const PAYLOAD_IGNORE: readonly string[] = [];

/** True when the filter excludes an entry by its own name, whatever directory it sits in. */
export function isIgnoredPayloadEntry(name: string): boolean {
    for (const pattern of PAYLOAD_IGNORE) {
        if (pattern.startsWith("*")) {
            if (name.endsWith(pattern.slice(1))) {
                return true;
            }
        } else if (pattern.endsWith("*")) {
            if (name.startsWith(pattern.slice(0, -1))) {
                return true;
            }
        } else if (pattern.includes("*")) {
            const [head, tail] = pattern.split("*");
            if (name.startsWith(head) && name.endsWith(tail) && name.length >= head.length + tail.length) {
                return true;
            }
        } else if (name === pattern) {
            return true;
        }
    }
    return false;
}

/** One payload file: where it is staged in the release tree, and where it came from. */
export interface PayloadFile {
    /** Path relative to the release tree root, posix-style. */
    staged: string;
    /** Absolute path in the checkout. */
    source: string;
}

function walk(dir: string, stagedPrefix: string, out: PayloadFile[]): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
        if (isIgnoredPayloadEntry(entry.name)) {
            continue;
        }
        const abs: string = path.join(dir, entry.name);
        const staged: string = `${stagedPrefix}/${entry.name}`;
        if (entry.isDirectory()) {
            walk(abs, staged, out);
        } else {
            out.push({ staged, source: abs });
        }
    }
}

/**
 * Every file the release payload carries, sorted by staged path. Two parts: the managed component
 * subtrees, which `listComponentFiles` already defines; and the tool-agnostic template masters,
 * which travel so that a repository outside this checkout can be seeded from the release rather
 * than from a path that only exists here (story #323).
 */
export function listPayloadFiles(repoRoot: string): PayloadFile[] {
    const files: PayloadFile[] = [];
    const srcDir: string = path.join(repoRoot, "libs", "portable-tools", "src");
    const claudeDir: string = authoredComponentRoot(srcDir);
    for (const rel of listComponentFiles(claudeDir)) {
        files.push({
            staged: `${COMPONENT_PAYLOAD_DIRNAME}/${rel}`,
            source: path.join(claudeDir, ...rel.split("/")),
        });
    }

    const masterDir: string = authoredTemplateMasterDir(srcDir);
    for (const name of RELEASE_TEMPLATES) {
        files.push({ staged: `${TEMPLATE_PAYLOAD_DIRNAME}/${name}`, source: path.join(masterDir, name) });
    }
    // Code-unit order, not locale order: a locale-sensitive comparison would make the order a
    // property of the machine.
    return files.sort((a, b) => (a.staged < b.staged ? -1 : a.staged > b.staged ? 1 : 0));
}
