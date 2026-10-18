/**
 * `nexus distill cleanup <epic>` — remove an epic's distill worktrees and run record (epic #952,
 * decision record #956: D5, D6, D9).
 *
 * The worktrees come from git's local list, on every distillation branch the epic has, whatever
 * the date, so an older close's worktree goes too. Nothing is fetched, no branch or pull request is
 * touched, and no checkout role is checked. A run still live for the epic stops the command before
 * anything is removed (D6). The run record is deleted last, and only the epic's own (D9).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { epicBranchPattern, removeWorktree } from "@nexus/pr-worktree/worktree";
import { git, type Runner } from "@nexus/workspace/run";
import { type DistillIo, liveRun, processAlive, runFiles } from "./distill-command.js";

/** The platform-backed reads and removals cleanup makes, against the real git. */
export interface CleanupDeps {
    /** The main checkout of the repository `cwd` is in, or null when `cwd` is in no repository. */
    mainCheckout(cwd: string): string | null;
    /** git's porcelain list of the repository's worktrees, read from the main checkout. */
    worktrees(mainRoot: string): string;
    /** Remove one worktree, run from the main checkout so the caller may stand inside it. */
    removeWorktree(mainRoot: string, wtPath: string): { ok: true } | { ok: false; message: string };
    /** Whether a process with this id exists. */
    alive(pid: number): boolean;
}

/** The worktrees on any of `epic`'s distillation branches, from git's porcelain list. */
export function worktreesOnEpicBranches(porcelain: string, epic: number): { path: string; branch: string }[] {
    const pattern = epicBranchPattern(epic);
    const found: { path: string; branch: string }[] = [];
    for (const block of porcelain.split(/\n\n+/)) {
        const wt = /^worktree (.+)$/m.exec(block)?.[1];
        const br = /^branch refs\/heads\/(.+)$/m.exec(block)?.[1];
        if (wt !== undefined && br !== undefined && pattern.test(br)) found.push({ path: wt, branch: br });
    }
    return found;
}

export function cleanupDeps(run: Runner): CleanupDeps {
    return {
        mainCheckout: (cwd) => {
            const common = git(run, cwd, "rev-parse", "--path-format=absolute", "--git-common-dir");
            return common === null ? null : path.dirname(common);
        },
        worktrees: (mainRoot) => git(run, mainRoot, "worktree", "list", "--porcelain") ?? "",
        removeWorktree: (mainRoot, wtPath) => {
            const r = removeWorktree(run, mainRoot, wtPath);
            return r.ok ? { ok: true } : { ok: false, message: r.error.message };
        },
        alive: processAlive,
    };
}

/** Remove `epic`'s distill worktrees and run record. Exit 0 when nothing is left behind; 1 when it stops. */
export function runDistillCleanup(deps: CleanupDeps, epic: number, cwd: string, io: DistillIo): number {
    const refused = (reason: string, remedy: string): number => {
        io.stderr("nexus distill cleanup refused. Nothing was removed.");
        io.stderr(`  reason: ${reason}`);
        io.stderr(`  remedy: ${remedy}`);
        return 1;
    };
    const mainRoot = deps.mainCheckout(cwd);
    if (mainRoot === null) return refused(`${cwd} is not in a git repository`, "run nexus distill cleanup from inside the checkout");

    // A run still live for the epic owns its worktree; removing it would break that run (D6, G14).
    const files = runFiles(mainRoot, epic);
    const owner = liveRun(deps, files);
    if (owner !== null) return refused(`a distill run for epic ${epic} is still in progress (process ${owner})`, `wait for it to end, then re-run nexus distill cleanup ${epic}`);

    const found = worktreesOnEpicBranches(deps.worktrees(mainRoot), epic).filter((wt) => wt.path !== mainRoot);
    if (found.length === 0) io.stdout(`no distill worktree was found for epic ${epic}.`);
    for (const wt of found) {
        const removed = deps.removeWorktree(mainRoot, wt.path);
        if (!removed.ok) {
            io.stderr(`nexus distill cleanup stopped: ${removed.message}`);
            return 1;
        }
        io.stdout(`Removed worktree ${wt.path} (branch ${wt.branch}).`);
    }

    // The record goes last, once nothing it describes is left on disk (D9, G16).
    if (fs.existsSync(files.dir)) {
        fs.rmSync(files.dir, { recursive: true, force: true });
        io.stdout(`Removed the run record ${files.dir}.`);
    }
    return 0;
}
