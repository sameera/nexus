/**
 * The epic filer's seams onto the outside world (decision record #387).
 *
 * Every platform call goes through the runner contract the shared module already defines, bound
 * once to the resolved target root, so every call targets the repository the run resolved. The
 * confirmation prompt lives here too rather than on the shared output seam: it is the only
 * interactive point in the capability, and widening a seam four capabilities implement in order to
 * serve one caller costs more than one field on this record.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import { type GhRunner, type RunResult, defaultGhRunner } from "../gh.js";

export interface EpicEnvironment {
    /** A runner for the platform client, rooted at `root`. */
    runnerFor: (root: string) => GhRunner;
    /** A runner for the version-control client, rooted at `root` — the same contract, same cwd. */
    gitFor: (root: string) => GhRunner;
    /** Whether the platform client is installed at all. */
    hasGh: () => boolean;
    /** Whether the run has a terminal attached — the colour gate and the prompt gate. */
    interactive: () => boolean;
    /**
     * One line read from the terminal, or null when no answer can be read.
     *
     * Null is treated exactly as an absent terminal is: a run that cannot receive an answer refuses
     * rather than blocking on a prompt nobody can answer (Invariant 18).
     */
    prompt: (question: string) => string | null;
}

export const defaultEpicEnvironment: EpicEnvironment = {
    runnerFor: (root: string): GhRunner =>
        defaultGhRunner((args: string[]): RunResult => {
            const result = spawnSync("gh", args, { cwd: root, encoding: "utf8" });
            return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
        }),
    gitFor: (root: string): GhRunner =>
        defaultGhRunner((args: string[]): RunResult => {
            const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
            return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
        }),
    hasGh: (): boolean =>
        spawnSync(process.platform === "win32" ? "where" : "which", ["gh"], { encoding: "utf8" }).status === 0,
    interactive: (): boolean => process.stdin.isTTY === true,
    prompt: (question: string): string | null => {
        process.stdout.write(question);
        const buffer: Buffer = Buffer.alloc(1024);
        try {
            const read: number = fs.readSync(0, buffer, 0, buffer.length, null);
            return buffer.subarray(0, read).toString("utf8").split("\n")[0];
        } catch {
            return null;
        }
    },
};
