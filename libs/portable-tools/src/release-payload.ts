/**
 * The shipped payload, as an explicit set (story #309).
 *
 * The payload used to be "whatever is on disk under the directories we copy". That made its
 * fingerprint machine-dependent and shipped files an adopter would never run. What ships is now
 * stated here, and the fingerprint is taken over exactly that set.
 *
 * The filter is a denylist of *incidental* entries rather than an allowlist of files, because a
 * new file that belongs in the payload must ship the moment it is written. Story #392 emptied it:
 * every entry it carried existed to exclude an interpreter's byte-code or an interpreter's tests,
 * and the payload no longer walks a tree that can contain either.
 */

import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { authoredTemplateMasterDir, SEEDED_TEMPLATES, TEMPLATE_PAYLOAD_DIRNAME } from "./seed-templates.js";
import { authoredComponentRoot, COMPONENT_PAYLOAD_DIRNAME, listComponentFiles } from "./vendor-components.js";

/** Key of the payload entry in the committed fingerprint pin — one entry for the whole payload. */
export const PAYLOAD_KEY = "payload";

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
    for (const name of SEEDED_TEMPLATES) {
        files.push({ staged: `${TEMPLATE_PAYLOAD_DIRNAME}/${name}`, source: path.join(masterDir, name) });
    }
    // Code-unit order, not locale order: a locale-sensitive comparison would make the
    // canonical manifest — and so the fingerprint — a property of the machine.
    return files.sort((a, b) => (a.staged < b.staged ? -1 : a.staged > b.staged ? 1 : 0));
}

/**
 * sha256 of the payload's canonical manifest: one `stagedpath\ncontent-sha256\n` record per file,
 * sorted by staged path. Nothing outside the stated set contributes, so two clean checkouts of
 * the same commit hash identically whatever the machine has cached.
 */
export function hashPayload(repoRoot: string): string {
    const manifest = createHash("sha256");
    for (const file of listPayloadFiles(repoRoot)) {
        manifest.update(file.staged);
        manifest.update("\n");
        manifest.update(createHash("sha256").update(fs.readFileSync(file.source)).digest("hex"));
        manifest.update("\n");
    }
    return manifest.digest("hex");
}

/** Per-file content hashes of the payload, keyed by staged path. Diagnostic, not the pin. */
export type PayloadManifest = Record<string, string>;

/** Name of the committed manifest that sits beside the pin. */
export const PAYLOAD_MANIFEST_FILE = "payload-manifest.json";

export function payloadManifest(repoRoot: string): PayloadManifest {
    const manifest: PayloadManifest = {};
    for (const file of listPayloadFiles(repoRoot)) {
        manifest[file.staged] = createHash("sha256").update(fs.readFileSync(file.source)).digest("hex");
    }
    return manifest;
}

/**
 * What changed between the payload the manifest recorded and the payload on disk now, as one
 * line per difference. Empty when the two agree — this is how the gate names what differs
 * rather than only reporting that two digests are unequal.
 */
export function diffPayloadManifest(recorded: PayloadManifest, current: PayloadManifest): string[] {
    const differences: string[] = [];
    for (const staged of Object.keys(current).sort()) {
        if (!(staged in recorded)) {
            differences.push(`added: ${staged}`);
        } else if (recorded[staged] !== current[staged]) {
            differences.push(`changed: ${staged}`);
        }
    }
    for (const staged of Object.keys(recorded).sort()) {
        if (!(staged in current)) {
            differences.push(`removed: ${staged}`);
        }
    }
    return differences;
}
