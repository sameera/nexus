/**
 * Structured failure reporting for the pr-worktree helper.
 *
 * Same shape and style as the workspace diagnostics — a fixed kebab-case problem plus one human
 * sentence naming the offending input and how to fix it. The close-role diagnostic passes through
 * verbatim (identity resolution reuses closePreflight); this union only adds the PR/worktree
 * failure modes.
 */

import { type CloseRoleDiagnostic } from "@nexus/workspace/close-role";

export type PrWorktreeProblem =
    | "not-a-git-repo"
    | "member-unsupported"
    | "malformed-pr-reference"
    | "member-checkout-missing"
    | "no-story-candidates"
    | "classification-mode-mismatch"
    | "story-candidates-multiple-epics"
    | "malformed-json"
    | "gh-failed"
    | "pr-not-found"
    | "pr-not-merged"
    | "pr-no-merge-commit"
    | "malformed-pr-json"
    | "range-not-ancestor"
    | "range-empty-diff"
    | "range-ambiguous"
    | "range-unrecognized"
    | "trunk-missing-head"
    | "git-failed"
    | "worktree-base-unresolved"
    | "worktree-base-in-repo"
    | "worktree-base-uncreatable"
    | "worktree-conflict"
    | "worktree-add-failed"
    | "worktree-remove-failed"
    | "usage";

export interface PrWorktreeDiagnostic {
    problem: PrWorktreeProblem | CloseRoleDiagnostic["problem"];
    message: string;
}
