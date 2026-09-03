/**
 * How the razor's findings are printed. One line per finding, each naming a location and the thing
 * to change, so a stage that stops on a non-zero exit can hand the reader something actionable
 * rather than "the check failed".
 */

import type { Finding } from "./labels.js";
import type { RazorFinding } from "./check.js";

/**
 * The assertion-mode diagnostic: the tokens that survived into a body that was about to be filed.
 * Callers render this only on failure — a clean assertion says nothing.
 */
export function renderSurvivingLabels(draft: string, findings: Finding[]): string {
    return [
        `razor-check: ${findings.length} drafting-time token(s) survived into ${draft} — file nothing until they are removed:`,
        ...findings.map((f: Finding) => `  ${draft}:${f.line} ${f.token}`),
    ].join("\n");
}

/**
 * The check-mode report: one line per finding, blocking first, each naming the story or section it
 * belongs to. The gate reports this and the caller fixes the draft — the checker edits nothing.
 */
export function renderRazorFindings(draft: string, findings: RazorFinding[]): string {
    if (findings.length === 0) return `razor-check: ${draft} breaks no razor rule`;
    const order = (f: RazorFinding): number => (f.severity === "blocking" ? 0 : 1);
    return [...findings]
        .sort((a: RazorFinding, b: RazorFinding) => order(a) - order(b))
        .map((f: RazorFinding) => `  ${f.severity}: [${f.rule}] ${f.where} — ${f.message}`)
        .join("\n");
}
