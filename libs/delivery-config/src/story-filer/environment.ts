/**
 * The filer's one seam onto the outside world (decision record #375).
 *
 * Every platform call goes through the runner contract the shared module already defines, bound
 * once to the resolved target root, so every call targets the repository the run resolved — which
 * is what makes the platform client's own owner/repo placeholders correct. Waiting between retries
 * goes through an injected clock, so no test ever sleeps and no test ever spawns.
 */

import { spawnSync } from "node:child_process";
import { type GhRunner, type RunResult, defaultGhRunner } from "../gh.js";

export interface FilerEnvironment {
    /** A runner for the platform client, rooted at `root`. */
    runnerFor: (root: string) => GhRunner;
    /** Wait, in seconds. */
    sleep: (seconds: number) => void;
    /** The retry jitter source. */
    random: () => number;
}

/** Block for `seconds` without a scheduler — the run is synchronous end to end. */
function sleepSync(seconds: number): void {
    if (seconds <= 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, seconds * 1000);
}

export const defaultEnvironment: FilerEnvironment = {
    runnerFor: (root: string): GhRunner =>
        defaultGhRunner((args: string[]): RunResult => {
            const result = spawnSync("gh", args, { cwd: root, encoding: "utf8" });
            return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
        }),
    sleep: sleepSync,
    random: Math.random,
};
