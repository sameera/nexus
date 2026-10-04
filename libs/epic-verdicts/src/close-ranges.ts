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
 */

import { type RepoSlug } from "@nexus/epic-resolve/gh";
import { type AnalyzeReceipt } from "@nexus/pr-acceptance/verify";
import { compareLandedChange, landedOnTrunk, type LandedChangeInput, type LandedChangeResult, type LandedFile } from "@nexus/pr-worktree/landed-change";
import { resolvePr } from "@nexus/pr-worktree/pr";
import { deriveRange } from "@nexus/pr-worktree/range";
import { fetchPrHead } from "@nexus/pr-worktree/range-read";
import { resolveRepoCheckout, type RepoCheckoutResult } from "@nexus/pr-worktree/repo-checkout";
import { canonicalRemote } from "@nexus/workspace/canonical-remote";
import { shippedRecordKey, type ShippedRecord } from "./ledger.js";
import { readPrVerdict } from "./pr-verdict.js";
import { type Runner } from "./run.js";
import { resolveStoryMergedPrs, type StoryMergedPr, type StoryMergedPrsRead, type StoryReadFailure } from "./story-prs.js";

/** What the merge-anchored derivation produced for one pull request. */
export type DeriveOutcome = { ok: true; base: string; head: string } | { ok: false; problem: string; message: string };

/** Whether trunk reaches a commit the checkout holds, and which ref was read as trunk. */
export type TrunkOutcome = { ok: true; onTrunk: boolean; trunkRef: string } | { ok: false; message: string };

/** A pull request's selected trusted receipt (null when it carries none) and its head, or why they could not be read. */
export type LandedReceiptRead = { ok: true; receipt: AnalyzeReceipt | null; prHead: string } | { ok: false; cause: string };

/** The reads and git operations the derivation depends on, injected so a spec can stand in for them. */
export interface CloseRangesDeps {
    readClaims(story: number): StoryMergedPrsRead;
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
    /** Per live story, the landed check of each merged pull request claiming it. */
    landed: StoryLanded[];
    blocking: CloseRangeBlock[];
    excluded: number[];
    /** True when nothing blocks. */
    ok: boolean;
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

    // 1. The claiming read for every story, each read even after one fails (D1).
    const claims = new Map<number, StoryMergedPr[]>();
    const failures: StoryReadFailure[] = [];
    for (const story of live) {
        const read = deps.readClaims(story);
        if (read.ok) claims.set(story, [...read.result.prs].sort(mergeOrder));
        else failures.push(read.failure);
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

    // 4. The landed check of each pull request, once however many stories it implements (D4).
    const checks = new Map<string, PrLandedCheck>();
    for (const pr of ordered) {
        const checked = landedCheckOf(deps, pr, outcomes.get(prKey(pr)) as Outcome);
        checks.set(prKey(pr), checked.check);
        if (checked.block !== undefined) blocking.push(checked.block);
    }
    const landed: StoryLanded[] = live.map((story) => {
        const prs = (claims.get(story) ?? []).map((pr) => checks.get(prKey(pr)) as PrLandedCheck);
        const result = prs.length === 0 ? "not-checked" : SEVERITY.find((r) => prs.some((p) => p.result === r)) ?? "unchanged";
        return { story, result, prs };
    });

    return {
        ok: true,
        ranges: { stories, range, landed, blocking, excluded, ok: blocking.length === 0, lines: renderLines(stories, landed, blocking, input.issuesRepo) },
    };
}

function landedCheckOf(deps: CloseRangesDeps, pr: StoryMergedPr, o: Outcome): { check: PrLandedCheck; block?: CloseRangeBlock } {
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
    const read = deps.readReceipt(pr);
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

function renderLines(stories: readonly StoryRanges[], landed: readonly StoryLanded[], blocking: readonly CloseRangeBlock[], issuesRepo: string | undefined): string[] {
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
 */
export function closeRangesDeps(run: Runner, root: string, issuesRepo: string): CloseRangesDeps {
    const slash = issuesRepo.lastIndexOf("/");
    const owner = issuesRepo.slice(0, slash).split("/").pop() ?? "";
    const slug: RepoSlug = { owner, repo: issuesRepo.slice(slash + 1) };
    return {
        readClaims: (story) => resolveStoryMergedPrs(run, root, slug, story),
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
    };
}
