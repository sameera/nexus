/**
 * Structured failure reporting for the pr-worktree helper.
 *
 * Same shape and style as the close-migration and workspace diagnostics — a fixed
 * kebab-case problem plus one human sentence naming the offending input and how to
 * fix it. close-migration diagnostics pass through verbatim (identity resolution
 * reuses closePreflight); this union only adds the PR/worktree failure modes.
 */

import { type MigrationDiagnostic } from "@nexus/close-migration/diagnostic";

export type PrWorktreeProblem =
    | "not-a-git-repo"
    | "member-unsupported"
    | "gh-failed"
    | "pr-not-found"
    | "pr-not-merged"
    | "pr-no-merge-commit"
    | "malformed-pr-json"
    | "range-not-ancestor"
    | "range-empty-diff"
    | "range-ambiguous"
    | "range-unrecognized"
    | "git-failed"
    | "worktree-conflict"
    | "worktree-add-failed"
    | "worktree-remove-failed"
    | "usage";

export interface PrWorktreeDiagnostic {
    problem: PrWorktreeProblem | MigrationDiagnostic["problem"];
    message: string;
}
