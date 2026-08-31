/**
 * How the run ends (story #373).
 *
 * A caller — a component body, a pipeline stage — branches on the incomplete marker and the exit
 * code and re-runs the identical command. A person reads the rest. Both surfaces are frozen
 * (Invariant 12), with one ratified exception: the resume hint.
 */

import { type ToolkitIo } from "../io.js";
import { type FilerArgs, reconstructFlags } from "./args.js";
import { CAPABILITY } from "./args.js";

const RULE = "=".repeat(60);

export interface RunOutcome {
    total: number;
    created: number;
    reused: number;
    /** The work items whose issue could not be created, by file name. */
    createFailed: string[];
    depWired: number;
    depPresent: number;
    depUnresolved: [string, string][];
    depFailed: [string, string][];
    bodyRewritten: number;
    bodyUnresolved: [string, string][];
    bodyFailed: string[];
}

/**
 * The command that resumes this run — the single ratified exception to the frozen-output rule
 * (Invariant 13).
 *
 * The line it replaces named an interpreter the next epic removes and reconstructed two of the
 * seven flags, so a resumed half-filed batch could be sent to a different resolved root or filed
 * under the default classification. It is emitted in the toolkit spelling, carrying every flag the
 * run was actually given; a flag added to this capability is added here with it.
 */
export function resumeCommand(args: FilerArgs, targetFolder: string): string {
    return ["nexus", CAPABILITY, `"${targetFolder}"`, ...reconstructFlags(args)].join(" ");
}

/** Whether anything at all went wrong or went unresolved. */
export function isIncomplete(outcome: RunOutcome): boolean {
    return (
        outcome.createFailed.length > 0 ||
        outcome.depUnresolved.length > 0 ||
        outcome.depFailed.length > 0 ||
        outcome.bodyUnresolved.length > 0 ||
        outcome.bodyFailed.length > 0
    );
}

/** Render the end-of-run summary. Returns true when the run is fully complete. */
export function printFinalReport(
    outcome: RunOutcome,
    args: FilerArgs,
    targetFolder: string,
    ledgerPath: string,
    io: ToolkitIo,
): boolean {
    const incomplete: boolean = isIncomplete(outcome);

    io.stdout("");
    io.stdout(RULE);
    io.stdout("SUMMARY");
    io.stdout(RULE);
    io.stdout(
        `Issues:       ${outcome.created} created, ${outcome.reused} reused, ` +
            `${outcome.createFailed.length} FAILED  (of ${outcome.total})`,
    );
    io.stdout(
        `Dependencies: ${outcome.depWired} wired, ${outcome.depPresent} already present, ` +
            `${outcome.depUnresolved.length} unresolved, ${outcome.depFailed.length} FAILED`,
    );
    io.stdout(
        `Body refs:    ${outcome.bodyRewritten} bod(ies) rewritten, ` +
            `${outcome.bodyUnresolved.length} unresolved, ${outcome.bodyFailed.length} FAILED`,
    );

    if (!incomplete) {
        io.stdout("");
        io.stdout("✅ Complete — every story issue created, every dependency wired, every body ref resolved.");
        io.stdout(RULE);
        return true;
    }

    io.stdout("");
    io.stdout("⚠️  INCOMPLETE — action required");

    if (outcome.createFailed.length > 0) {
        io.stdout("");
        io.stdout(`  Failed to create (${outcome.createFailed.length}) — see errors above for the cause:`);
        for (const name of outcome.createFailed) io.stdout(`    - ${name}`);
    }
    if (outcome.depUnresolved.length > 0) {
        io.stdout("");
        io.stdout(`  Unresolved blocked_by (${outcome.depUnresolved.length}) — blocker not created yet:`);
        for (const [dependent, ref] of outcome.depUnresolved) io.stdout(`    - #${dependent} blocked_by '${ref}'`);
    }
    if (outcome.depFailed.length > 0) {
        io.stdout("");
        io.stdout(`  Failed dependency links after retries (${outcome.depFailed.length}):`);
        for (const [dependent, ref] of outcome.depFailed) io.stdout(`    - #${dependent} blocked_by '${ref}'`);
    }
    if (outcome.bodyUnresolved.length > 0) {
        io.stdout("");
        io.stdout(`  Unresolved body refs (${outcome.bodyUnresolved.length}) — named story not in this batch;`);
        io.stdout("  fix the ref in the source STORY-*.md (or replace it with the issue number), then re-run:");
        for (const [number, ref] of outcome.bodyUnresolved) io.stdout(`    - #${number} references '${ref}'`);
    }
    if (outcome.bodyFailed.length > 0) {
        io.stdout("");
        io.stdout(`  Failed body rewrites after retries (${outcome.bodyFailed.length}):`);
        for (const number of outcome.bodyFailed) io.stdout(`    - #${number}`);
    }

    io.stdout("");
    io.stdout(`  Progress saved to: ${ledgerPath}`);
    io.stdout("  Re-run the SAME command to resume — already-created issues are skipped and");
    io.stdout("  dependencies are re-checked (both idempotent). Nothing will be duplicated:");
    io.stdout(`    ${resumeCommand(args, targetFolder)}`);
    io.stdout(RULE);
    return false;
}
