/**
 * The check's read-out (stories #417 and #423). One line on a pass, and one line per difference on
 * a failure, each naming what changed and where, so the failure is actionable without re-running a
 * search. A run that fails both comparisons prints both sections under one verdict.
 */

import { type RegionProblem } from "./compare.js";
import { type PreservationFinding } from "./preserve.js";
import { type VerifyResult } from "./verify.js";

function describeRegion(problem: RegionProblem): string {
    const where = `${problem.region} at line ${problem.line}`;
    if (problem.kind === "added") {
        return `  - added ${where} — ${problem.detail}`;
    }
    if (problem.kind === "removed") {
        return `  - removed ${where} — ${problem.detail}`;
    }
    return `  - changed ${where} — ${problem.detail}`;
}

function describeLines(lines: readonly number[]): string {
    return lines.length === 1 ? `line ${lines[0]}` : `lines ${lines.join(", ")}`;
}

/**
 * The counts a missing finding carries, phrased so a partial loss never reads as a total one.
 *
 * The line list names every place the item stood in the pre-translation copy, not the places it was
 * lost from — counting is position-blind, so which occurrence went is not a fact the check holds.
 * Without the counts an author reading six lines assumes six losses, repairs the wrong thing, and
 * fails the check a second time. The counts say how many of the six to go looking for.
 */
function describeLoss(finding: PreservationFinding): string {
    const occurrences: string = finding.had === 1 ? "1 occurrence" : `${finding.had} occurrences`;
    if (finding.survived === 0) {
        return `${occurrences} before, none left`;
    }
    return `${occurrences} before, ${finding.survived} left — ${finding.had - finding.survived} lost, and the check cannot say which`;
}

function describeFinding(finding: PreservationFinding): string {
    const where: string = describeLines(finding.lines);
    if (finding.kind === "introduced") {
        return `  - introduced ${finding.item} "${finding.label}" at ${where}, grounded in no named source`;
    }
    return `  - missing ${finding.item} "${finding.label}": ${describeLoss(finding)}; stood at ${where}`;
}

/** The text the toolkit prints for one verdict. */
export function renderVerifyResult(result: VerifyResult): string {
    if (result.ok) {
        return `prose-verify: ${result.regions} machine-read region(s) unchanged, ${result.tracked} tracked item(s) preserved.`;
    }
    if (result.problem === "unreadable") {
        return `prose-verify unreadable: ${result.message}`;
    }
    const lines: string[] = [];
    if (result.problems.length > 0) {
        lines.push("prose-verify region-changed: the translated copy altered a region the pipeline parses:");
        lines.push(...result.problems.map(describeRegion));
    }
    if (result.findings.length > 0) {
        lines.push("prose-verify not-preserved: the translated copy did not carry every tracked item through:");
        lines.push(...result.findings.map(describeFinding));
    }
    return lines.join("\n");
}
