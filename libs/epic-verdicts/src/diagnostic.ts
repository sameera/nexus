/**
 * Structured failure reporting for the epic-verdicts helper.
 *
 * Same shape and style as the epic-resolve / pr-worktree / record-digest diagnostics — a fixed
 * kebab-case problem plus one human sentence naming the offending input. A missing or malformed
 * verdict is reported through `EpicVerdictsResult`'s own states (missing-verdict, partial-coverage),
 * never through this type — this type is for a broken tool (`gh` refusing, malformed JSON), not for
 * the evidence the derivation exists to collect.
 */

export type EpicVerdictsProblem = "gh-failed" | "malformed-json";

export interface EpicVerdictsDiagnostic {
    problem: EpicVerdictsProblem;
    message: string;
}
