/**
 * The one process-execution seam for the close-migration helper.
 *
 * Every git invocation in this lib goes through a Runner so specs can inject
 * failures at any step (a failing hub commit, corrupted verify output) without
 * mocking the filesystem. The default runner is a thin spawnSync wrapper.
 */

import { type SpawnSyncReturns, spawnSync } from "node:child_process";

export interface RunResult {
    status: number;
    stdout: string;
    stderr: string;
}

/** `input`, when given, is written to the command's standard input. */
export type Runner = (cmd: string, args: string[], opts: { cwd: string; input?: string }) => RunResult;

export const defaultRunner: Runner = (cmd, args, opts) => {
    // gh reads of every comment on an issue can run past spawnSync's 1 MB default.
    const r: SpawnSyncReturns<string> = spawnSync(cmd, args, { cwd: opts.cwd, encoding: "utf8", input: opts.input, maxBuffer: 256 * 1024 * 1024 });
    const status: number = r.status ?? 1;
    // A command that could not start, or was killed, reports why only in r.error or r.signal;
    // on success neither is a failure.
    const reason: string = status === 0 ? "" : (r.error?.message ?? (r.signal === null ? "" : `killed by ${r.signal}`));
    // Keep both what the command printed and why it stopped.
    return { status, stdout: r.stdout ?? "", stderr: [r.stderr ?? "", reason].filter((part: string) => part !== "").join("\n") };
};

/** Run git in a repo; returns trimmed stdout, or null when git exits non-zero. */
export function git(run: Runner, cwd: string, ...args: string[]): string | null {
    const r = run("git", args, { cwd });
    return r.status === 0 ? r.stdout.replace(/\n$/, "") : null;
}
