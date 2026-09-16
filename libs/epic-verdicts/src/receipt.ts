/**
 * The aggregated epic receipt — one factual picture derived from the story verdicts, never a
 * second conformance run (decision record #505, Summary and invariant 1).
 *
 * Findings are summed **per distinct verdict**, not per story (invariant 2): a verdict covering
 * more than one story contributes its severity counts exactly once, which is why callers pass the
 * whole set of per-story verdicts here rather than pre-summed counts — de-duplication needs to see
 * every verdict together.
 */

import { formatIssueRef } from "@nexus/workspace/issue-ref";
import { type StoryVerdict } from "./verdict.js";

export type FindingCounts = { critical: number; high: number; medium: number; low: number };

export interface EpicReceiptStory {
    /** The issue number, in the issues repo — never the same repo as `repo` below in a workspace. */
    story: number;
    /** The **code** repository the pull request lives in. Read `EpicReceipt.epic` for where the
     * issue itself lives; the two fields sit beside each other but never name the same repo when
     * the epic was filed into a separate issues repo. */
    repo: string;
    pr: number;
    head: string;
}

export interface EpicReceiptPr {
    /** The **code** repository, same meaning as {@link EpicReceiptStory.repo}. */
    repo: string;
    pr: number;
}

export interface EpicReceipt {
    /** Bare `#N`, or `owner/repo#N` when the issues repo differs from every story's code repo. */
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

export interface BuildEpicReceiptOptions {
    /**
     * The repository the epic issue lives in, when it differs from the code repositories the
     * verdicts already carry. Bare `epic:` is written when this is null or matches every
     * verdict's own repo — the single-repo case, unchanged from before this option existed.
     */
    issuesRepo?: string | null;
}

/** Build the epic receipt from the epic's resolved per-story verdicts. */
export function buildEpicReceipt(
    epic: number,
    verdicts: StoryVerdict[],
    excluded: number[] = [],
    opts: BuildEpicReceiptOptions = {},
): EpicReceipt {
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

    // A single receipt can cover verdicts from more than one code repo (an epic shipped across
    // several PRs); qualify against the first one, or leave bare when there is none to compare
    // against — the same "no ambiguity, no key" rule the epic.md and close-record producers follow.
    const codeRepo = stories[0]?.repo ?? prs[0]?.repo ?? null;
    const epicRef = formatIssueRef(
        { repo: opts.issuesRepo ?? null, number: epic },
        codeRepo ? { kind: "repo", repo: codeRepo } : { kind: "none" },
    );
    return { epic: epicRef, findings, stories, prs, excluded: [...excluded].sort((a, b) => a - b) };
}
