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
 *   variable exists precisely to name a location other than the harness's default directory
 *   under a home directory, so a
 *   mirror that appends that fixed name itself cannot express the install location at all. The join
 *   moved out to the repository-facing callers.
 * - **An empty payload is a declared mode**, never an empty directory. The throw on a missing
 *   payload is the only thing standing between "the install could not find what it ships" and
 *   "delete every component this account has"; expressing removal as a mirror of an empty directory
 *   would make those two states indistinguishable at this boundary.
 *
 * One shape epic #677 adds: **a package sweeps what it placed, not what carries the prefix**. The
 * namespace is shared by design — a stage a second package ships is still invoked as `/nxs.<name>`
 * — so scoping the sweep by prefix would have each package delete the other's files on every
 * install. Each install records the paths it placed, under the name of the package that placed
 * them, and no package removes a path another package's record claims. A root with no record yet
 * is the state every existing install is in: the sweep is unscoped there, exactly as before, and
 * the record it writes is what scopes the next one.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { isNexusNamespaced, isNexusNamespacedPath } from "./nexus-namespace.js";
import { COMPONENT_SUBTREES, listComponentFiles } from "./vendor-components.js";

/**
 * Where a component root records which package placed which file. A dotfile at the root's top
 * level, which the sweep never looks at: the top level holds the harness's own account state and
 * is out of bounds to every caller but migration, and migration matches on the namespace prefix
 * this name does not carry.
 */
export const INSTALL_LEDGER_FILE = ".nexus-install.json";

/** Component-root-relative paths, by the name of the package that placed them. */
export type InstallLedger = Record<string, string[]>;

/** The record a component root holds, or an empty one when it holds none or holds nonsense. */
export function readInstallLedger(componentRoot: string): InstallLedger {
    const file: string = path.join(componentRoot, INSTALL_LEDGER_FILE);
    if (!fs.existsSync(file)) {
        return {};
    }
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {};
        }
        const ledger: InstallLedger = {};
        for (const [owner, paths] of Object.entries(parsed as Record<string, unknown>)) {
            if (Array.isArray(paths) && paths.every((p) => typeof p === "string")) {
                ledger[owner] = paths as string[];
            }
        }
        return ledger;
    } catch {
        // An unreadable record reads as no record: the sweep falls back to its unscoped shape,
        // which is the behaviour of every root that predates the record in the first place.
        return {};
    }
}

function writeInstallLedger(componentRoot: string, ledger: InstallLedger): void {
    const file: string = path.join(componentRoot, INSTALL_LEDGER_FILE);
    if (Object.keys(ledger).length === 0) {
        fs.rmSync(file, { force: true });
        return;
    }
    const ordered: InstallLedger = {};
    for (const owner of Object.keys(ledger).sort()) {
        ordered[owner] = [...ledger[owner]].sort();
    }
    fs.mkdirSync(componentRoot, { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(ordered, null, 4)}\n`);
}

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
    /**
     * The package this install speaks for. Naming it scopes the sweep to what that package placed
     * and records the result. Leaving it out keeps the unscoped sweep — every namespaced file the
     * payload no longer carries — which is the shape migration asks for against a repository.
     */
    owner?: string;
}

export interface DeployResult {
    /** Component-root-relative paths written (created or overwritten). */
    written: string[];
    /** Component-root-relative paths of Nexus-namespaced files removed from the target. */
    removed: string[];
    /** Paths the mirror owns and would have removed, but `removable` vetoed. */
    retained: string[];
    /**
     * Paths this payload wrote that another installed package's record also claims — a collision
     * the caller has to hear about rather than one the mirror can resolve. The other package's
     * files that this run merely left alone are not a collision and are not named: that is the
     * ordinary state of a shared root.
     */
    claimedByOthers: string[];
}

/** True only for a directory the path itself names — never for a pointer at one (invariant 6). */
function isRealDirectory(candidate: string): boolean {
    try {
        return fs.lstatSync(candidate).isDirectory();
    } catch {
        return false;
    }
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

/**
 * Remove now-empty directories left behind under `root` after stale-file removal. A pointer standing
 * where a directory should be is an entry, never a door (invariant 6): `lstat`, so a link is left
 * alone rather than followed out of the component root.
 */
function pruneEmptyDirs(root: string): void {
    if (!isRealDirectory(root)) {
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

    // Who else has a stake in this root. A package never removes a path another package's record
    // claims, and says so when its own payload writes over one.
    const ledger: InstallLedger = options.owner === undefined ? {} : readInstallLedger(componentRoot);
    const foreign = new Set<string>();
    for (const [owner, paths] of Object.entries(ledger)) {
        if (owner !== options.owner) {
            for (const rel of paths) {
                foreign.add(rel);
            }
        }
    }
    // Scoped to what this package placed — unless it has placed nothing yet, which is the state of
    // every root installed before the record existed. There the sweep stays unscoped and adopts
    // what it finds, and the record written below scopes the next run.
    const mine: Set<string> | null =
        options.owner !== undefined && ledger[options.owner] !== undefined ? new Set(ledger[options.owner]) : null;

    const claimedByOthers: string[] = [];
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
        if (foreign.has(rel)) {
            claimedByOthers.push(rel);
        }
    }

    // Convergence: drop Nexus-namespaced files the managed set no longer carries.
    const candidates: string[] = [];
    for (const subtree of COMPONENT_SUBTREES) {
        const subtreeRoot: string = path.join(componentRoot, subtree);
        if (!isRealDirectory(subtreeRoot)) {
            continue;
        }
        const existing: string[] = [];
        walkFiles(subtreeRoot, componentRoot, existing);
        for (const rel of existing) {
            if (isNexusNamespacedPath(rel)) {
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
        if (foreign.has(rel)) {
            continue;
        }
        if (mine !== null && !mine.has(rel)) {
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

    if (options.owner !== undefined) {
        const next: InstallLedger = { ...ledger };
        if (payloadFiles.length === 0) {
            delete next[options.owner];
        } else {
            next[options.owner] = payloadFiles;
        }
        writeInstallLedger(componentRoot, next);
    }

    return { written, removed, retained, claimedByOthers: Array.from(new Set(claimedByOthers)).sort() };
}
