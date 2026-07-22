/**
 * Writing the materialized epic to its ephemeral, gitignored home (Invariant 4 / Story 1 AC3).
 *
 * The default location is `<root>/.nexus/tmp/epic-<N>/epic.md`: keyed on the epic issue number
 * (the sole join key), at a predictable repo-relative path a downstream stage can find, yet under
 * `.nexus/tmp/` which the repo `.gitignore` excludes — so a resolver run leaves `git status`
 * reporting no new tracked file. Only ever called on a successful resolve.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/** The gitignored directory under which materialized epics live. */
export const MATERIALIZED_DIR = path.join(".nexus", "tmp");

/** The default materialized-epic path for an epic issue number, relative to `root`. */
export function defaultOutPath(root: string, epicNumber: number): string {
    return path.join(root, MATERIALIZED_DIR, `epic-${epicNumber}`, "epic.md");
}

/** Write the markdown to `outPath` (default derived from `root`+`epicNumber`), creating parents. */
export function writeMaterializedEpic(root: string, epicNumber: number, markdown: string, outPath?: string): string {
    const target = outPath ?? defaultOutPath(root, epicNumber);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, markdown);
    return target;
}
