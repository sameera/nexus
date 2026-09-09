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
 */

import { type AnalyzeReceipt, RECEIPT_MARKER, parseReceiptBlock } from "@nexus/pr-acceptance/verify";
import { type RepoSlug } from "@nexus/epic-resolve/gh";
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

export type ResolveStoryVerdictResult =
    | { ok: true; found: true; verdict: StoryVerdict }
    | { ok: true; found: false; candidates: number[] }
    | { ok: false; error: EpicVerdictsDiagnostic };

interface Timestamped {
    body: string;
    at: string;
}

function collect(doc: Record<string, unknown>): Timestamped[] {
    const out: Timestamped[] = [];
    const push = (arr: unknown, timeKey: string): void => {
        if (!Array.isArray(arr)) return;
        for (const item of arr) {
            if (item === null || typeof item !== "object") continue;
            const rec = item as Record<string, unknown>;
            const body = typeof rec["body"] === "string" ? rec["body"] : "";
            if (!body.includes(RECEIPT_MARKER)) continue;
            out.push({ body, at: typeof rec[timeKey] === "string" ? rec[timeKey] : "" });
        }
    };
    push(doc["reviews"], "submittedAt");
    push(doc["comments"], "createdAt");
    return out;
}

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
}

/** Resolve `story`'s chosen verdict from `input.candidates`, applying trust and recency. */
export function resolveStoryVerdict(run: Runner, input: ResolveStoryVerdictInput): ResolveStoryVerdictResult {
    const epicRef = `#${input.epic}`;

    let best: { at: string; verdict: StoryVerdict } | null = null;

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

        for (const found of collect(doc)) {
            const receipt = parseReceiptBlock(found.body);
            if (receipt === null) continue;
            if (receipt.epic !== epicRef) continue;
            if (!receipt.stories.includes(input.story)) continue;
            if (receipt.repo !== null && receipt.repo.toLowerCase() !== expectedRepo) continue;

            if (best === null || found.at.localeCompare(best.at) > 0) {
                best = {
                    at: found.at,
                    verdict: {
                        story: input.story,
                        pr: candidate.pr,
                        repo: expectedRepo,
                        state: state as "OPEN" | "MERGED",
                        head: receipt.head,
                        base: typeof doc["baseRefOid"] === "string" ? doc["baseRefOid"] : "",
                        receipt,
                    },
                };
            }
        }
    }

    if (best === null) return { ok: true, found: false, candidates: input.candidates.map((c) => c.pr) };
    return { ok: true, found: true, verdict: best.verdict };
}
