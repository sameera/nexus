/**
 * Human-readable rendering for the epic-resolver CLI's diagnostics.
 *
 * Success output is machine JSON (the CLI emits one object; specs parse it); only failures render
 * as prose, one line naming the problem and the fix, matching the pr-worktree diagnostic style.
 */

import { type EpicResolveDiagnostic } from "./diagnostic.js";

export function renderDiagnostic(d: EpicResolveDiagnostic): string {
    return `epic-resolve ${d.problem}: ${d.message}`;
}
