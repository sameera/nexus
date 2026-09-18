/**
 * The per-run planning folder `/nxs.epic` drafts into (decision record #646).
 *
 * A run folder lives under its own namespace, one level deeper than `.nexus/tmp/epic-<N>/epic.md`
 * (`write.ts`), so a folder keyed on a run name can never sit directly under `.nexus/tmp/` and
 * either look drainable or overwrite a resolver materialization for the same number. The namespace
 * is still inside `.nexus/tmp/`, so it inherits that directory's gitignore rule with no rule of its
 * own (decision record #646, "the setup stage writes the ignore rule for the scratch area").
 */

import * as fs from "node:fs";
import * as path from "node:path";

/** The gitignored namespace under which every run's planning folder lives. */
export const PLANNING_NAMESPACE = path.join(".nexus", "tmp", "planning");

/** A name-shaped token: no path separator, no leading dot, nothing a traversal could exploit. */
const SAFE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function isSafeName(name: string): boolean {
    return SAFE_NAME_RE.test(name) && name !== "." && name !== "..";
}

/** The run folder's path for `name`, relative to `root`. The name is fixed for the run's life. */
export function planningDirPath(root: string, name: string): string {
    return path.join(root, PLANNING_NAMESPACE, name);
}

/** Create (or reuse) the run folder for `name`, creating parents. Returns its path. */
export function ensurePlanningDir(root: string, name: string): string {
    const target = planningDirPath(root, name);
    fs.mkdirSync(target, { recursive: true });
    return target;
}

/** Every run folder currently under the planning namespace — a resume check's candidate list. */
export function listPlanningDirs(root: string): string[] {
    const namespace = path.join(root, PLANNING_NAMESPACE);
    if (!fs.existsSync(namespace)) {
        return [];
    }
    return fs
        .readdirSync(namespace, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
}

export type RemovePlanningDirResult =
    | { ok: true; path: string; removed: boolean }
    | { ok: false; error: string };

/**
 * Remove a run's own folder, and nothing else. Refuses a name that is not a plain, single path
 * segment — the guard decision record #646 requires before a recursive delete runs inside the
 * lead's checkout — and is a no-op (not a failure) when the folder is already gone, so a repeated
 * cleanup on a run that already deleted itself stays harmless.
 */
export function removePlanningDir(root: string, name: string): RemovePlanningDirResult {
    if (!isSafeName(name)) {
        return { ok: false, error: `refuses to remove an unsafe planning-dir name: '${name}'` };
    }
    const target = planningDirPath(root, name);
    if (!fs.existsSync(target)) {
        return { ok: true, path: target, removed: false };
    }
    fs.rmSync(target, { recursive: true, force: true });
    return { ok: true, path: target, removed: true };
}
