/**
 * The shipped-without-a-pull-request marker (decision record #505, key decision "A story that
 * ships without its own pull request is excluded by a marker on the story issue"). One concept
 * shared with #213's close waiver — never two labels for the same fact — resolved through the
 * shared publishing resolver (`no-pr-label`, `@nexus/delivery-config/resolve`), never hard-coded.
 *
 * `waiveStory` (story #502, decision record #509) is the write half of that same concept: the act
 * of a lead consenting, at close time, that a closed story with no discoverable pull request is
 * legitimately storyless — never a per-run flag, always this durable label on the story issue.
 */

import { type EpicVerdictsDiagnostic } from "./diagnostic.js";
import { type Runner } from "./run.js";

/** Whether a story issue's labels carry the resolved no-pull-request marker. */
export function isExcludedStory(labels: string[], noPrLabel: string): boolean {
    const wanted = noPrLabel.toLowerCase();
    return labels.some((name) => name.toLowerCase() === wanted);
}

/**
 * Write the resolved no-pull-request marker onto a story issue — the close-time waiver's one
 * effect. Never called speculatively: only after the lead has explicitly consented to waive a
 * story the aggregate derivation reported missing.
 */
export function waiveStory(run: Runner, cwd: string, story: number, noPrLabel: string): { ok: true } | { ok: false; error: EpicVerdictsDiagnostic } {
    const r = run("gh", ["issue", "edit", String(story), "--add-label", noPrLabel], { cwd });
    if (r.status !== 0) {
        return {
            ok: false,
            error: {
                problem: "gh-failed",
                message: `could not add the "${noPrLabel}" label to story #${story}: ${r.stderr.trim() || `gh exited ${r.status}`}`,
            },
        };
    }
    return { ok: true };
}

/**
 * Whether a story issue carries `label` in the issues repository. A story whose labels cannot be
 * read is read as not carrying it, so it stays live and the evidence gate reads its pull requests.
 */
export function storyCarriesLabel(run: Runner, cwd: string, issuesRepo: string, story: number, label: string): boolean {
    const r = run("gh", ["issue", "view", String(story), "--repo", issuesRepo, "--json", "labels", "--jq", ".labels[].name"], { cwd });
    const labels = r.status === 0 ? r.stdout.split("\n").map((l) => l.trim()).filter(Boolean) : [];
    return isExcludedStory(labels, label);
}
