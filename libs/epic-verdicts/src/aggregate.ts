/**
 * Derive one epic receipt from every story's resolved verdict, or stop and name the gap.
 *
 * Decision record #505's acceptance criteria for story #496: when every story in the epic carries
 * a verdict, one epic receipt is derived and no conformance run repeats; when any story carries no
 * verdict on any of its candidate pull requests, the derivation stops and names that story — never
 * a receipt with a hole silently papered over.
 *
 * Story #499 refines the "some story has no verdict" case into two: when **not a single** required
 * story carries a verdict, this is an epic that never shipped story by story, and the caller should
 * fall back to today's full-epic conformance run (`"none"`) — never a stop, because there is nothing
 * partial to report. When **some but not all** required stories carry one, that is a genuine gap
 * (`"partial"`), and the derivation stops and names it. `excludedStories` — a story marked as
 * shipping without its own pull request — is removed from the coverage requirement entirely before
 * this classification runs, and is named on the receipt as excluded rather than as present or
 * missing.
 */

import { type EpicVerdictsDiagnostic } from "./diagnostic.js";
import { buildEpicReceipt, type EpicReceipt } from "./receipt.js";
import { type Runner } from "./run.js";
import { resolveStoryVerdict, type StoryPrCandidate, type StoryVerdict } from "./verdict.js";

export interface ResolveEpicVerdictsInput {
    epic: number;
    stories: number[];
    /** Pre-discovered candidate pull requests per story, each self-describing its own repo/checkout (see discover.ts). */
    candidatesByStory: Record<number, StoryPrCandidate[]>;
    /** Stories marked as shipping without their own pull request — excluded from coverage. */
    excludedStories?: number[];
}

export type ResolveEpicVerdictsResult =
    | { ok: true; state: "aggregate"; receipt: EpicReceipt; verdicts: StoryVerdict[] }
    | { ok: true; state: "none" }
    | { ok: true; state: "partial"; missing: number[]; present: number[] }
    | { ok: false; error: EpicVerdictsDiagnostic };

/**
 * Resolve every non-excluded story's verdict and derive the epic receipt; fall back to `"none"`
 * when no required story has one, or stop as `"partial"` and name the gap when only some do.
 */
export function resolveEpicVerdicts(run: Runner, input: ResolveEpicVerdictsInput): ResolveEpicVerdictsResult {
    const excluded = input.excludedStories ?? [];
    const required = input.stories.filter((s) => !excluded.includes(s));

    const verdicts: StoryVerdict[] = [];
    const missing: number[] = [];
    const present: number[] = [];

    for (const story of required) {
        const candidates = input.candidatesByStory[story] ?? [];
        const r = resolveStoryVerdict(run, { epic: input.epic, story, candidates });
        if (!r.ok) return r;
        if (r.found) {
            verdicts.push(r.verdict);
            present.push(story);
        } else {
            missing.push(story);
        }
    }

    if (present.length === 0) return { ok: true, state: "none" };
    if (missing.length > 0) return { ok: true, state: "partial", missing, present };
    return { ok: true, state: "aggregate", receipt: buildEpicReceipt(input.epic, verdicts, excluded), verdicts };
}
