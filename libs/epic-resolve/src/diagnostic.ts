/**
 * Structured failure reporting for the epic resolver.
 *
 * Same shape and style as the pr-worktree / close-migration / workspace diagnostics — a fixed
 * kebab-case problem plus one human sentence naming the offending input and how to fix it. The
 * resolver is fail-closed: every failure mode surfaces here and produces no epic output, so a
 * dropped story can never be mistaken for an epic that simply has fewer stories.
 */

export type EpicResolveProblem =
    | "not-a-git-repo"
    | "gh-failed"
    | "epic-not-found"
    | "malformed-json"
    | "subissue-fetch-failed"
    | "not-an-epic"
    | "usage";

export interface EpicResolveDiagnostic {
    problem: EpicResolveProblem;
    message: string;
}
