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
 * The issues repository in the one form close reads, writes and compares: `owner/repo`, or
 * `host/owner/repo` on a host other than github.com. A configured epic-repo may be written as a
 * URL, in SSH form (`git@host:owner/repo`), or with a trailing slash or `.git`. A value that does
 * not read is returned as given, so the read that uses it fails and says so.
 */
export function canonicalIssuesRepo(issuesRepo: string): string {
    const bare = issuesRepo
        .trim()
        .replace(/\/+$/, "")
        .replace(/\.git$/i, "")
        .replace(/^[^@/\s]+@([^:/\s]+):/, "$1/")
        .replace(/^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]*@)?/i, "");
    const id = parseRepoIdentity(bare);
    if (id === null) return issuesRepo;
    return id.host === null || id.host === "github.com" ? `${id.owner}/${id.name}` : `${id.host}/${id.owner}/${id.name}`;
}

/** The issues repository as the slug the epic-resolve reads take, from its canonical form. */
export function issuesRepoSlug(issuesRepo: string): RepoSlug {
    const id = parseRepoIdentity(canonicalIssuesRepo(issuesRepo));
    if (id !== null) return { owner: id.owner, repo: id.name };
    const segments = issuesRepo.split("/").filter((p) => p.length > 0);
    return { owner: segments.at(-2) ?? "", repo: segments.at(-1) ?? "" };
}
