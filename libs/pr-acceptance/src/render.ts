/**
 * Human-readable rendering for the harness CLI's diagnostics.
 *
 * Success output is machine JSON (the runbook pipes it, the specs parse it);
 * only failures render as prose, one line naming the problem and the fix,
 * matching the pr-worktree diagnostic style.
 */

import { type PrAcceptanceDiagnostic } from "./diagnostic.js";

export function renderDiagnostic(d: PrAcceptanceDiagnostic): string {
    return `pr-acceptance ${d.problem}: ${d.message}`;
}
