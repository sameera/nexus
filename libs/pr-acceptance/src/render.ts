/**
 * Human-readable rendering for the harness CLI's diagnostics.
 *
 * Success output is machine JSON (the runbook pipes it, the specs parse it);
 * only failures render as prose, one line naming the problem and the fix,
 * matching the pr-worktree diagnostic style.
 *
 * The manual-teardown notice is the one deliberate exception to the one-line
 * rule. It reports a *successful* run that nonetheless left a real repository
 * on the maintainer's account, which is precisely the thing a scrolling
 * terminal loses. So it is a block, it is unmissable, and it carries the exact
 * command rather than describing it — the whole point of the manual mode is
 * that a human, not the harness, performs the delete.
 */

import { type PrAcceptanceDiagnostic } from "./diagnostic.js";

export function renderDiagnostic(d: PrAcceptanceDiagnostic): string {
    return `pr-acceptance ${d.problem}: ${d.message}`;
}

export interface ManualTeardownNotice {
    nameWithOwner: string;
    /** The repo's url when the remote reported one; the notice omits the line otherwise. */
    url: string | null;
}

const RULE = "=".repeat(78);

export function renderManualTeardownNotice(n: ManualTeardownNotice): string {
    const lines = [
        RULE,
        "  MANUAL CLEANUP REQUIRED — the scratch repository was NOT deleted.",
        RULE,
        "",
        `  repo:  ${n.nameWithOwner}`,
    ];
    if (n.url !== null && n.url !== "") lines.push(`  url:   ${n.url}`);
    lines.push(
        "",
        "  This run holds no repository-delete capability, so teardown cannot remove it.",
        "  Delete it yourself when you are done with the evidence:",
        "",
        "      gh auth refresh -h github.com -s delete_repo",
        `      gh repo delete ${n.nameWithOwner} --yes`,
        "",
        "  Or in the browser: the repo's Settings → Danger Zone → Delete this repository.",
        "",
        "  Leaving it standing costs one repository, not a growing pile: the harness owns",
        "  exactly this one name, so a later run adopts this repo instead of making another.",
        RULE,
        "",
    );
    return lines.join("\n");
}
