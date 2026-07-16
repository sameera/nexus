/**
 * The component-deploy primitive (STORY-60.01) — the sole `.claude/` installer. Both
 * `nexus deploy` (single repo) and `nexus workspace init` (fan-out) drive this one function;
 * nothing else writes components.
 *
 * Semantics fixed by the decision record: a file-tree MIRROR over the explicit managed set, not
 * a blind directory copy and not a merge. Every payload file is written into the target's
 * `.claude/` (created or overwritten in place), and any file in the managed subtrees that
 * carries the Nexus namespace prefix (`nxs.` / `nxs-`) but is no longer in the payload is
 * removed — so a second run with no upstream change converges to an identical component set.
 * User-owned files — `settings.local.json`, any non-Nexus-prefixed file — are never touched.
 * Idempotency comes from "make the destination match the managed set", never from timestamps
 * or diffs.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { COMPONENT_SUBTREES, listComponentFiles } from "./vendor-components.js";

export interface DeployResult {
    /** Payload-relative paths written (created or overwritten). */
    written: string[];
    /** Payload-relative paths of stale Nexus-namespaced files removed from the target. */
    removed: string[];
}

/** True for the file names Nexus owns: the `nxs.`/`nxs-` namespace the update script managed. */
function isNexusNamespaced(segment: string): boolean {
    return segment.startsWith("nxs.") || segment.startsWith("nxs-");
}

function walkFiles(dir: string, base: string, out: string[]): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs: string = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walkFiles(abs, base, out);
        } else {
            out.push(path.relative(base, abs).split(path.sep).join("/"));
        }
    }
}

/** Remove now-empty directories left behind under `root` after stale-file removal. */
function pruneEmptyDirs(root: string): void {
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
        return;
    }
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            pruneEmptyDirs(path.join(root, entry.name));
        }
    }
    if (fs.readdirSync(root).length === 0) {
        fs.rmdirSync(root);
    }
}

/**
 * Mirror the managed component set from `payloadDir` into `<targetRepoRoot>/.claude/`.
 * Read-only toward everything outside the managed set.
 */
export function deployComponents(payloadDir: string, targetRepoRoot: string): DeployResult {
    if (!fs.existsSync(payloadDir) || !fs.statSync(payloadDir).isDirectory()) {
        throw new Error(`component payload not found at ${payloadDir}`);
    }

    const payloadFiles: string[] = listComponentFiles(payloadDir);
    const payloadSet = new Set<string>(payloadFiles);
    const claudeDir: string = path.join(targetRepoRoot, ".claude");

    const written: string[] = [];
    for (const rel of payloadFiles) {
        const segments: string[] = rel.split("/");
        const dest: string = path.join(claudeDir, ...segments);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(path.join(payloadDir, ...segments), dest);
        written.push(rel);
    }

    // Convergence: drop Nexus-namespaced files the managed set no longer carries. A path is
    // Nexus-namespaced when its first segment under the subtree carries the nxs prefix — this
    // scopes removal to files the update path has always owned and keeps user files safe.
    const removed: string[] = [];
    for (const subtree of COMPONENT_SUBTREES) {
        const subtreeRoot: string = path.join(claudeDir, subtree);
        if (!fs.existsSync(subtreeRoot) || !fs.statSync(subtreeRoot).isDirectory()) {
            continue;
        }
        const existing: string[] = [];
        walkFiles(subtreeRoot, claudeDir, existing);
        for (const rel of existing) {
            const firstSegment: string = rel.split("/")[1];
            if (isNexusNamespaced(firstSegment) && !payloadSet.has(rel)) {
                fs.rmSync(path.join(claudeDir, ...rel.split("/")));
                removed.push(rel);
            }
        }
        pruneEmptyDirs(subtreeRoot);
    }

    return { written, removed: removed.sort() };
}
