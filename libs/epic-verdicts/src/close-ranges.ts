/**
 * Close derives each story's commit ranges itself (epic #828, story #841, decision record #849,
 * D1, D2 and D3's missing-checkout half).
 *
 * Close used to take its ranges from two places: a single pull request from the worktree it
 * opened, and several from the shipped ledger. This is the one path for every epic (D1). The
 * epic's stories and every merged pull request that claims each one come from the shared claiming
 * read, so a single-pull-request epic is the one-entry case, and a failed read stops close rather
 * than reading as no pull request.
 *
 * Each merged pull request's range comes from the checkout of the repository it merged in (D2):
 *
 *   - Where a shipped record exists, its stamped range is used verbatim, and the record keeps its
 *     hard block for a merge commit the platform no longer reports. A stamped range is never
 *     recomputed.
 *   - Otherwise the one merge-anchored derivation runs in that checkout. A pull request whose
 *     range has no attributable commits is named "no range" for its story, never left out.
 *
 * Every checkout is located before anything is derived (D3). A member with no checkout stops the
 * run naming the path it was expected at, and nothing is fetched or created in its place. A merge
 * commit the checkout does not hold is "checkout behind", with the fetch that brings it up to date
 * — never "not landed", which is a different finding about a different state. A merge commit the
 * checkout holds but trunk does not reach is "not landed" (story #846), and its story blocks.
 *
 * Each pull request with a range then gets the landed check (story #846, D4): the change its
 * analyzed head made, compared file by file with the change its own range landed. The analyzed
 * head comes from the pull request's selected trusted receipt, through the one receipt reader. The
 * check runs only when that head is the merged head; a pull request with no receipt, or analyzed
 * at another head, is "not checked" with the reason, because classifying it is another gate's job.
 * A changed file is reported, not blocked on, here. Evidence that cannot be read blocks, because
 * close could not then state the result it stamps.
 *
 * Every live story is then sorted into one state (story #847, D5, D7), in the record's order: a
 * receipt close could not read makes it unknown; an open claiming pull request, or no merged one,
 * makes it unshipped; a merged pull request whose receipt does not name it makes it never
 * reviewed; otherwise it is current. Excluded stories are listed as excluded and never read. The
 * claiming read returns every state, and only this classification looks past the merged pull
 * requests: ranges, checkouts, receipts and the landed check are asked of merged ones alone.
 *
 * Between never reviewed and current sits stale (story #842, D5, D6): a receipt names the story,
 * but its evidence no longer holds, for any of three named causes on each pull request — the
 * landed check found a reviewed file that did not land as reviewed, the merged head is not the
 * analyzed head, or the receipt's record digest is not the decision record's current digest. A
 * revised record makes every story its receipt names stale. Every cause is reported, each with
 * the remedy that can clear it, and evidence close could not read — the record's current digest,
 * or the landed check — makes the story unknown rather than guessed at. A story's text plays no
 * part (D12).
 *
 * Two of the stale causes can be waived, and only on the pull request (story #856, D6, D11): a
 * reviewed file that did not land as reviewed, and a revised record. For each, the one trusted
 * waiver reader reads that pull request's waiver comments. A trusted waiver that matches clears
 * that cause on that pull request only, and is stated in `waivers`. A landed-change waiver must
 * name every changed file; a revised-record waiver must name the record's current digest. A waiver
 * that clears nothing is named on the finding with why, and waiver comments that could not be read
 * make the story unknown. A moved head is never waivable, and close never asks for a waiver.
 */

import { type RepoSlug } from "@nexus/epic-resolve/gh";
import { type AnalyzeReceipt } from "@nexus/pr-acceptance/verify";
import { matchLandedChangeWaiver, matchRecordWaiver, readPrWaivers, type PrWaivers, type RejectedWaiver, type WaiverMatch } from "@nexus/pr-acceptance/waiver";
import { compareLandedChange, landedOnTrunk, type LandedChangeInput, type LandedChangeResult, type LandedFile } from "@nexus/pr-worktree/landed-change";
import { resolvePr } from "@nexus/pr-worktree/pr";
import { deriveRange } from "@nexus/pr-worktree/range";
import { fetchPrHead } from "@nexus/pr-worktree/range-read";
import { resolveRepoCheckout, type RepoCheckoutResult } from "@nexus/pr-worktree/repo-checkout";
import { canonicalRemote } from "@nexus/workspace/canonical-remote";
import { shippedRecordKey, type ShippedRecord } from "./ledger.js";
import { readPrVerdict } from "./pr-verdict.js";
import { fetchRecord } from "@nexus/record-digest/fetch";
import { type Runner } from "./run.js";
import { mergedClaims, readStoryClaims, type StoryClaimingPr, type StoryClaimsRead, type StoryMergedPr, type StoryReadFailure } from "./story-prs.js";
import { issuesRepoSlug } from "./verdict-repos.js";

/** What the merge-anchored derivation produced for one pull request. */
export type DeriveOutcome = { ok: true; base: string; head: string } | { ok: false; problem: string; message: string };

/** Whether trunk reaches a commit the checkout holds, and which ref was read as trunk. */
export type TrunkOutcome = { ok: true; onTrunk: boolean; trunkRef: string } | { ok: false; message: string };

/** A pull request's selected trusted receipt (null when it carries none) and its head, or why they could not be read. */
export type LandedReceiptRead = { ok: true; receipt: AnalyzeReceipt | null; prHead: string } | { ok: false; cause: string };

/** The waiver comments on a pull request, or why they could not be read. */
export type WaiverRead = { ok: true; waivers: PrWaivers } | { ok: false; cause: string };

/** The epic's decision record as it reads now (null when the epic has none), or why it could not be read. */
export type CurrentRecordRead = { ok: true; record: { issue: number; digest: string } | null } | { ok: false; cause: string };

/** The reads and git operations the derivation depends on, injected so a spec can stand in for them. */
export interface CloseRangesDeps {
    /** The one claiming read: every claiming pull request, merged, open or closed unmerged. */
    readClaims(story: number): StoryClaimsRead;
    /** Where the checkout of `repo` is. Only looks: never clones, fetches or creates anything. */
    checkoutFor(repo: string): RepoCheckoutResult;
    /** Whether `checkout` holds `sha` as a commit. Never fetches. */
    hasCommit(checkout: string, sha: string): boolean;
    /** The command that brings `checkout` up to date, named in a checkout-behind stop. */
    fetchCommand(checkout: string): string;
    /** The one merge-anchored derivation, run in `checkout`. */
    derive(checkout: string, pr: StoryMergedPr): DeriveOutcome;
    /** Whether trunk reaches `sha`, which `checkout` holds. Never fetches trunk. */
    onTrunk(checkout: string, sha: string): TrunkOutcome;
    /** The one trusted receipt reader, on the pull request. */
    readReceipt(pr: StoryMergedPr): LandedReceiptRead;
    /** The landed check, run in `checkout`. May fetch the pull request's head ref, never trunk. */
    compareLanded(checkout: string, pr: StoryMergedPr, input: LandedChangeInput): LandedChangeResult;
    /** The epic's decision record and its current digest, through the one digest implementation. */
    readRecord(): CurrentRecordRead;
    /** The one trusted waiver reader, on the pull request. */
    readWaivers(pr: StoryMergedPr): WaiverRead;
}

/** One pull request's range as listed under a story. */
export type StoryRangeEntry =
    | { repo: string; pr: number; source: "record" | "derived"; base: string; head: string; checkout: string }
    | { repo: string; pr: number; source: "no-range"; checkout: string };

export interface StoryRanges {
    story: number;
    /** The story's merged pull requests, in platform merge order. */
    ranges: StoryRangeEntry[];
}

/** Why a pull request's landed change was not compared with its reviewed change. */
export type NotCheckedReason = "no-receipt" | "head-mismatch" | "no-range";

/** The landed check of one pull request. */
export type PrLandedCheck =
    | { repo: string; pr: number; result: "unchanged" | "changed"; analyzedHead: string; files: LandedFile[] }
    | { repo: string; pr: number; result: "not-checked"; reason: "no-receipt" | "no-range" }
    | { repo: string; pr: number; result: "not-checked"; reason: "head-mismatch"; analyzedHead: string; mergedHead: string }
    | { repo: string; pr: number; result: "not-landed"; mergeCommit: string; trunkRef: string }
    | { repo: string; pr: number; result: "unknown"; cause: string };

export type LandedResult = PrLandedCheck["result"];

/** One story's landed check: its pull requests in merge order, and the result close states for it. */
export interface StoryLanded {
    story: number;
    /**
     * The worst of its pull requests' results: not landed, then unknown, then changed, then not
     * checked. Unchanged only when every pull request was checked and is unchanged.
     */
    result: LandedResult;
    prs: PrLandedCheck[];
}

/** Where a story stands at close (decision record #849, D5). Any state but `current` and `excluded` stops close. */
export type StoryStateName = "current" | "stale" | "never-reviewed" | "unshipped" | "unknown" | "excluded";

/** Which piece of evidence close could not read. */
export type UnreadableEvidence = "receipt" | "record" | "landed-check" | "waiver";

/** One thing close found about a pull request claiming a story, with the remedy it names. */
export type StoryStateFinding =
    /** An open pull request claims the story: work still in flight. */
    | { repo: string; pr: number; finding: "open" }
    /** A pull request claiming the story closed without merging. */
    | { repo: string; pr: number; finding: "closed-unmerged" }
    /** The merged pull request's selected receipt, if any, does not name the story. */
    | { repo: string; pr: number; finding: "no-receipt"; remedy: string }
    /** Evidence about the merged pull request could not be read: its receipt, the record's current digest, its landed check, or its waiver comments. */
    | { repo: string; pr: number; finding: "unreadable"; evidence: UnreadableEvidence; cause: string }
    /** Stale: the receipt names the story, but analyzed another head than the one that merged. */
    | { repo: string; pr: number; finding: "head-mismatch"; analyzedHead: string; mergedHead: string; remedies: string[] }
    /**
     * Stale: the receipt names the story, but the decision record was revised after it was written.
     * `waivers`, when present, names each waiver comment on the pull request that cleared nothing.
     */
    | { repo: string; pr: number; finding: "record-revised"; record: number; stampedDigest: string; currentDigest: string; remedies: string[]; waivers?: RejectedWaiver[] }
    /** Stale: the receipt names the story, but these reviewed files did not land as reviewed. */
    | { repo: string; pr: number; finding: "landed-change"; files: string[]; remedies: string[]; waivers?: RejectedWaiver[] };

/** A trusted waiver comment that cleared a stale cause on its pull request, for the stories named. */
export type AppliedWaiver = {
    repo: string;
    pr: number;
    author: string;
    url: string;
    at: string;
    reason: string | null;
    stories: number[];
    /** Each untrusted or unreadable waiver comment beside it, which cleared nothing (G32); absent when none. */
    rejected?: RejectedWaiver[];
} & (
    | { cause: "landed-change"; files: string[] }
    | { cause: "record-revised"; record: number; digest: string }
);

/** The finding kinds that make a story stale. */
const STALE_FINDINGS: ReadonlySet<StoryStateFinding["finding"]> = new Set(["head-mismatch", "record-revised", "landed-change"]);

export interface StoryState {
    story: number;
    state: StoryStateName;
    /** Every finding about the story's claiming pull requests, so one pass can fix them all. */
    findings: StoryStateFinding[];
}

/** One entry of the close record's `range:` list. */
export interface CloseRangeEntry {
    repo: string;
    pr: number;
    base: string;
    head: string;
}

export type CloseRangeBlock =
    /** The platform no longer reports the merge commit a shipped record stamped. */
    | { kind: "merge-commit-moved"; repo: string; pr: number; recorded: string; reported: string | null }
    /** The checkout does not hold the merge commit: it is behind, not evidence of anything else. */
    | { kind: "checkout-behind"; repo: string; pr: number; mergeCommit: string; checkout: string; fetch: string }
    /** The derivation refused for a reason other than an empty range. */
    | { kind: "range-underivable"; repo: string; pr: number; problem: string; message: string }
    /** The checkout holds the merge commit, but trunk does not reach it: the pull request did not land. */
    | { kind: "not-landed"; repo: string; pr: number; mergeCommit: string; trunkRef: string; checkout: string }
    /** Whether the pull request landed, or landed as reviewed, could not be read. */
    | { kind: "landed-unreadable"; repo: string; pr: number; message: string };

export interface CloseRanges {
    stories: StoryRanges[];
    /** One entry per merged pull request that has a range, each once, in merge order. */
    range: CloseRangeEntry[];
    /** Every merged claiming pull request whose range is not blocked, each once, in merge order, with a range of its own or not (D6). */
    merged: { repo: string; pr: number }[];
    /** Per live story, the landed check of each merged pull request claiming it. */
    landed: StoryLanded[];
    blocking: CloseRangeBlock[];
    excluded: number[];
    /** True when nothing blocks. */
    ok: boolean;
    /** Every story of the epic, live or excluded, sorted into one state. */
    states: StoryState[];
    /** True when nothing blocks and every story is current or excluded: the only state close proceeds on. */
    closable: boolean;
    /** Every waiver close applied, each once per pull request and cause, which close stamps (G33). */
    waivers: AppliedWaiver[];
    /** What close repeats, one line per story and per block. */
    lines: string[];
}

export interface MissingCheckout {
    repo: string;
    /** The path the checkout was expected at, or null when no declaration names one. */
    expectedPath: string | null;
    problem: string;
    message: string;
}

export type CloseRangesResult =
    | { ok: true; ranges: CloseRanges }
    | { ok: false; problem: "story-read-failed"; failures: StoryReadFailure[] }
    | { ok: false; problem: "checkout-missing"; missing: MissingCheckout[] };

export interface CloseRangesInput {
    /** The epic's live story set. */
    stories: readonly number[];
    excluded?: readonly number[];
    /** The epic's trusted shipped records, for the ranges they stamped. */
    records: readonly ShippedRecord[];
    /** The repository story numbers resolve against, used to qualify them in `lines`. */
    issuesRepo?: string;
}

function prKey(pr: { repo: string; pr: number }): string {
    return shippedRecordKey(pr.repo, pr.pr);
}

function mergeOrder(a: StoryMergedPr, b: StoryMergedPr): number {
    return a.mergedAt.localeCompare(b.mergedAt) || a.repo.localeCompare(b.repo) || a.pr - b.pr;
}

type Outcome = { entry: StoryRangeEntry } | { block: CloseRangeBlock };

const SEVERITY: readonly LandedResult[] = ["not-landed", "unknown", "changed", "not-checked", "unchanged"];

export function deriveCloseRanges(deps: CloseRangesDeps, input: CloseRangesInput): CloseRangesResult {
    const excluded = [...(input.excluded ?? [])].sort((a, b) => a - b);
    const live = [...input.stories].filter((s) => !excluded.includes(s)).sort((a, b) => a - b);

    // 1. The claiming read for every story, each read even after one fails (D1). Only the
    // classification below looks past the merged pull requests (D7).
    const claims = new Map<number, StoryMergedPr[]>();
    const unmerged = new Map<number, StoryClaimingPr[]>();
    const failures: StoryReadFailure[] = [];
    for (const story of live) {
        const read = deps.readClaims(story);
        if (!read.ok) {
            failures.push(read.failure);
            continue;
        }
        claims.set(story, mergedClaims(read.result.prs).sort(mergeOrder));
        unmerged.set(story, read.result.prs.filter((p) => p.state !== "merged"));
    }
    if (failures.length > 0) return { ok: false, problem: "story-read-failed", failures };

    const unique = new Map<string, StoryMergedPr>();
    for (const prs of claims.values()) for (const pr of prs) if (!unique.has(prKey(pr))) unique.set(prKey(pr), pr);
    const ordered = [...unique.values()].sort(mergeOrder);

    // 2. Every checkout, before anything is derived or fetched (D3).
    const checkouts = new Map<string, string>();
    const missing = new Map<string, MissingCheckout>();
    for (const pr of ordered) {
        const repoKey = shippedRecordKey(pr.repo, 0);
        if (checkouts.has(repoKey) || missing.has(repoKey)) continue;
        const found = deps.checkoutFor(pr.repo);
        if (found.ok) checkouts.set(repoKey, found.checkout);
        else missing.set(repoKey, { repo: pr.repo, expectedPath: found.expectedPath ?? null, problem: found.error.problem, message: found.error.message });
    }
    if (missing.size > 0) return { ok: false, problem: "checkout-missing", missing: [...missing.values()] };

    // 3. Each pull request's range: the stamped one where a record exists, else derived (D2).
    const records = new Map(input.records.map((r) => [prKey(r), r] as const));
    const outcomes = new Map<string, Outcome>();
    for (const pr of ordered) {
        const checkout = checkouts.get(shippedRecordKey(pr.repo, 0)) as string;
        outcomes.set(prKey(pr), rangeOf(deps, pr, checkout, records.get(prKey(pr))));
    }

    const stories: StoryRanges[] = live.map((story) => ({
        story,
        ranges: (claims.get(story) ?? []).flatMap((pr) => {
            const o = outcomes.get(prKey(pr));
            return o !== undefined && "entry" in o ? [o.entry] : [];
        }),
    }));
    const range: CloseRangeEntry[] = [];
    const blocking: CloseRangeBlock[] = [];
    for (const pr of ordered) {
        const o = outcomes.get(prKey(pr)) as Outcome;
        if ("block" in o) blocking.push(o.block);
        else if (o.entry.source !== "no-range") range.push({ repo: o.entry.repo, pr: o.entry.pr, base: o.entry.base, head: o.entry.head });
    }

    // 4. Each merged pull request's selected receipt, read once however many stories it implements.
    const receipts = new Map<string, LandedReceiptRead>();
    for (const pr of ordered) receipts.set(prKey(pr), deps.readReceipt(pr));

    // 5. The landed check of each pull request, once however many stories it implements (D4).
    const checks = new Map<string, PrLandedCheck>();
    for (const pr of ordered) {
        const checked = landedCheckOf(deps, pr, outcomes.get(prKey(pr)) as Outcome, receipts.get(prKey(pr)) as LandedReceiptRead);
        checks.set(prKey(pr), checked.check);
        if (checked.block !== undefined) blocking.push(checked.block);
    }
    const landed: StoryLanded[] = live.map((story) => {
        const prs = (claims.get(story) ?? []).map((pr) => checks.get(prKey(pr)) as PrLandedCheck);
        const result = prs.length === 0 ? "not-checked" : SEVERITY.find((r) => prs.some((p) => p.result === r)) ?? "unchanged";
        return { story, result, prs };
    });

    // 6. The decision record's current digest, read once, and only when a receipt stamped one to
    // compare it with (D5).
    const stamped = [...receipts.values()].some((r) => r.ok && r.receipt !== null && r.receipt.recordHash !== null);
    const currentRecord: CurrentRecordRead = stamped ? deps.readRecord() : { ok: true, record: null };

    // 7. Every story's state (D5, D7).
    // Waiver comments are read lazily, once per pull request, and only for a cause one can clear.
    const waiverReads = new Map<string, WaiverRead>();
    const waiversOf = (pr: StoryMergedPr): WaiverRead => {
        let read = waiverReads.get(prKey(pr));
        if (read === undefined) waiverReads.set(prKey(pr), (read = deps.readWaivers(pr)));
        return read;
    };
    const applied = new Map<string, AppliedWaiver>();
    const evidence: Evidence = { receipts, outcomes, checks, currentRecord, issuesRepo: input.issuesRepo, waiversOf, applied };
    const states: StoryState[] = [...input.stories]
        .sort((a, b) => a - b)
        .map((story) =>
            excluded.includes(story)
                ? { story, state: "excluded" as const, findings: [] }
                : classify(story, claims.get(story) ?? [], unmerged.get(story) ?? [], evidence),
        );

    const ok = blocking.length === 0;
    return {
        ok: true,
        ranges: {
            stories,
            range,
            merged: ordered.filter((pr) => "entry" in (outcomes.get(prKey(pr)) as Outcome)).map((pr) => ({ repo: pr.repo, pr: pr.pr })),
            landed,
            blocking,
            excluded,
            ok,
            states,
            closable: ok && states.every((s) => s.state === "current" || s.state === "excluded"),
            waivers: [...applied.values()],
            lines: renderLines(stories, landed, blocking, states, [...applied.values()], input.issuesRepo),
        },
    };
}

/** What the classification reads, each gathered once for the whole epic. */
interface Evidence {
    receipts: ReadonlyMap<string, LandedReceiptRead>;
    outcomes: ReadonlyMap<string, Outcome>;
    checks: ReadonlyMap<string, PrLandedCheck>;
    currentRecord: CurrentRecordRead;
    issuesRepo: string | undefined;
    /** The pull request's waiver comments, read once. */
    waiversOf(pr: StoryMergedPr): WaiverRead;
    /** The waivers applied so far, keyed by pull request and cause. */
    applied: Map<string, AppliedWaiver>;
}

/**
 * One story's state, in the record's order: unknown, then unshipped, then never reviewed, then
 * stale, then current (Mechanism step 4). Every finding is kept whichever state wins, so the lead
 * sees each one in a single pass.
 */
function classify(story: number, merged: readonly StoryMergedPr[], unmerged: readonly StoryClaimingPr[], evidence: Evidence): StoryState {
    const { receipts, outcomes } = evidence;
    const findings: StoryStateFinding[] = [];
    for (const pr of unmerged) findings.push({ repo: pr.repo, pr: pr.pr, finding: pr.state === "open" ? "open" : "closed-unmerged" });

    const naming = (pr: StoryMergedPr): boolean => {
        const r = receipts.get(prKey(pr));
        return r !== undefined && r.ok && r.receipt !== null && r.receipt.stories.includes(story);
    };
    // A pull request with no commits attributable to the story landed nothing to review, so it
    // needs no receipt of its own — unless no receipt names the story at all (G13).
    const namedAnywhere = merged.some(naming);
    for (const pr of merged) {
        const r = receipts.get(prKey(pr)) as LandedReceiptRead;
        if (!r.ok) {
            findings.push({ repo: pr.repo, pr: pr.pr, finding: "unreadable", evidence: "receipt", cause: r.cause });
            continue;
        }
        if (naming(pr)) {
            findings.push(...staleness(story, pr, r.receipt as AnalyzeReceipt, r.prHead, evidence));
            continue;
        }
        const o = outcomes.get(prKey(pr));
        const noRange = o !== undefined && "entry" in o && o.entry.source === "no-range";
        if (noRange && namedAnywhere) continue;
        findings.push({ repo: pr.repo, pr: pr.pr, finding: "no-receipt", remedy: `/nxs.analyze --pr ${pr.pr}` });
    }

    const has = (f: StoryStateFinding["finding"]) => findings.some((x) => x.finding === f);
    const state: StoryStateName = has("unreadable")
        ? "unknown"
        : has("open") || merged.length === 0
          ? "unshipped"
          : has("no-receipt")
            ? "never-reviewed"
            : findings.some((x) => STALE_FINDINGS.has(x.finding))
              ? "stale"
              : "current";
    return { story, state, findings };
}

/**
 * Whether a receipt that names the story still holds for the pull request it was published on
 * (D5), with the remedy that can clear each cause that does not (D6). A moved head is cleared by
 * re-analyzing the merged head; a revised record by that run or by a trusted waiver on the pull
 * request; a reviewed file that did not land as reviewed only by a waiver, because re-analyzing the
 * same head cannot change what landed. A waiver already posted clears its cause here (D11).
 */
function staleness(story: number, pr: StoryMergedPr, receipt: AnalyzeReceipt, prHead: string, evidence: Evidence): StoryStateFinding[] {
    const ref = { repo: pr.repo, pr: pr.pr };
    const where = `${pr.repo}#${pr.pr}`;
    const analyze = `/nxs.analyze --pr ${pr.pr}`;
    const out: StoryStateFinding[] = [];

    if (receipt.head !== prHead) out.push({ ...ref, finding: "head-mismatch", analyzedHead: receipt.head, mergedHead: prHead, remedies: [analyze] });

    if (receipt.recordHash !== null) {
        const current = evidence.currentRecord;
        if (!current.ok) {
            out.push({ ...ref, finding: "unreadable", evidence: "record", cause: `the decision record's current digest could not be read: ${current.cause}` });
        } else if (current.record === null) {
            out.push({
                ...ref,
                finding: "unreadable",
                evidence: "record",
                cause: "its receipt stamps a decision-record digest, but the epic has no decision record to compare it with",
            });
        } else if (current.record.digest !== receipt.recordHash) {
            const { issue, digest } = current.record;
            const record = evidence.issuesRepo ? `${evidence.issuesRepo}#${issue}` : `#${issue}`;
            const finding: StoryStateFinding = {
                ...ref,
                finding: "record-revised",
                record: issue,
                stampedDigest: receipt.recordHash,
                currentDigest: digest,
                remedies: [analyze, `a trusted waiver comment a lead posts on ${where} in the close-waiver form, waive: record-revised, record: "${record}", digest: ${digest}`],
            };
            out.push(...waived(story, pr, finding, evidence, (w) => matchRecordWaiver(w, issue, digest, evidence.issuesRepo), { cause: "record-revised", record: issue, digest }));
        }
    }

    const check = evidence.checks.get(prKey(pr));
    if (check?.result === "changed") {
        const files = check.files.filter((f) => f.status === "changed").map((f) => f.path);
        const finding: StoryStateFinding = {
            ...ref,
            finding: "landed-change",
            files,
            remedies: [`a trusted waiver comment a lead posts on ${where} in the close-waiver form, waive: landed-change, naming every file under files: ${files.join(", ")}`],
        };
        out.push(...waived(story, pr, finding, evidence, (w) => matchLandedChangeWaiver(w, files), { cause: "landed-change", files }));
    } else if (check?.result === "unknown") {
        const o = evidence.outcomes.get(prKey(pr));
        // A pull request with no range established already stops close for the block's own reason.
        if (o !== undefined && "entry" in o) out.push({ ...ref, finding: "unreadable", evidence: "landed-check", cause: check.cause });
    }
    return out;
}

/**
 * A waivable stale finding after the pull request's waiver comments are read: nothing when a
 * trusted waiver clears it (recorded in `applied`), the finding naming each waiver that cleared
 * nothing otherwise, and the finding plus an unreadable one when the comments could not be read —
 * never the finding alone, which would read a failed read as "no waiver".
 */
function waived(
    story: number,
    pr: StoryMergedPr,
    finding: Extract<StoryStateFinding, { finding: "landed-change" | "record-revised" }>,
    evidence: Evidence,
    match: (w: PrWaivers) => WaiverMatch,
    terms: { cause: "landed-change"; files: string[] } | { cause: "record-revised"; record: number; digest: string },
): StoryStateFinding[] {
    const read = evidence.waiversOf(pr);
    if (!read.ok) {
        return [finding, { repo: pr.repo, pr: pr.pr, finding: "unreadable", evidence: "waiver", cause: read.cause }];
    }
    const m = match(read.waivers);
    if (m.applied === null) return [m.rejected.length > 0 ? { ...finding, waivers: m.rejected } : finding];
    const key = `${prKey(pr)}:${terms.cause}`;
    const known = evidence.applied.get(key);
    if (known !== undefined) {
        if (!known.stories.includes(story)) known.stories.push(story);
    } else {
        const { author, url, at } = m.applied;
        const reason = m.applied.waiver.ok ? m.applied.waiver.reason : null;
        const rejected = m.rejected.length > 0 ? { rejected: m.rejected } : {};
        evidence.applied.set(key, { repo: pr.repo, pr: pr.pr, author, url, at, reason, stories: [story], ...terms, ...rejected });
    }
    return [];
}

function landedCheckOf(deps: CloseRangesDeps, pr: StoryMergedPr, o: Outcome, read: LandedReceiptRead): { check: PrLandedCheck; block?: CloseRangeBlock } {
    const ref = { repo: pr.repo, pr: pr.pr };
    if ("block" in o) {
        if (o.block.kind === "not-landed") return { check: { ...ref, result: "not-landed", mergeCommit: o.block.mergeCommit, trunkRef: o.block.trunkRef } };
        // Close already stops on this pull request for the block's own reason.
        return { check: { ...ref, result: "unknown", cause: `no range was established (${o.block.kind})` } };
    }
    const entry = o.entry;
    if (entry.source === "no-range") return { check: { ...ref, result: "not-checked", reason: "no-range" } };

    const unreadable = (message: string) => ({
        check: { ...ref, result: "unknown" as const, cause: message },
        block: { kind: "landed-unreadable" as const, ...ref, message },
    });
    if (!read.ok) return unreadable(`the receipt on ${pr.repo}#${pr.pr} could not be read: ${read.cause}`);
    if (read.receipt === null) return { check: { ...ref, result: "not-checked", reason: "no-receipt" } };
    const analyzedHead = read.receipt.head;
    if (analyzedHead !== read.prHead) {
        return { check: { ...ref, result: "not-checked", reason: "head-mismatch", analyzedHead, mergedHead: read.prHead } };
    }

    const compared = deps.compareLanded(entry.checkout, pr, { analyzedHead, base: entry.base, head: entry.head });
    if (!compared.ok) return unreadable(`the landed check of ${pr.repo}#${pr.pr} failed: ${compared.error.message}`);
    const result = compared.files.some((f) => f.status === "changed") ? "changed" : "unchanged";
    return { check: { ...ref, result, analyzedHead, files: compared.files } };
}

function rangeOf(deps: CloseRangesDeps, pr: StoryMergedPr, checkout: string, rec: ShippedRecord | undefined): Outcome {
    const behind = (mergeCommit: string): Outcome => ({
        block: { kind: "checkout-behind", repo: pr.repo, pr: pr.pr, mergeCommit, checkout, fetch: deps.fetchCommand(checkout) },
    });
    // Asked only of a merge commit the checkout holds, so "no" means it never reached trunk (D3).
    const offTrunk = (mergeCommit: string): Outcome | null => {
        const t = deps.onTrunk(checkout, mergeCommit);
        if (!t.ok) return { block: { kind: "landed-unreadable", repo: pr.repo, pr: pr.pr, message: t.message } };
        return t.onTrunk ? null : { block: { kind: "not-landed", repo: pr.repo, pr: pr.pr, mergeCommit, trunkRef: t.trunkRef, checkout } };
    };

    if (rec !== undefined) {
        if (pr.mergeCommit !== rec.mergeCommit) {
            return { block: { kind: "merge-commit-moved", repo: rec.repo, pr: pr.pr, recorded: rec.mergeCommit, reported: pr.mergeCommit } };
        }
        if (!deps.hasCommit(checkout, rec.mergeCommit)) return behind(rec.mergeCommit);
        const off = offTrunk(rec.mergeCommit);
        if (off !== null) return off;
        return { entry: { repo: rec.repo, pr: pr.pr, source: "record", base: rec.base, head: rec.head, checkout } };
    }

    if (pr.mergeCommit === null) {
        return {
            block: {
                kind: "range-underivable",
                repo: pr.repo,
                pr: pr.pr,
                problem: "pr-no-merge-commit",
                message: `the platform reports no merge commit for ${pr.repo}#${pr.pr}, so no range anchored on the trunk can be derived.`,
            },
        };
    }
    if (!deps.hasCommit(checkout, pr.mergeCommit)) return behind(pr.mergeCommit);
    const off = offTrunk(pr.mergeCommit);
    if (off !== null) return off;

    const derived = deps.derive(checkout, pr);
    if (derived.ok) return { entry: { repo: pr.repo, pr: pr.pr, source: "derived", base: derived.base, head: derived.head, checkout } };
    // An empty range, pipeline stores excluded, is a pull request with no commits attributable
    // to the story. It is named, never skipped (G2).
    if (derived.problem === "range-empty-diff") return { entry: { repo: pr.repo, pr: pr.pr, source: "no-range", checkout } };
    return { block: { kind: "range-underivable", repo: pr.repo, pr: pr.pr, problem: derived.problem, message: derived.message } };
}

function describeCheck(c: PrLandedCheck): string {
    const pr = `${c.repo}#${c.pr}`;
    switch (c.result) {
        case "unchanged":
            return `${pr} unchanged (${c.files.length} file${c.files.length === 1 ? "" : "s"})`;
        case "changed":
            return `${pr} changed: ${c.files.filter((f) => f.status === "changed").map((f) => f.path).join(", ")}`;
        case "not-checked":
            if (c.reason === "head-mismatch") return `${pr} not checked (analyzed head ${c.analyzedHead} is not the merged head ${c.mergedHead})`;
            return `${pr} not checked (${c.reason === "no-receipt" ? "no receipt" : "no range"})`;
        case "not-landed":
            return `${pr} not landed (trunk ${c.trunkRef} does not reach merge commit ${c.mergeCommit})`;
        case "unknown":
            return `${pr} unknown (${c.cause})`;
    }
}

function describeUnreadable(f: Extract<StoryStateFinding, { finding: "unreadable" }>): string {
    const pr = `${f.repo}#${f.pr}`;
    switch (f.evidence) {
        case "receipt":
            return `the receipt on ${pr} could not be read: ${f.cause}`;
        case "record":
            return `${pr}: ${f.cause}`;
        case "landed-check":
            return `the landed check of ${pr} could not be read: ${f.cause}`;
        case "waiver":
            return `the waiver comments on ${pr} could not be read: ${f.cause}`;
    }
}

/** Why one waiver comment cleared nothing. */
function describeRejected(r: RejectedWaiver): string {
    const who = `the waiver comment ${r.url} by @${r.author || "unknown"}`;
    switch (r.why) {
        case "untrusted":
            return `${who} cleared nothing: its author cannot speak for the repository`;
        case "malformed":
            return `${who} cleared nothing: ${r.problem}`;
        case "incomplete":
            return `${who} cleared nothing: it does not name ${r.uncovered.join(", ")}`;
        case "other-revision":
            return `${who} cleared nothing: it accepts record ${r.record} at digest ${r.digest}, not the current revision`;
    }
}

const rejectedOf = (f: { waivers?: RejectedWaiver[] }): string => (f.waivers ?? []).map((r) => `; ${describeRejected(r)}`).join("");

/** One stale cause, naming the pull request, the reason and every remedy that can clear it. */
function describeStale(f: StoryStateFinding): string | null {
    const pr = `${f.repo}#${f.pr}`;
    switch (f.finding) {
        case "head-mismatch":
            return `${pr} analyzed head ${f.analyzedHead} is not the merged head ${f.mergedHead}; run ${f.remedies[0]}`;
        case "record-revised":
            return `${pr} receipt was written against an earlier decision record (${f.stampedDigest} → ${f.currentDigest}); run ${f.remedies[0]}, or post ${f.remedies[1]}${rejectedOf(f)}`;
        case "landed-change":
            return `${pr} did not land ${f.files.join(", ")} as reviewed; no analyze run can clear this, only ${f.remedies[0]}${rejectedOf(f)}`;
        default:
            return null;
    }
}

/** The lines close repeats for a story that stops it, naming every finding and its remedy. */
function describeState(s: StoryState, ref: string): string[] {
    const stale = s.findings.map(describeStale).filter((x): x is string => x !== null);
    const head = describeHead(s, ref, stale);
    if (head === null) return [];
    // A story stopped for another reason still names its stale causes, so one pass fixes all of them.
    return s.state === "stale" || stale.length === 0 ? [head] : [head, `${ref} — also stale: ${stale.join("; ")}`];
}

function describeHead(s: StoryState, ref: string, stale: readonly string[]): string | null {
    const named = (f: StoryStateFinding["finding"]) => s.findings.filter((x) => x.finding === f).map((x) => `${x.repo}#${x.pr}`);
    switch (s.state) {
        case "current":
        case "excluded":
            return null;
        case "stale":
            return `${ref} — stale: ${stale.join("; ")}`;
        case "unknown": {
            const causes = s.findings.flatMap((f) => (f.finding === "unreadable" ? [describeUnreadable(f)] : []));
            return `${ref} — unknown: ${causes.join("; ")}. Re-run once the read succeeds`;
        }
        case "unshipped": {
            // Analysis cannot finish work that has not merged, so no analyze remedy is named (G14).
            const open = named("open");
            if (open.length > 0) {
                return `${ref} — unshipped: ${open.join(", ")} ${open.length === 1 ? "is" : "are"} open and claim${open.length === 1 ? "s" : ""} it. Merge or close ${open.length === 1 ? "it" : "them"}, then re-run`;
            }
            const closed = named("closed-unmerged");
            if (closed.length > 0) {
                return `${ref} — unshipped: its only claiming pull request${closed.length === 1 ? "" : "s"} ${closed.join(", ")} closed without merging. Ship it through a pull request that claims it, then re-run`;
            }
            return `${ref} — unshipped: no pull request claims it. Ship it through a pull request that claims it, then re-run`;
        }
        case "never-reviewed": {
            const prs = s.findings.flatMap((f) => (f.finding === "no-receipt" ? [f] : []));
            const remedies = prs.map((f) => `${f.remedy} (${f.repo}#${f.pr})`).join(", ");
            return `${ref} — never reviewed: no receipt on ${prs.map((f) => `${f.repo}#${f.pr}`).join(", ")} names it. Run ${remedies}. No waiver is offered`;
        }
    }
}

function renderLines(
    stories: readonly StoryRanges[],
    landed: readonly StoryLanded[],
    blocking: readonly CloseRangeBlock[],
    states: readonly StoryState[],
    waivers: readonly AppliedWaiver[],
    issuesRepo: string | undefined,
): string[] {
    const lines: string[] = [];
    for (const s of stories) {
        const ref = issuesRepo ? `${issuesRepo}#${s.story}` : `#${s.story}`;
        if (s.ranges.length === 0) {
            lines.push(`${ref} — no merged pull request claims it`);
            continue;
        }
        const parts = s.ranges.map((r) =>
            r.source === "no-range" ? `${r.repo}#${r.pr} no range` : `${r.repo}#${r.pr} ${r.base}...${r.head} (${r.source})`,
        );
        lines.push(`${ref} — ${parts.join("; ")}`);
    }
    for (const s of landed) {
        if (s.prs.length === 0) continue;
        const ref = issuesRepo ? `${issuesRepo}#${s.story}` : `#${s.story}`;
        lines.push(`${ref} — landed check: ${s.prs.map(describeCheck).join("; ")}`);
    }
    for (const w of waivers) {
        const stories = w.stories.map((s) => (issuesRepo ? `${issuesRepo}#${s}` : `#${s}`)).join(", ");
        const terms = w.cause === "landed-change" ? `landed-change naming ${w.files.join(", ")}` : `record-revised accepting record #${w.record} at digest ${w.digest}`;
        lines.push(`${w.repo}#${w.pr} — waiver applied for ${stories}: ${terms}, by @${w.author || "unknown"} (${w.url})${(w.rejected ?? []).map((r) => `; ${describeRejected(r)}`).join("")}`);
    }
    for (const s of states) lines.push(...describeState(s, issuesRepo ? `${issuesRepo}#${s.story}` : `#${s.story}`));
    for (const b of blocking) {
        if (b.kind === "merge-commit-moved") {
            lines.push(`${b.repo}#${b.pr} — the platform no longer reports the merge commit its record stamped (recorded ${b.recorded}, reports ${b.reported ?? "none"})`);
        } else if (b.kind === "checkout-behind") {
            lines.push(`${b.repo}#${b.pr} — checkout behind: ${b.checkout} does not hold merge commit ${b.mergeCommit}. Run '${b.fetch}' and re-run`);
        } else if (b.kind === "not-landed") {
            lines.push(`${b.repo}#${b.pr} — not landed: ${b.checkout} holds merge commit ${b.mergeCommit}, but trunk ${b.trunkRef} does not reach it. Its story blocks`);
        } else if (b.kind === "landed-unreadable") {
            lines.push(`${b.repo}#${b.pr} — the landed check could not be read: ${b.message}`);
        } else {
            lines.push(`${b.repo}#${b.pr} — no range could be derived (${b.problem}): ${b.message}`);
        }
    }
    return lines;
}

/**
 * The platform-backed reads: the shared claiming read against the issues repository, the
 * checkout lookup the drain also uses, and the one merge-anchored derivation, run in the checkout
 * of the repository each pull request merged in. Nothing here restates a rule those own.
 *
 * The claiming read is passed through in every state: close is the one caller that classifies an
 * open or closed-unmerged pull request, and the derivation narrows to merged ones itself (D7).
 */
export function closeRangesDeps(run: Runner, root: string, issuesRepo: string, record: number | null = null): CloseRangesDeps {
    const slug: RepoSlug = issuesRepoSlug(issuesRepo);
    return {
        readClaims: (story) => readStoryClaims(run, root, slug, story),
        checkoutFor: (repo) => resolveRepoCheckout(root, run, repo),
        hasCommit: (checkout, sha) => run("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd: checkout }).status === 0,
        fetchCommand: (checkout) => `git -C ${checkout} fetch ${canonicalRemote(run, checkout)}`,
        derive: (checkout, pr) => {
            const info = resolvePr(run, checkout, pr.pr, { requireMerged: true });
            if (!info.ok) return { ok: false, problem: info.error.problem, message: info.error.message };
            // The pull request's head ref is the one fetch close may make in an existing checkout
            // (D3): it tells a squash from a rebase. Trunk is never fetched here.
            const prHead = fetchPrHead(run, checkout, pr.pr);
            const derived = deriveRange(run, checkout, info.pr, { verifyAgainstPrHead: prHead });
            if (!derived.ok) return { ok: false, problem: derived.error.problem, message: derived.error.message };
            return { ok: true, base: derived.range.base, head: derived.range.head };
        },
        onTrunk: (checkout, sha) => {
            const t = landedOnTrunk(run, checkout, sha);
            return t.ok ? t : { ok: false, message: t.error.message };
        },
        readReceipt: (pr) => {
            const v = readPrVerdict(run, root, pr.pr, pr.repo, issuesRepo, { ghRepo: pr.repo });
            if (!v.ok) return { ok: false, cause: v.error.message };
            return { ok: true, receipt: v.verdict.found ? v.verdict.receipt : null, prHead: v.verdict.prHead };
        },
        compareLanded: (checkout, pr, input) => {
            // The analyzed head is the merged head here, so the pull request's head ref brings it
            // in when the checkout lacks it — the one fetch close may make (D3).
            if (run("git", ["cat-file", "-e", `${input.analyzedHead}^{commit}`], { cwd: checkout }).status !== 0) fetchPrHead(run, checkout, pr.pr);
            return compareLandedChange(run, checkout, input);
        },
        readRecord: () => {
            if (record === null) return { ok: true, record: null };
            // The one digest implementation, over the record body as fetched back (nxs-record-digest).
            const fetched = fetchRecord(run, root, record, issuesRepo);
            return fetched.ok ? { ok: true, record: { issue: record, digest: fetched.record.digest } } : { ok: false, cause: fetched.error.message };
        },
        readWaivers: (pr) => {
            const read = readPrWaivers(run, root, pr.pr, { ghRepo: pr.repo });
            return read.ok ? { ok: true, waivers: read.value } : { ok: false, cause: read.error.message };
        },
    };
}
