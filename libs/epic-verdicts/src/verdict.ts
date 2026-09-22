/**
 * Resolve one story's chosen verdict from its candidate pull requests (decision record #495's
 * trust and recency rules, applied per story — decision record #505, key decision "Collection,
 * trust, recency and currency are one program").
 *
 * A candidate survives only by carrying a `<!-- nexus:analyze-receipt -->` block that stamps the
 * target epic, names this story, and is scoped to the repository actually queried — the same repo
 * scoping record #495 fixed for a single pull request's verdict (invariant 13 of record #505).
 * A candidate pull request that is closed and unmerged is dropped outright, never merely
 * deprioritized: a closed-unmerged PR's code never shipped. Recency is GitHub's own submission
 * timestamp (`submittedAt` / `createdAt`), never a date written in the block body, so the newest
 * survivor across every candidate — not just within one PR — wins.
 *
 * A verdict's story numbers are bare, so the repository they resolve against is a trust check too
 * (epic #751): a candidate whose verdict belongs to another repository's issues is dropped with the
 * rest, before newest-wins, and named on the way out.
 */

import { type AnalyzeReceipt, effectiveIssuesRepo, issuesRepoMatches, parseReceiptBlock } from "@nexus/pr-acceptance/verify";
import { collectReceiptBlocks, newestReceiptBlock } from "@nexus/pr-acceptance/receipt-blocks";
import { type RepoSlug } from "@nexus/epic-resolve/gh";
import { issueRefsMatch, sameRepo } from "@nexus/workspace/issue-ref";
import { type EpicVerdictsDiagnostic } from "./diagnostic.js";
import { type Runner } from "./run.js";

export interface StoryVerdict {
    story: number;
    pr: number;
    repo: string;
    state: "OPEN" | "MERGED";
    head: string;
    base: string;
    receipt: AnalyzeReceipt;
}

/**
 * A candidate pull request whose published verdict was dropped because its bare story numbers
 * resolve against another repository's issues (epic #751, invariant 9). Reported rather than
 * silently discarded, so a story that carries no verdict is never indistinguishable from a story
 * whose verdict was rejected.
 */
export interface RejectedCandidate {
    pr: number;
    /** The code repository the candidate lives in. */
    repo: string;
    /** The issues repository the dropped verdict's story numbers resolve against. */
    issuesRepo: string;
}

export type ResolveStoryVerdictResult =
    | { ok: true; found: true; verdict: StoryVerdict; survivors: StoryVerdict[]; rejected: RejectedCandidate[] }
    | { ok: true; found: false; candidates: number[]; rejected: RejectedCandidate[] }
    | { ok: false; error: EpicVerdictsDiagnostic };

/**
 * One candidate pull request, self-describing its own repository and checkout — never a single
 * repo/cwd shared across every candidate, so a story's pull request may live in any repository the
 * workspace declares (decision record #505, invariants 6, 9, 11).
 */
export interface StoryPrCandidate {
    pr: number;
    repo: RepoSlug;
    /** The checkout of `repo` to run `gh`/git against — never another repository's checkout. */
    cwd: string;
}

export interface ResolveStoryVerdictInput {
    epic: number;
    story: number;
    candidates: StoryPrCandidate[];
    /**
     * The repository this story's number belongs to. A verdict whose own effective issues
     * repository differs is another repository's verdict and is dropped (epic #751). Null is an
     * unknown, and an unknown accepts — a single-repo checkout has no second repository for a
     * number to collide in.
     */
    issuesRepo?: string | null;
}

/**
 * Resolve `story`'s chosen verdict from `input.candidates`, applying trust and recency.
 *
 * `survivors` carries every candidate that passed the trust checks and is open-or-merged —
 * not just the newest one — so a caller building the epic's combined change set can still reach
 * a superseded pull request's shipped diff (invariant 3 of decision record #505: the combined set
 * is the union of every open-or-merged trusted verdict, including one superseded by a later
 * verdict for the same story after its code already shipped).
 */
export function resolveStoryVerdict(run: Runner, input: ResolveStoryVerdictInput): ResolveStoryVerdictResult {
    // One verdict per candidate pull request — a PR may carry more than one matching review or
    // comment over time (repeated analyze runs), so only its own latest represents it.
    const perCandidate = new Map<string, { at: string; verdict: StoryVerdict }>();
    const rejected: RejectedCandidate[] = [];

    for (const candidate of input.candidates) {
        const expectedRepo = `${candidate.repo.owner}/${candidate.repo.repo}`.toLowerCase();
        const r = run("gh", ["pr", "view", String(candidate.pr), "--json", "state,headRefOid,baseRefOid,reviews,comments"], {
            cwd: candidate.cwd,
        });
        if (r.status !== 0) continue; // an unfetchable candidate is simply not a survivor

        let doc: Record<string, unknown>;
        try {
            const parsed: unknown = JSON.parse(r.stdout);
            if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) continue;
            doc = parsed as Record<string, unknown>;
        } catch {
            continue;
        }

        const state = String(doc["state"] ?? "").toUpperCase();
        if (state !== "OPEN" && state !== "MERGED") continue; // closed-unmerged never survives

        // Trust first, recency second (invariant 10 of decision record #750): an untrusted block
        // can never shadow a trusted, older one.
        const trusted = collectReceiptBlocks(doc).filter((found) => {
            const receipt = parseReceiptBlock(found.body);
            if (receipt === null) return false;
            // Accepts both the bare and the fully-qualified provenance form (concept
            //  "Provenance Reference"), so a receipt an analyze run wrote against a
            //  qualified epic reference is not silently dropped here.
            if (!issueRefsMatch(receipt.epic, `#${input.epic}`)) return false;
            if (!receipt.stories.includes(input.story)) return false;
            // Repository identity goes through the one shared rule, never string equality: the
            // gate stamps the host-qualified form and this reader knows the bare one, and the two
            // name the same repository (epic #747). A stamp naming a different repository, in
            // either form, still fails here.
            if (receipt.repo !== null && !sameRepo(receipt.repo, expectedRepo)) return false;
            // The story numbers a verdict carries are bare, so they mean nothing until the
            // repository they resolve against is known (epic #751). A verdict stating another
            // repository's issues is dropped here — with the other trust checks, before newest-wins
            // — and named, so this story is not silently reported as carrying no verdict at all. A
            // verdict stating none is accepted: its stamp names its code, not its issues.
            if (!issuesRepoMatches(receipt, input.issuesRepo ?? null)) {
                rejected.push({ pr: candidate.pr, repo: expectedRepo, issuesRepo: effectiveIssuesRepo(receipt) ?? "" });
                return false;
            }
            return true;
        });

        // Newest matching receipt per candidate pull request, by the same shared ordering step the
        // single-pull-request reader uses, so the two cannot rank one payload differently.
        const newest = newestReceiptBlock(trusted);
        if (newest === null) continue;
        const receipt = parseReceiptBlock(newest.body);
        if (receipt === null) continue;
        perCandidate.set(`${expectedRepo}#${candidate.pr}`, {
            at: newest.at,
            verdict: {
                story: input.story,
                pr: candidate.pr,
                repo: expectedRepo,
                state: state as "OPEN" | "MERGED",
                head: receipt.head,
                base: typeof doc["baseRefOid"] === "string" ? doc["baseRefOid"] : "",
                receipt,
            },
        });
    }

    if (perCandidate.size === 0) return { ok: true, found: false, candidates: input.candidates.map((c) => c.pr), rejected };

    let best: { at: string; verdict: StoryVerdict } | null = null;
    for (const entry of perCandidate.values()) {
        if (best === null || entry.at.localeCompare(best.at) > 0) best = entry;
    }

    return { ok: true, found: true, verdict: best!.verdict, survivors: [...perCandidate.values()].map((e) => e.verdict), rejected };
}
