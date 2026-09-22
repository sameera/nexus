/**
 * The two repositories a published verdict names, resolved from the checkout itself (epic #751,
 * decision record #764, invariants 3 and 4).
 *
 * The **code** repository is the one the analyzed pull request lives in — the checkout the gate
 * runs in, which in `--pr` mode is the target's worktree, never the hub's. The **issues**
 * repository is the one the verdict's epic, record and story numbers resolve against: the
 * configured one, or that same code repository when nothing declares one. It is therefore never
 * empty, and a checkout whose repository cannot be resolved at all stops the run rather than
 * passing an empty value through — a caller that does not know which repository it is reading
 * would leave every comparison built on this inert.
 */

import { resolvePublishingKey } from "@nexus/delivery-config/resolve";
import { resolveRepoSlug } from "@nexus/epic-resolve/gh";
import { type EpicVerdictsDiagnostic } from "./diagnostic.js";
import { type Runner } from "./run.js";

export interface VerdictRepos {
    /** Where `epic`, `record` and `stories` resolve — never empty. */
    issuesRepo: string;
    /** The code repository the analyzed pull request lives in. */
    repo: string;
}

export type ResolveVerdictReposResult = { ok: true; repos: VerdictRepos } | { ok: false; error: EpicVerdictsDiagnostic };

/** Resolve both repositories at `cwd`. */
export function resolveVerdictRepos(run: Runner, cwd: string): ResolveVerdictReposResult {
    const slug = resolveRepoSlug(run, cwd);
    if (!slug.ok) {
        return {
            ok: false,
            error: {
                problem: "repo-unresolved",
                message: `the repository at ${cwd} could not be resolved, so the repositories a verdict names cannot be established: ${slug.error.message}`,
            },
        };
    }
    const repo = `${slug.slug.owner}/${slug.slug.repo}`;
    const configured = resolvePublishingKey(cwd, "epic-repo").trim();
    return { ok: true, repos: { issuesRepo: configured.length > 0 ? configured : repo, repo } };
}
