/**
 * What an epic has shipped, and what it has not (epic #769, story #772, decision record #777, key
 * decision "The epic-addressed conformance run reports four coverage states").
 *
 * The lead needs a gap while they can still act on it, not at the close. Four states, because the
 * remedies differ:
 *
 *   - **shipped** — every merged pull request that shipped this story carries a record.
 *   - **unrecorded** — a merged pull request exists for this story and carries no record. This is a
 *     merge that never went through the gate; the remedy is one post-merge gate run.
 *   - **unshipped** — nothing merged for this story at all. This is unfinished work.
 *   - **excluded** — the story is marked as shipping without a pull request of its own, so it is
 *     left out of the count rather than counted as a gap.
 *
 * The live story set is re-read on every run, so a story added to the epic after a record was
 * written is reported as unshipped without anything having to invalidate the records already there.
 *
 * The issue graph is used here and **only** here (decision record #777, "The issue graph is a
 * reconciliation aid, not the close gate's source of truth"). A wrong answer from it costs the lead
 * a prompt; it can never cost a wrong close.
 */

import { sameRepo } from "@nexus/workspace/issue-ref";
import { type ShippedRecord, type UntrustedRecord } from "./ledger.js";
import { type StoryMergedPr } from "./story-prs.js";

export type StoryCoverageState = "shipped" | "unrecorded" | "unshipped" | "excluded";

/** A merged pull request naming a story: recorded on the epic issue, or not yet. */
export interface CoveragePr {
    repo: string;
    pr: number;
}

export interface StoryCoverage {
    story: number;
    state: StoryCoverageState;
    /** The records that name this story, in the order the ledger returned them. */
    recorded: CoveragePr[];
    /** Merged pull requests the issue graph ties to this story that carry no record. */
    unrecorded: CoveragePr[];
}

export interface EpicCoverage {
    epic: number;
    stories: StoryCoverage[];
    /** True only when every non-excluded story is `shipped`. */
    fullyShipped: boolean;
    unshipped: number[];
    excluded: number[];
    /** Every unrecorded pull request, with the story it shipped — the reconciliation list. */
    unrecorded: Array<CoveragePr & { story: number }>;
    /** Every record the epic issue carries, named so a full run can print what it found. */
    recorded: Array<CoveragePr & { stories: number[]; mergeCommit: string }>;
    /** Marker-bearing comments whose author cannot speak for the issues repository. */
    untrusted: UntrustedRecord[];
}

export interface AssessEpicCoverageInput {
    epic: number;
    /** The epic's live story set, re-read on this run. */
    stories: number[];
    /** Stories marked as shipping without a pull request of their own. */
    excluded?: number[];
    /** Every trusted record on the epic issue. */
    records: readonly ShippedRecord[];
    /** The issue graph's answer per story — the reconciliation aid, never the source of truth. */
    mergedPrsByStory?: Record<number, readonly StoryMergedPr[]>;
    untrusted?: readonly UntrustedRecord[];
}

function samePr(a: CoveragePr, b: CoveragePr): boolean {
    return a.pr === b.pr && sameRepo(a.repo, b.repo);
}

/** Classify every story of `epic` against the records the epic issue carries. */
export function assessEpicCoverage(input: AssessEpicCoverageInput): EpicCoverage {
    const excluded = [...(input.excluded ?? [])].sort((a, b) => a - b);
    const stories: StoryCoverage[] = [];
    const unrecordedAll: Array<CoveragePr & { story: number }> = [];

    for (const story of [...input.stories].sort((a, b) => a - b)) {
        if (excluded.includes(story)) {
            stories.push({ story, state: "excluded", recorded: [], unrecorded: [] });
            continue;
        }
        const recorded: CoveragePr[] = input.records
            .filter((r) => r.stories.includes(story))
            .map((r) => ({ repo: r.repo, pr: r.pr }));
        const merged = input.mergedPrsByStory?.[story] ?? [];
        const unrecorded: CoveragePr[] = merged
            .map((m) => ({ repo: m.repo, pr: m.pr }))
            .filter((m) => !recorded.some((r) => samePr(r, m)));

        // A merged pull request with no record is a gap whether or not the story has other
        // records: it is code that shipped without passing the gate, and the epic cannot be
        // called fully shipped while one exists.
        const state: StoryCoverageState = unrecorded.length > 0 ? "unrecorded" : recorded.length > 0 ? "shipped" : "unshipped";
        for (const pr of unrecorded) unrecordedAll.push({ ...pr, story });
        stories.push({ story, state, recorded, unrecorded });
    }

    return {
        epic: input.epic,
        stories,
        fullyShipped: stories.every((s) => s.state === "shipped" || s.state === "excluded"),
        unshipped: stories.filter((s) => s.state === "unshipped").map((s) => s.story),
        excluded,
        unrecorded: unrecordedAll,
        recorded: input.records.map((r) => ({ repo: r.repo, pr: r.pr, stories: r.stories, mergeCommit: r.mergeCommit })),
        untrusted: [...(input.untrusted ?? [])],
    };
}
