/**
 * The single-remover guard for the committed queue (epic #215, decision record #514, invariant 6).
 *
 * Retiring the close-and-migrate path was supposed to leave exactly one code path anywhere in the
 * toolkit that removes a committed `.nexus/queue/` entry: the drain's own staged deletion, on its
 * own branch, landed only when that branch's pull request merges. This guard is the tripwire —
 * it walks every shipped file (TypeScript source and the authored command/skill bodies) for a
 * `git rm` targeting a queue path, and asserts the file set that contains one is exactly the
 * waiver list. Scoped to the *committed* queue: the drain's own cleanup of a consumed, ephemeral
 * materialization under `.nexus/tmp/` is a different, already-governed rule and is not in scope.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/** One shipped file that removes a committed queue entry via `git rm`. */
export interface QueueRemoval {
    /** Posix-style path relative to the repo root. */
    relPath: string;
    /** The matching line(s), for a human to see what tripped the guard. */
    lines: string[];
}

const GIT_RM_QUEUE = /\bgit\s+rm\b.*\.nexus\/queue/;

function isCodeOrComponentFile(relPath: string): boolean {
    return (
        (relPath.endsWith(".ts") && !relPath.endsWith(".spec.ts") && relPath.startsWith("libs/") && relPath.includes("/src/")) ||
        (relPath.endsWith(".md") && relPath.startsWith("components/"))
    );
}

/** Every relative file path under `root`, skipping `dist`, `node_modules`, and dotfiles. */
function walk(root: string, dir: string, out: string[]): void {
    for (const name of fs.readdirSync(dir)) {
        if (name === "node_modules" || name === "dist" || name.startsWith(".")) {
            continue;
        }
        const abs = path.join(dir, name);
        const stat = fs.statSync(abs);
        if (stat.isDirectory()) {
            walk(root, abs, out);
        } else {
            out.push(path.relative(root, abs).split(path.sep).join("/"));
        }
    }
}

/**
 * Walks `repoRoot` for every shipped file that removes a path under the committed queue root via
 * `git rm`. Returns one entry per offending file, sorted by path.
 */
export function findQueueEntryRemovers(repoRoot: string): QueueRemoval[] {
    const files: string[] = [];
    walk(repoRoot, repoRoot, files);

    const found: QueueRemoval[] = [];
    for (const relPath of files.filter(isCodeOrComponentFile)) {
        const content = fs.readFileSync(path.join(repoRoot, ...relPath.split("/")), "utf8");
        const lines = content.split("\n").filter((line) => GIT_RM_QUEUE.test(line));
        if (lines.length > 0) {
            found.push({ relPath, lines });
        }
    }
    return found.sort((a, b) => a.relPath.localeCompare(b.relPath));
}
