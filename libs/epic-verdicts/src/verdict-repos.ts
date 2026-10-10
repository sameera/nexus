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
 *
 * In a multi-repo workspace the two sides can live in different checkouts (#783): the code side is
 * the member the pull request merged in, and the issues side is the hub. {@link resolveVerdictRepos}
 * reads each repository from its own side.
 */

import { resolvePublishingKey } from "@nexus/delivery-config/resolve";
import { resolveRepoSlug, type RepoSlug } from "@nexus/epic-resolve/gh";
import { parseRepoIdentity } from "@nexus/workspace/issue-ref";
import { type EpicVerdictsDiagnostic } from "./diagnostic.js";
import { type Runner } from "./run.js";

export interface VerdictRepos {
    /** Where `epic`, `record` and `stories` resolve — never empty. */
    issuesRepo: string;
    /** The code repository the analyzed pull request lives in. */
    repo: string;
}

export type ResolveVerdictReposResult = { ok: true; repos: VerdictRepos } | { ok: false; error: EpicVerdictsDiagnostic };

/**
 * Resolve both repositories. `repo` is read at `codeCwd`; `issuesRepo` is the one configured at
 * `issuesCwd`, or that checkout's own repository when none is configured. With one directory the
 * two sides are the same checkout, which is every single-repo and hub run.
 */
export function resolveVerdictRepos(run: Runner, issuesCwd: string, codeCwd: string = issuesCwd): ResolveVerdictReposResult {
    const code = resolveRepoSlug(run, codeCwd);
    if (!code.ok) return unresolved(codeCwd, code.error.message);
    const repo = `${code.slug.owner}/${code.slug.repo}`;

    const configured = resolvePublishingKey(issuesCwd, "epic-repo").trim();
    if (configured.length > 0) return { ok: true, repos: { issuesRepo: configured, repo } };
    if (issuesCwd === codeCwd) return { ok: true, repos: { issuesRepo: repo, repo } };

    const issues = resolveRepoSlug(run, issuesCwd);
    if (!issues.ok) return unresolved(issuesCwd, issues.error.message);
    return { ok: true, repos: { issuesRepo: `${issues.slug.owner}/${issues.slug.repo}`, repo } };
}

function unresolved(cwd: string, detail: string): ResolveVerdictReposResult {
    return {
        ok: false,
        error: {
            problem: "repo-unresolved",
            message: `the repository at ${cwd} could not be resolved, so the repositories a verdict names cannot be established: ${detail}`,
        },
    };
}

/**
 * The issues repository as the slug the epic-resolve reads take: `owner/repo` or `host/owner/repo`,
 * else its last two path segments, so a configured epic-repo written as a URL or in SSH form (with
 * a trailing slash or `.git`) still reads. The one parse every close read of the issues repository uses.
 */
export function issuesRepoSlug(issuesRepo: string): RepoSlug {
    // `git@host:owner/repo` is the SSH form of `host/owner/repo`.
    const bare = issuesRepo.trim().replace(/\.git\/?$/, "").replace(/^[^@/\s]+@([^:/\s]+):/, "$1/");
    const id = parseRepoIdentity(bare);
    if (id !== null) return { owner: id.owner, repo: id.name };
    const segments = bare.split("/").filter((p) => p.length > 0);
    return { owner: segments.at(-2) ?? "", repo: segments.at(-1) ?? "" };
}

/**
 * Whether two written forms name the same issues repository, whichever form each is in
 * (`owner/repo`, `host/owner/repo`, a URL or the SSH form), compared by owner and name as GitHub
 * compares them, without case.
 */
export function sameIssuesRepo(a: string, b: string): boolean {
    const x = issuesRepoSlug(a);
    const y = issuesRepoSlug(b);
    return x.owner.toLowerCase() === y.owner.toLowerCase() && x.repo.toLowerCase() === y.repo.toLowerCase();
}
