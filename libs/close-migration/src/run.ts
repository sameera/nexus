/**
 * The one process-execution seam for the close-migration helper.
 *
 * Every git invocation in this lib goes through a Runner so specs can inject
 * failures at any step (a failing hub commit, corrupted verify output) without
 * mocking the filesystem. The default runner is a thin spawnSync wrapper.
 */

import { spawnSync } from "node:child_process";

export interface RunResult {
    status: number;
    stdout: string;
    stderr: string;
}

export type Runner = (cmd: string, args: string[], opts: { cwd: string }) => RunResult;

export const defaultRunner: Runner = (cmd, args, opts) => {
    const r = spawnSync(cmd, args, { cwd: opts.cwd, encoding: "utf8" });
    return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
};

/** Run git in a repo; returns trimmed stdout, or null when git exits non-zero. */
export function git(run: Runner, cwd: string, ...args: string[]): string | null {
    const r = run("git", args, { cwd });
    return r.status === 0 ? r.stdout.replace(/\n$/, "") : null;
}
