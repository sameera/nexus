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
 * become a mystery failing test left behind for the next session to trip over (invariant 11). It
 * then names that path to the declared grading command, so the exit status it reads is a verdict
 * over the materialized test rather than over the repository as it stands — on a return the suite
 * is green, so a command left to pick its own targets would pass and every return would read as a
 * breach. This is the workbook's contract for the grading command: it takes the path of the one
 * test file to run as its final argument.
 *
 * The probe assumes a single test file can be run on its own, and that assumption is not true in
 * every stack. So a workbook may declare a control test — one written to pass in its own stack —
 * and `proveProbe` runs it to tell "the fence held" apart from "the probe could not run here". A
 * fence nobody could check is reported as unchecked and never as intact.
 *
 * Every command this module runs is invoked as an argument vector, never a shell string (invariant
 * 14), through the same `Runner` seam the rest of the toolkit already runs process calls through.
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
 * Materialize the pinning test at the scratch path, run the declared test command over that one
 * file, and remove it — whether the run passed, failed, or threw. Returns whether the test passed.
 *
 * The materialized file's path is appended to the declared command, so the command's verdict is
 * about the test the probe wrote and about nothing else in the tree.
 *
 * A false here means "the command did not exit zero", which is not yet the same as "the fence is
 * intact": in a stack where a single test file cannot run without a build or a fixture set, every
 * probe fails for reasons having nothing to do with the fence. Deciding which of the two a false
 * means is `proveProbe`'s job and never this function's.
 */
export function runProbe(
    repoRoot: string,
    pinningTestFile: string,
    pinningTestText: string,
    testCommand: readonly string[],
    run: Runner = defaultRunner,
): boolean {
    const named: string = [PROBE_SCRATCH_PATH, ...pinningTestFile.split(/[\\/]+/).filter((part) => part !== "")].join("/");
    const target: string = path.join(repoRoot, named);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, pinningTestText);
    try {
        return runVector(repoRoot, [...testCommand, named], run).status === 0;
    } finally {
        sweepProbe(repoRoot);
    }
}

/** The one control test a workbook declares to show that its grading command can run a file alone. */
export interface ProbeControl {
    file: string;
    text: string;
}

/** Whether the probe has been shown to work in this repository at all. */
export type ProbeProof = "proven" | "unrunnable" | "unproven";

/**
 * Run the control test the workbook declares — a test written to pass in this repository's own
 * stack — and report what its result says about the probe itself.
 *
 * The probe assumes one test file can be run in isolation, and that assumption is false in stacks
 * that need a build or a fixture set first (record #469's fifth ADDRESS risk). There it is not that
 * the fence is intact; it is that the fence cannot be checked. A test known to pass is the only
 * thing that tells the two apart, so a workbook in such a stack declares one and the session
 * reports that the fence went unchecked rather than reporting an intact fence it never verified.
 *
 * A workbook that declares no control is "unproven", which is not "unrunnable": nothing has been
 * shown either way, and the caller says so rather than inventing a verdict.
 */
export function proveProbe(
    repoRoot: string,
    control: ProbeControl | null,
    testCommand: readonly string[],
    run: Runner = defaultRunner,
): ProbeProof {
    if (control === null) return "unproven";
    return runProbe(repoRoot, control.file, control.text, testCommand, run) ? "proven" : "unrunnable";
}

/**
 * What a probe run says about the fence. "unchecked" is the state that keeps a probe which could
 * not run from being read as a fence that held.
 */
export type FenceState = "breached" | "intact" | "unchecked";

export type ReturnVerdict =
    | { canTeach: true }
    | { canTeach: false; reason: "suite-red" }
    | { canTeach: false; reason: "unchecked"; story: number }
    | { canTeach: false; reason: "breach"; story: number };

/**
 * Combine the suite result and the fence's state into one verdict. `fence` is null when there was
 * no fence to check at all (no handoff being returned from) — that is not a breach, since nothing
 * was reached into.
 *
 * The suite is interpreted first: a red suite blocks teaching outright, and the probe's answer is
 * never consulted for it, because a probe result taken against a red suite is uninterpretable
 * (invariant 10) — the absence of a failing probe there would say nothing about whether the fence
 * held.
 *
 * A fence that could not be checked blocks too. Reporting that the fence could not be checked is
 * acceptable and reporting an intact fence nobody verified is not (record #469's fifth ADDRESS
 * risk), which is why the caller hands in a state rather than a pass/fail: there is no value of
 * this argument that quietly means "intact" when nothing established it.
 */
export function interpretReturn(suitePassed: boolean, fence: FenceState | null, story: number): ReturnVerdict {
    if (!suitePassed) return { canTeach: false, reason: "suite-red" };
    if (fence === "breached") return { canTeach: false, reason: "breach", story };
    if (fence === "unchecked") return { canTeach: false, reason: "unchecked", story };
    return { canTeach: true };
}

/** The report a learner reads when the probe could not run, so the fence was never checked. */
export function renderUncheckedReport(story: number): string {
    return (
        `The control test this workbook declares does not pass here, so the grading command cannot ` +
        `run one test file on its own and the fence for #${story} was not checked. No lesson is ` +
        `written on an unchecked fence. Fix the grading command or the declared 'probe_control' so ` +
        `that a test known to pass does pass when it is the only file named.`
    );
}

/** The report a learner reads when the fence was breached. Names the slice reached into (invariant 23). */
export function renderBreachReport(story: number): string {
    return (
        `The pinning test for #${story} already passes, before the exercise was written. ` +
        `The handed-off work reached into this slice, so no lesson is written for it until that is resolved.`
    );
}
