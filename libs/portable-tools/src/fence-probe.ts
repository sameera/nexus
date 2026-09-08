/**
 * The suite gate and the fence probe (epic #407, story #465): a session verifies the repository
 * before it teaches, rather than trusting a pause it did not itself watch over.
 *
 * A learner returning from a handoff comes back to a repository somebody else has been writing in.
 * The suite runs first, and its result gates everything else: no lesson is written while the
 * declared suite is red, and a probe result obtained on a red suite is never reported as a breach
 * (decision record #469, invariants 8, 10). Only once the suite is green is the fence probe's
 * answer meaningful — the pinning test the exercise names should not already pass, because an
 * exercise whose test already passes is one the learner cannot do.
 *
 * The probe materializes that test's own text at one well-known, swept scratch path rather than
 * anywhere in the learner's own tree, so it never mingles with real work and a crashed probe cannot
 * become a mystery failing test left behind for the next session to trip over (invariant 11). Every
 * command this module runs is invoked as an argument vector, never a shell string (invariant 14),
 * through the same `Runner` seam the rest of the toolkit already runs process calls through.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { type Runner, defaultRunner } from "@nexus/close-migration/run";

/** The one scratch location the probe ever writes to, swept before anything else runs. */
export const PROBE_SCRATCH_PATH: string = ".nexus/tmp/workbook-probe";

export interface SuiteResult {
    passed: boolean;
    output: string;
}

function runVector(cwd: string, command: readonly string[], run: Runner): { status: number; output: string } {
    const [cmd, ...args] = command;
    const result = run(cmd, args, { cwd });
    return { status: result.status, output: result.stdout + result.stderr };
}

/** Run the workbook's declared suite command. It is always the full command — never a narrowed one. */
export function runSuite(repoRoot: string, command: readonly string[], run: Runner = defaultRunner): SuiteResult {
    if (command.length === 0) {
        throw new Error("the workbook declares no suite command to run; nothing tells the session what green means");
    }
    const { status, output } = runVector(repoRoot, command, run);
    return { passed: status === 0, output };
}

/** Remove whatever the probe left behind. Called at the start of every session, whether or not one ran. */
export function sweepProbe(repoRoot: string): void {
    const target: string = path.join(repoRoot, PROBE_SCRATCH_PATH);
    if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
}

/**
 * Materialize the pinning test at the scratch path, run the declared test command against it, and
 * remove it — whether the run passed, failed, or threw. Returns whether the test passed.
 */
export function runProbe(
    repoRoot: string,
    pinningTestFile: string,
    pinningTestText: string,
    testCommand: readonly string[],
    run: Runner = defaultRunner,
): boolean {
    const target: string = path.join(repoRoot, PROBE_SCRATCH_PATH, pinningTestFile);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, pinningTestText);
    try {
        return runVector(repoRoot, testCommand, run).status === 0;
    } finally {
        sweepProbe(repoRoot);
    }
}

export type ReturnVerdict =
    | { canTeach: true }
    | { canTeach: false; reason: "suite-red" }
    | { canTeach: false; reason: "breach"; story: number };

/**
 * Combine the suite result and the probe result into one verdict. `probePassed` is null when there
 * was no fence to check at all (no handoff being returned from) — that is not a breach, since
 * nothing was reached into.
 *
 * The suite is interpreted first: a red suite blocks teaching outright, and the probe's answer is
 * never consulted for it, because a probe result taken against a red suite is uninterpretable
 * (invariant 10) — the absence of a failing probe there would say nothing about whether the fence
 * held.
 */
export function interpretReturn(suitePassed: boolean, probePassed: boolean | null, story: number): ReturnVerdict {
    if (!suitePassed) return { canTeach: false, reason: "suite-red" };
    if (probePassed === true) return { canTeach: false, reason: "breach", story };
    return { canTeach: true };
}

/** The report a learner reads when the fence was breached. Names the slice reached into (invariant 23). */
export function renderBreachReport(story: number): string {
    return (
        `The pinning test for #${story} already passes, before the exercise was written. ` +
        `The handed-off work reached into this slice, so no lesson is written for it until that is resolved.`
    );
}
