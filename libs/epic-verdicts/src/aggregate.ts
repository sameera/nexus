/**
 * Derive one epic receipt from every story's resolved verdict, or stop and name the gap.
 *
 * Decision record #505's acceptance criteria for story #496: when every story in the epic carries
 * a verdict, one epic receipt is derived and no conformance run repeats; when any story carries no
 * verdict on any of its candidate pull requests, the derivation stops and names that story — never
 * a receipt with a hole silently papered over.
 */

import { type RepoSlug } from "@nexus/epic-resolve/gh";
import { type EpicVerdictsDiagnostic } from "./diagnostic.js";
import { buildEpicReceipt, type EpicReceipt } from "./receipt.js";
import { type Runner } from "./run.js";
import { resolveStoryVerdict, type StoryVerdict } from "./verdict.js";

export interface ResolveEpicVerdictsInput {
    slug: RepoSlug;
    epic: number;
    stories: number[];
    /** Pre-discovered candidate pull requests per story (see discover.ts). */
    candidatesByStory: Record<number, number[]>;
}

export type ResolveEpicVerdictsResult =
    | { ok: true; state: "aggregate"; receipt: EpicReceipt }
    | { ok: true; state: "missing"; missing: number[]; present: number[] }
    | { ok: false; error: EpicVerdictsDiagnostic };

/** Resolve every story's verdict and derive the epic receipt, or stop and name the missing ones. */
export function resolveEpicVerdicts(run: Runner, cwd: string, input: ResolveEpicVerdictsInput): ResolveEpicVerdictsResult {
    const verdicts: StoryVerdict[] = [];
    const missing: number[] = [];
    const present: number[] = [];

    for (const story of input.stories) {
        const candidates = input.candidatesByStory[story] ?? [];
        const r = resolveStoryVerdict(run, cwd, { slug: input.slug, epic: input.epic, story, candidates });
        if (!r.ok) return r;
        if (r.found) {
            verdicts.push(r.verdict);
            present.push(story);
        } else {
            missing.push(story);
        }
    }

    if (missing.length > 0) return { ok: true, state: "missing", missing, present };
    return { ok: true, state: "aggregate", receipt: buildEpicReceipt(input.epic, verdicts) };
}
