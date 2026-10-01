/**
 * Structured failure reporting for the epic-verdicts helper.
 *
 * Same shape and style as the epic-resolve / pr-worktree / record-digest diagnostics — a fixed
 * kebab-case problem plus one human sentence naming the offending input. A missing or malformed
 * verdict is reported through `EpicVerdictsResult`'s own states (missing-verdict, partial-coverage),
 * never through this type — this type is for a broken tool (`gh` refusing, malformed JSON), not for
 * the evidence the derivation exists to collect.
 *
 * The pre-publish check (epic #751) is the one deliberate exception: its refusals are the whole
 * point of the command, so they are named here rather than folded into a result state.
 */

export type EpicVerdictsProblem =
    | "gh-failed"
    | "malformed-json"
    /** The checkout's own repository could not be resolved, so neither repository is known. */
    | "repo-unresolved"
    /** The drafted verdict carries no parseable machine block. */
    | "block-missing"
    /** The drafted verdict names no issues repository (epic #751, invariant 1). */
    | "issues-repo-missing"
    /** A stated issues repository that is not the one resolved here. */
    | "issues-repo-mismatch"
    /** A story's claiming pull requests could not be read (epic #827) — never "no pull request". */
    | "story-read-failed"
    /** A story the drafted verdict names carries no fingerprint (epic #827). */
    | "story-fingerprint-missing"
    /** The drafted verdict fingerprints a story it does not name. */
    | "story-fingerprint-extra"
    /** A fingerprint differs from the digest of the story's current body. */
    | "story-fingerprint-mismatch"
    /** A named story's current body could not be fetched, so its fingerprint cannot be checked. */
    | "story-unreadable";

export interface EpicVerdictsDiagnostic {
    problem: EpicVerdictsProblem;
    message: string;
}
