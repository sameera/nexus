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
 * In a multi-repo workspace the two sides live in different checkouts (#783): the code side is the
 * member the pull request merged in, and the issues side is the hub. {@link resolveVerdictRoots}
 * finds both, and {@link resolveVerdictRepos} reads each repository from its own side.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { resolvePublishingKey } from "@nexus/delivery-config/resolve";
import { resolveRepoSlug } from "@nexus/epic-resolve/gh";
import { type EpicVerdictsDiagnostic } from "./diagnostic.js";
import { resolveWorkspace, type ResolveResult } from "@nexus/workspace/resolve";
import { git, type Runner } from "./run.js";

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

/** The two checkouts a shipped record is written from. */
export interface VerdictRoots {
    /** The checkout the pull request lives in — the one the caller pointed at, worktree included. */
    codeRoot: string;
    /** The checkout whose issues hold the epic: the workspace hub, or the checkout itself. */
    issuesRoot: string;
}

export type ResolveVerdictRootsResult = { ok: true; roots: VerdictRoots } | Extract<ResolveResult, { ok: false }>;

/**
 * Split `startDir` into its code side and its issues side (#783).
 *
 * A member checkout is its own code side, and its hub is the issues side. The hub is found from
 * the member's main worktree, because an analyze worktree sits under the temp directory where no
 * hub is its sibling. Any other checkout resolves exactly as the other epic-verdicts subverbs do.
 */
export function resolveVerdictRoots(run: Runner, startDir: string): ResolveVerdictRootsResult {
    const codeRoot = git(run, startDir, "rev-parse", "--show-toplevel") ?? path.resolve(startDir);
    const config = path.join(codeRoot, ".nexus", "config");
    const isMember = fs.existsSync(path.join(config, "hub.yml")) && !fs.existsSync(path.join(config, "workspace.yml"));

    const resolved = resolveWorkspace(isMember ? mainWorktree(run, codeRoot) : startDir);
    if (!resolved.ok) return resolved;
    const issuesRoot = resolved.workspace.mode === "workspace" ? resolved.workspace.hubRoot : resolved.workspace.root;
    return { ok: true, roots: { codeRoot, issuesRoot } };
}

/** The repository's primary worktree: the first entry `git worktree list` prints. */
function mainWorktree(run: Runner, fromDir: string): string {
    const listed = git(run, fromDir, "worktree", "list", "--porcelain") ?? "";
    const first = listed.split("\n").find((line) => line.startsWith("worktree "));
    return first !== undefined ? first.slice("worktree ".length) : fromDir;
}
