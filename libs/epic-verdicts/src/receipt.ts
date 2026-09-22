/**
 * The aggregated epic receipt — one factual picture derived from the epic's shipped records, never
 * a second conformance run (decision record #505, Summary and invariant 1; epic #769).
 *
 * The records replaced the published verdicts this was built from before. The shape is unchanged,
 * because the close gate and the distiller read the same fields; what changed is that the source is
 * now the epic issue rather than a search over pull-request reviews, so an epic whose code merged
 * in a repository the lead holds no copy of still produces a receipt.
 *
 * Findings are summed **per record**, not per story (invariant 13): a pull request covering more
 * than one story contributes its severity counts exactly once, which is why callers pass the whole
 * record set here rather than pre-summed counts — de-duplication needs to see every record together.
 */

import { formatIssueRef } from "@nexus/workspace/issue-ref";
import { sumLedgerFindings } from "./close-ledger.js";
import { type ShippedRecord } from "./ledger.js";

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

const ZERO: FindingCounts = { critical: 0, high: 0, medium: 0, low: 0 };

export interface BuildEpicReceiptOptions {
    /**
     * The repository the epic issue lives in, when it differs from the code repositories the
     * records already carry. Bare `epic:` is written when this is null or matches every record's
     * own repo — the single-repo case, unchanged from before this option existed.
     */
    issuesRepo?: string | null;
}

/** Build the epic receipt from the records the epic issue carries. */
export function buildEpicReceipt(
    epic: number,
    records: readonly ShippedRecord[],
    excluded: number[] = [],
    opts: BuildEpicReceiptOptions = {},
): EpicReceipt {
    const findings: FindingCounts = records.length === 0 ? { ...ZERO } : sumLedgerFindings(records);

    const prSeen = new Set<string>();
    const prs: EpicReceiptPr[] = [];
    const stories: EpicReceiptStory[] = [];
    for (const r of records) {
        const key = `${r.repo}#${r.pr}`;
        if (!prSeen.has(key)) {
            prSeen.add(key);
            prs.push({ repo: r.repo, pr: r.pr });
        }
        // A record naming two stories lands under both: the receipt is read per story, and the
        // single counting that matters is the findings sum above.
        for (const story of r.stories) stories.push({ story, repo: r.repo, pr: r.pr, head: r.head });
    }
    prs.sort((a, b) => a.repo.localeCompare(b.repo) || a.pr - b.pr);
    stories.sort((a, b) => a.story - b.story || a.repo.localeCompare(b.repo) || a.pr - b.pr);

    // A single receipt can cover records from more than one code repo (an epic shipped across
    // several PRs); qualify against the first one, or leave bare when there is none to compare
    // against — the same "no ambiguity, no key" rule the epic.md and close-record producers follow.
    const codeRepo = stories[0]?.repo ?? prs[0]?.repo ?? null;
    const epicRef = formatIssueRef(
        { repo: opts.issuesRepo ?? null, number: epic },
        codeRepo ? { kind: "repo", repo: codeRepo } : { kind: "none" },
    );
    return { epic: epicRef, findings, stories, prs, excluded: [...excluded].sort((a, b) => a - b) };
}
