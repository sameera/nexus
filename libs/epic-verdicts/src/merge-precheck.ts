/**
 * The merge pre-check — what the one-command close script reads before it merges a pull request
 * (epic #828, decision record #849, D10).
 *
 * It reads the pull request's analyze receipt and nothing else: it does not run analyze, and it
 * does not read the shipped record. The verdict comes only from the one trusted receipt reader
 * (G23), which also returns the pull request's current head, so a head that moved after analysis
 * is caught here before the merge rather than at close.
 *
 * Each receipt state gets its own result, so a lead can tell them apart:
 *
 * - **read-failure** — the read failed, the block could not be parsed, or every block it carries
 *   was dropped as untrusted. Never reported as "not run" (G21).
 * - **not-run** — no receipt at all; names `/nxs.analyze --pr <N>` on that pull request (G20).
 * - **head-moved** — the receipt's analyzed head is not the pull request's current head; names
 *   re-running analyze (G21).
 * - **blocking** — critical or high findings; reports the counts and refuses (G20).
 * - **clean** — reports the verdict; the only result that allows the merge.
 *
 * Story text a receipt written by 0.82.0 to 0.86.0 records is read past and ignored here (D12,
 * G37): the pre-check gates on nothing but the head and the finding counts.
 */

import { type EpicVerdictsDiagnostic } from "./diagnostic.js";
import { readPrVerdict } from "./pr-verdict.js";
import { type Runner } from "./run.js";

export type MergePrecheckResult = "clean" | "not-run" | "read-failure" | "head-moved" | "blocking";

export interface MergePrecheck {
    pr: number;
    result: MergePrecheckResult;
    /** True only for a clean receipt at the pull request's current head. */
    merge: boolean;
    /** The receipt's finding counts, or null when no receipt was read. */
    findings: Record<string, number> | null;
    /** The commit the receipt analyzed, or null when no receipt was read. */
    analyzedHead: string | null;
    /** The pull request's head at read time, or null when the read failed. */
    prHead: string | null;
    /** One line a lead reads; the script prints it as is. */
    message: string;
}

const COUNTED = ["critical", "high", "medium", "low"] as const;

function countsLine(findings: Record<string, number>): string {
    return COUNTED.map((k) => `${k} ${findings[k] ?? 0}`).join(", ");
}

function readFailure(pr: number, cause: string, prHead: string | null = null): MergePrecheck {
    return {
        pr,
        result: "read-failure",
        merge: false,
        findings: null,
        analyzedHead: null,
        prHead,
        message: `PR #${pr}: its analyze receipt could not be read — ${cause} Refusing to merge; re-run once the read succeeds.`,
    };
}

/** Read `pr`'s analyze receipt in `repo` and decide whether the script may merge it. */
export function mergePrecheck(run: Runner, cwd: string, pr: number, repo: string, issuesRepo: string): MergePrecheck {
    const read = readPrVerdict(run, cwd, pr, repo, issuesRepo);
    if (!read.ok) return readFailure(pr, describe(read.error));
    const v = read.verdict;

    if (!v.found || v.receipt === null) {
        if (v.untrustedBlocks > 0) {
            return readFailure(
                pr,
                `it carries ${v.untrustedBlocks} receipt block(s) that are not trusted (an author who cannot speak for ${repo}, or a block naming another pull request or repository).`,
                v.prHead,
            );
        }
        return {
            pr,
            result: "not-run",
            merge: false,
            findings: null,
            analyzedHead: null,
            prHead: v.prHead,
            message: `PR #${pr}: analysis has not run — it carries no analyze receipt. Run /nxs.analyze --pr ${pr} first.`,
        };
    }

    const findings = v.receipt.findings;
    const analyzedHead = v.receipt.head;
    if (findings["critical"] === undefined || findings["high"] === undefined) {
        return readFailure(pr, "its receipt states no critical or high finding count.", v.prHead);
    }
    const base = { pr, findings, analyzedHead, prHead: v.prHead };

    if (analyzedHead === "" || analyzedHead !== v.prHead) {
        return {
            ...base,
            result: "head-moved",
            merge: false,
            message:
                `PR #${pr}: the receipt analyzed ${analyzedHead || "no head"}, but the pull request's head is now ${v.prHead}. ` +
                `Refusing to merge; re-run /nxs.analyze --pr ${pr} on the current head.`,
        };
    }
    if (findings["critical"] > 0 || findings["high"] > 0) {
        return {
            ...base,
            result: "blocking",
            merge: false,
            message: `PR #${pr}: the receipt reports blocking findings (${countsLine(findings)}). Refusing to merge.`,
        };
    }
    return {
        ...base,
        result: "clean",
        merge: true,
        message: `PR #${pr}: the receipt is clean (${countsLine(findings)}) at the current head ${v.prHead}.`,
    };
}

function describe(error: EpicVerdictsDiagnostic): string {
    const message = error.message.trim();
    return `${error.problem}: ${/[.!?]$/.test(message) ? message : `${message}.`}`;
}
