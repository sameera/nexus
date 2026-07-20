/**
 * Human-readable rendering for the pr-worktree CLI's diagnostics.
 *
 * Success output is machine JSON (the specs parse it); only failures render as
 * prose, one line naming the problem and the fix, matching close-migration's
 * diagnostic style.
 */

import { type PrWorktreeDiagnostic } from "./diagnostic.js";

export function renderDiagnostic(d: PrWorktreeDiagnostic): string {
    return `pr-worktree ${d.problem}: ${d.message}`;
}
