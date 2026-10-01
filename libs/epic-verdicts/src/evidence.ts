/**
 * Close's per-story evidence report (epic #827, decision record #837, D4).
 *
 * Close used to read only the shipped ledger, never the pull requests that claim a story or the
 * receipts those pull requests carry. This is the one program that builds that evidence, so close
 * runs it and repeats what it prints rather than assembling the report from prose steps — the same
 * rule that put the verdict selection behind a command.
 *
 * Two reads stand behind the report: the claiming read of each live story ({@link
 * resolveStoryMergedPrs}), and the selected receipt of each claiming pull request. Either one
 * failing is a failure of the whole report, naming the story, and close stops before it mines
 * anything. Every remaining story is still read first, so one run names every unreadable story.
 *
 * The report gates nothing else. The shipped-ledger gate keeps deciding whether the epic can close.
 */

import { type RepoSlug } from "@nexus/epic-resolve/gh";
import { type AnalyzeReceipt } from "@nexus/pr-acceptance/verify";
import { readPrVerdict } from "./pr-verdict.js";
import { type Runner } from "./run.js";
import { resolveStoryMergedPrs, type StoryMergedPr, type StoryMergedPrsRead, type StoryReadFailure } from "./story-prs.js";

/** The selected receipt of one pull request: the receipt, null when it carries none, or why it could not be read. */
export type ReceiptRead = { ok: true; receipt: AnalyzeReceipt | null } | { ok: false; cause: string };

/** The reads the report is built from, injected so a spec can stand in for the platform. */
export interface EvidenceDeps {
    readClaims(story: number): StoryMergedPrsRead;
    readReceipt(pr: StoryMergedPr): ReceiptRead;
}

export interface EvidencePr {
    repo: string;
    pr: number;
    /** Whether the pull request carries a selected receipt at all. */
    receipt: boolean;
}

export interface StoryEvidence {
    story: number;
    /** Every merged pull request that claims the story. */
    prs: EvidencePr[];
}

export interface EvidenceReport {
    stories: StoryEvidence[];
    /** Stories marked as shipping without a pull request of their own; never read. */
    excluded: number[];
    /** The report as close repeats it, one line per finding. */
    lines: string[];
}

export type EvidenceResult = { ok: true; report: EvidenceReport } | { ok: false; failures: StoryReadFailure[] };

export interface CollectEvidenceInput {
    /** The epic's live story set, re-read on this run. */
    stories: readonly number[];
    excluded?: readonly number[];
}

function prKey(pr: { repo: string; pr: number }): string {
    return `${pr.repo.toLowerCase()}#${pr.pr}`;
}

/** Build the evidence report for every live, non-excluded story, or name every story whose evidence could not be read. */
export function collectEvidence(deps: EvidenceDeps, input: CollectEvidenceInput): EvidenceResult {
    const excluded = [...(input.excluded ?? [])].sort((a, b) => a - b);
    const failures: StoryReadFailure[] = [];
    const stories: StoryEvidence[] = [];
    const receipts = new Map<string, ReceiptRead>();

    for (const story of [...input.stories].sort((a, b) => a - b)) {
        if (excluded.includes(story)) continue;
        const claims = deps.readClaims(story);
        if (!claims.ok) {
            failures.push(claims.failure);
            continue;
        }
        const prs: EvidencePr[] = [];
        let failed = false;
        for (const pr of claims.result.prs) {
            const key = prKey(pr);
            let read = receipts.get(key);
            if (read === undefined) {
                read = deps.readReceipt(pr);
                receipts.set(key, read);
            }
            if (!read.ok) {
                failures.push({ story, cause: `the receipt on ${pr.repo}#${pr.pr} could not be read: ${read.cause}` });
                failed = true;
                break;
            }
            prs.push({ repo: pr.repo, pr: pr.pr, receipt: read.receipt !== null });
        }
        if (!failed) stories.push({ story, prs });
    }

    if (failures.length > 0) return { ok: false, failures };
    return { ok: true, report: { stories, excluded, lines: [] } };
}

/**
 * The platform-backed reads: the shared claiming read against the issues repository, and the
 * existing verdict selection on each pull request, read from the repository it merged in. Nothing
 * here restates the selection rule.
 */
export function evidenceDeps(run: Runner, cwd: string, issuesRepo: string): EvidenceDeps {
    const slash = issuesRepo.lastIndexOf("/");
    const owner = issuesRepo.slice(0, slash).split("/").pop() ?? "";
    const slug: RepoSlug = { owner, repo: issuesRepo.slice(slash + 1) };
    return {
        readClaims: (story) => resolveStoryMergedPrs(run, cwd, slug, story),
        readReceipt: (pr) => {
            const v = readPrVerdict(run, cwd, pr.pr, pr.repo, issuesRepo, { ghRepo: pr.repo });
            if (!v.ok) return { ok: false, cause: v.error.message };
            return { ok: true, receipt: v.verdict.found ? v.verdict.receipt : null };
        },
    };
}
