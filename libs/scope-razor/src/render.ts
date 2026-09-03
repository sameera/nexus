/**
 * How the razor's findings are printed. One line per finding, each naming a location and the thing
 * to change, so a stage that stops on a non-zero exit can hand the reader something actionable
 * rather than "the check failed".
 */

import type { Finding } from "./labels.js";

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
