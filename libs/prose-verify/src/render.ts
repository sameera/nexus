/**
 * The check's read-out (story #417). One line on a pass, and one line per difference on a failure,
 * each naming the region and the line, so the failure is actionable without re-running a search.
 */

import { type RegionProblem } from "./compare.js";
import { type VerifyResult } from "./verify.js";

function describe(problem: RegionProblem): string {
    const where = `${problem.region} at line ${problem.line}`;
    if (problem.kind === "added") {
        return `  - added ${where} — ${problem.detail}`;
    }
    if (problem.kind === "removed") {
        return `  - removed ${where} — ${problem.detail}`;
    }
    return `  - changed ${where} — ${problem.detail}`;
}

/** The text the toolkit prints for one verdict. */
export function renderVerifyResult(result: VerifyResult): string {
    if (result.ok) {
        return `prose-verify: ${result.regions} machine-read region(s) unchanged.`;
    }
    if (result.problem === "unreadable") {
        return `prose-verify unreadable: ${result.message}`;
    }
    return [
        "prose-verify region-changed: the translated copy altered a region the pipeline parses:",
        ...result.problems.map(describe),
    ].join("\n");
}
