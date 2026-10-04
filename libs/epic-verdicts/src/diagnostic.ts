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
    /** The drafted verdict still records story text, which a receipt no longer carries (epic #828, D12). */
    | "story-text-recorded"
    /** A verdict's judgments block cannot be read, so it can serve as no ID registry (epic #829, D2). */
    | "judgments-malformed"
    /** The drafted verdict carries no judgments block, so the next run would have no ID registry (epic #829, D2). */
    | "judgments-missing"
    /**
     * The drafted verdict's severity counts are not the counts of its open items: they leave out an
     * unanswered departure or finding, which blocks (epic #829, G14), or count one already answered
     * or never listed (G15).
     */
    | "counts-not-open"
    /** The departures analyze handed the ID step cannot be read (epic #829, story #858). */
    | "draft-malformed"
    /** The scope handed the ID step cannot be read, or records no answers (epic #829, story #861). */
    | "scope-malformed"
    /**
     * The newest verdict on the pull request is no longer the one the scope was computed against,
     * so what the scope carries forward is not what that verdict holds (epic #829, story #861).
     */
    | "scope-stale"
    /** A verdict marker appears more than once, so copied text could hand a reader the wrong block (epic #829, G28). */
    | "marker-repeated"
    /** The drafted verdict carries no key decisions for close to write (epic #829, story #862, D5, D6). */
    | "key-decisions-missing"
    /** The key decisions name a record digest other than the one the verdict block stamps (epic #829, D5). */
    | "key-decisions-stale"
    /** A deferred-scope proposal settles a criterion of a story the verdict does not cover (epic #829, D7, G27). */
    | "deferred-scope-sibling"
    /** The verdict exceeds the platform's size limit even with its results' file lists dropped (epic #829, D5, G29). */
    | "verdict-too-large";

export interface EpicVerdictsDiagnostic {
    problem: EpicVerdictsProblem;
    message: string;
}
