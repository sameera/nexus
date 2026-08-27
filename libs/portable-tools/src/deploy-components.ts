/**
 * The component-mirror primitive (STORY-60.01, reshaped by decision record #339) — the sole
 * component installer. Install at the account's configuration directory, removal from it, the
 * repository migration and `nexus deploy` are four callers of this one function; nothing else
 * writes components.
 *
 * Semantics: a file-tree MIRROR over the explicit managed set, not a blind directory copy and not
 * a merge. Every payload file is written into the component root (created or overwritten in place),
 * and any file in the managed subtrees whose first segment beneath the subtree carries the Nexus
 * namespace prefix but is no longer in the payload is removed — so a second run with no upstream
 * change converges to an identical component set. User-owned files are never touched. Idempotency
 * comes from "make the destination match the managed set", never from timestamps or diffs.
 *
 * Two shapes the record fixed:
 *
 * - **The target is the component root itself**, not a repository root. The configuration-directory
 *   variable exists precisely to name a location that is not `.claude` under a home directory, so a
 *   mirror that appends that fixed name itself cannot express the install location at all. The join
 *   moved out to the repository-facing callers.
 * - **An empty payload is a declared mode**, never an empty directory. The throw on a missing
 *   payload is the only thing standing between "the install could not find what it ships" and
 *   "delete every component this account has"; expressing removal as a mirror of an empty directory
 *   would make those two states indistinguishable at this boundary.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { isNexusNamespaced } from "./nexus-namespace.js";
import { COMPONENT_SUBTREES, listComponentFiles } from "./vendor-components.js";

/** What to mirror: a payload directory, or emptiness said out loud. */
export type ComponentPayload = { kind: "directory"; dir: string } | { kind: "empty" };

/** Removal semantics — the only way to ask this primitive to end with nothing installed. */
export const EMPTY_PAYLOAD: ComponentPayload = { kind: "empty" };

/** The ordinary payload: the managed set under `dir`. */
export function payloadDirectory(dir: string): ComponentPayload {
    return { kind: "directory", dir };
}

/** How a payload file is placed: as its bytes, or as a pointer at the file the payload holds. */
export type WriteMode = "copy" | "pointer";

export interface MirrorOptions {
    /** Default `copy`. `pointer` writes one pointer per payload file (the maintainer's mode). */
    mode?: WriteMode;
    /**
     * Also treat Nexus-namespaced files at the component root's top level as owned. Migration only:
     * repositories carry such files, while the install location's top level holds the harness's own
     * account state and must never be swept (invariant 5).
     */
    includeRootLevel?: boolean;
    /** Veto a removal. A path this rejects is reported in `retained` and left in place. */
    removable?: (rel: string) => boolean;
}

export interface DeployResult {
    /** Component-root-relative paths written (created or overwritten). */
    written: string[];
    /** Component-root-relative paths of Nexus-namespaced files removed from the target. */
    removed: string[];
    /** Paths the mirror owns and would have removed, but `removable` vetoed. */
    retained: string[];
}

function walkFiles(dir: string, base: string, out: string[]): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs: string = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walkFiles(abs, base, out);
        } else {
            // A pointer is an entry, never a door: `isDirectory()` is false for a link to a
            // directory, so no traversal ever leaves the location we were given (invariant 6).
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
 * Mirror `payload` into `componentRoot`. Read-only toward everything outside the managed set, and
 * — unless `includeRootLevel` says otherwise — toward the component root's own top level.
 */
export function deployComponents(payload: ComponentPayload, componentRoot: string, options: MirrorOptions = {}): DeployResult {
    let payloadFiles: string[] = [];
    if (payload.kind === "directory") {
        if (!fs.existsSync(payload.dir) || !fs.statSync(payload.dir).isDirectory()) {
            throw new Error(`component payload not found at ${payload.dir}`);
        }
        payloadFiles = listComponentFiles(payload.dir);
    }
    const payloadSet = new Set<string>(payloadFiles);

    const written: string[] = [];
    for (const rel of payloadFiles) {
        const segments: string[] = rel.split("/");
        const dest: string = path.join(componentRoot, ...segments);
        const src: string = path.join((payload as { dir: string }).dir, ...segments);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        // Unlink first: overwriting in place would write THROUGH a pointer left by an earlier
        // pointing install, straight into the maintainer's checkout.
        fs.rmSync(dest, { force: true });
        if ((options.mode ?? "copy") === "pointer") {
            fs.symlinkSync(src, dest);
        } else {
            fs.copyFileSync(src, dest);
        }
        written.push(rel);
    }

    // Convergence: drop Nexus-namespaced files the managed set no longer carries.
    const candidates: string[] = [];
    for (const subtree of COMPONENT_SUBTREES) {
        const subtreeRoot: string = path.join(componentRoot, subtree);
        if (!fs.existsSync(subtreeRoot) || !fs.statSync(subtreeRoot).isDirectory()) {
            continue;
        }
        const existing: string[] = [];
        walkFiles(subtreeRoot, componentRoot, existing);
        for (const rel of existing) {
            if (isNexusNamespaced(rel.split("/")[1])) {
                candidates.push(rel);
            }
        }
    }
    if (options.includeRootLevel === true && fs.existsSync(componentRoot)) {
        for (const entry of fs.readdirSync(componentRoot, { withFileTypes: true })) {
            if (!entry.isDirectory() && isNexusNamespaced(entry.name)) {
                candidates.push(entry.name);
            }
        }
    }

    const removed: string[] = [];
    const retained: string[] = [];
    for (const rel of candidates.sort()) {
        if (payloadSet.has(rel)) {
            continue;
        }
        if (options.removable !== undefined && !options.removable(rel)) {
            retained.push(rel);
            continue;
        }
        fs.rmSync(path.join(componentRoot, ...rel.split("/")));
        removed.push(rel);
    }
    for (const subtree of COMPONENT_SUBTREES) {
        pruneEmptyDirs(path.join(componentRoot, subtree));
    }

    return { written, removed, retained };
}
