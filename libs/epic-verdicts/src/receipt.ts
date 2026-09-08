/**
 * The aggregated epic receipt — one factual picture derived from the story verdicts, never a
 * second conformance run (decision record #505, Summary and invariant 1).
 *
 * Findings are summed **per distinct verdict**, not per story (invariant 2): a verdict covering
 * more than one story contributes its severity counts exactly once, which is why callers pass the
 * whole set of per-story verdicts here rather than pre-summed counts — de-duplication needs to see
 * every verdict together.
 */

import { type StoryVerdict } from "./verdict.js";

export type FindingCounts = { critical: number; high: number; medium: number; low: number };

export interface EpicReceiptStory {
    story: number;
    repo: string;
    pr: number;
    head: string;
}

export interface EpicReceiptPr {
    repo: string;
    pr: number;
}

export interface EpicReceipt {
    epic: string;
    findings: FindingCounts;
    stories: EpicReceiptStory[];
    prs: EpicReceiptPr[];
    /** Stories marked as shipping without their own pull request — excluded from coverage. */
    excluded: number[];
}

function verdictKey(v: StoryVerdict): string {
    return `${v.repo}#${v.pr}@${v.head}`;
}

const ZERO: FindingCounts = { critical: 0, high: 0, medium: 0, low: 0 };

/** Build the epic receipt from the epic's resolved per-story verdicts. */
export function buildEpicReceipt(epic: number, verdicts: StoryVerdict[], excluded: number[] = []): EpicReceipt {
    const distinctByKey = new Map<string, StoryVerdict>();
    for (const v of verdicts) distinctByKey.set(verdictKey(v), v);

    const findings: FindingCounts = { ...ZERO };
    for (const v of distinctByKey.values()) {
        for (const severity of Object.keys(findings) as Array<keyof FindingCounts>) {
            findings[severity] += v.receipt.findings[severity] ?? 0;
        }
    }

    const prSeen = new Set<string>();
    const prs: EpicReceiptPr[] = [];
    for (const v of distinctByKey.values()) {
        const key = `${v.repo}#${v.pr}`;
        if (prSeen.has(key)) continue;
        prSeen.add(key);
        prs.push({ repo: v.repo, pr: v.pr });
    }
    prs.sort((a, b) => a.repo.localeCompare(b.repo) || a.pr - b.pr);

    const stories: EpicReceiptStory[] = verdicts
        .map((v) => ({ story: v.story, repo: v.repo, pr: v.pr, head: v.head }))
        .sort((a, b) => a.story - b.story);

    return { epic: `#${epic}`, findings, stories, prs, excluded: [...excluded].sort((a, b) => a - b) };
}
