/**
 * Whether a pull request completes its epic, and what the epic-level judgment on it may read
 * (epic #829, story #859, decision record #871, D9–D11).
 *
 * The success metrics and the guarantees that span stories are properties of the finished
 * capability, so analyze judges them only on the pull request that completes the epic, before the
 * epic's last merge (D9). A pull request completes its epic when it covers every live story, or
 * when every other live story has a merged claiming pull request and no open one. Stories carrying
 * the storyless marker are left out of both tests. The answer comes from #849 D7's claiming read,
 * the one close gates on, so analyze and close cannot disagree about what shipped. A failed read
 * stops the run: treated as "not last", it would skip the epic judgment silently (G34).
 *
 * The judgment reads the pull request's head, which must already contain every merged sibling
 * (D10). A sibling in the same repository needs its merge commit reachable from the head; a sibling
 * in another member needs its merge commit on that member checkout's trunk. When either fails, the
 * epic-level check is not run, and each failure names the update that lets it run (G33). The
 * reading scope is this pull request's own change plus each merged sibling's landed files, from
 * the sibling's range in the checkout it merged in (#849 D2).
 *
 * Addressed by epic number, analyze combines nothing once any live story has merged: it is told
 * which pull request to analyze instead (D11, G35).
 */

import { type RepoCheckoutResult } from "@nexus/pr-worktree/repo-checkout";
import { parseRepoIdentity, sameRepo } from "@nexus/workspace/issue-ref";
import { closeRangesDeps, type DeriveOutcome, type TrunkOutcome } from "./close-ranges.js";
import { type Runner, git } from "./run.js";
import { type StoryClaimingPr, type StoryClaimsRead, type StoryMergedPr, type StoryReadFailure } from "./story-prs.js";

/** Whether the analyzed head contains a commit, or why that could not be read. */
export type InHeadOutcome = { ok: true; contained: boolean } | { ok: false; message: string };

/** The reads and git operations the completion check depends on, injected so a spec can stand in for them. */
export interface EpicCompletionDeps {
    /** The one claiming read: every claiming pull request, merged, open or closed unmerged. */
    readClaims(story: number): StoryClaimsRead;
    /** Where the checkout of `repo` is. Only looks: never clones, fetches or creates anything. */
    checkoutFor(repo: string): RepoCheckoutResult;
    /** Whether the analyzed head, in the pull request's worktree, contains `sha`. Never fetches. */
    inHead(sha: string): InHeadOutcome;
    /** Whether `checkout` holds `sha` as a commit. Never fetches. */
    hasCommit(checkout: string, sha: string): boolean;
    /** Whether trunk reaches `sha`, which `checkout` holds. Never fetches trunk. */
    onTrunk(checkout: string, sha: string): TrunkOutcome;
    /** The command that brings `checkout` up to date, named in a not-run finding. */
    fetchCommand(checkout: string): string;
    /** The one merge-anchored derivation, run in `checkout`. */
    derive(checkout: string, pr: StoryMergedPr): DeriveOutcome;
    /** The files `base...head` changes in `checkout`, pipeline stores withheld, or null when unreadable. */
    changedFiles(checkout: string, base: string, head: string): string[] | null;
}

export interface EpicCompletionInput {
    /** Every story of the epic. */
    stories: readonly number[];
    /** The stories carrying the storyless marker. */
    excluded: readonly number[];
    /** The analyzed pull request, in the repository it lives in. */
    pr: { repo: string; pr: number };
    /** The stories the pull request resolved to. */
    covered: readonly number[];
    /** The pull request's worktree, checked out at the analyzed head. */
    worktree: string;
    /** The repository story numbers resolve against, used to qualify them in `lines`. */
    issuesRepo?: string;
}

/** Another live story that keeps the pull request from completing its epic. */
export interface UnshippedStory {
    story: number;
    /** Its open claiming pull requests; empty when nothing merged claims it either. */
    open: Array<{ repo: string; pr: number }>;
}

/** A merged pull request of the epic other than the analyzed one. */
export interface MergedSibling {
    repo: string;
    pr: number;
    stories: number[];
    mergeCommit: string | null;
    /** Whether the code the judgment reads already contains this sibling. */
    contained: boolean;
    /** The files its range landed — its part of the reading scope — or null with the cause. */
    files: string[] | null;
    filesCause?: string;
}

/** A merged sibling the analyzed code does not contain, with the update that lets the check run. */
export interface NotRunCause {
    repo: string;
    pr: number;
    stories: number[];
    reason: string;
    remedy: string;
}

export interface EpicCompletion {
    completes: boolean;
    /** How the pull request completes the epic, or null when it does not. */
    basis: "covers-every-story" | "last" | null;
    /** `judge` the success metrics and cross-story guarantees; `not-run` names a high finding; `skip` judges none. */
    epicLevel: "judge" | "not-run" | "skip";
    live: number[];
    excluded: number[];
    unshipped: UnshippedStory[];
    siblings: MergedSibling[];
    notRun: NotRunCause[];
    /** What analyze repeats. */
    lines: string[];
}

export type EpicCompletionResult = { ok: true; completion: EpicCompletion } | { ok: false; problem: "story-read-failed"; failures: StoryReadFailure[] };

export type EpicPrTarget =
    /** No live story has a merged claiming pull request: the ordinary local check runs. */
    | { state: "local"; lines: string[] }
    /** A story has merged: nothing is combined, and the pull request to analyze is named (null when none completes the epic yet). */
    | {
          state: "redirect";
          target: { repo: string; pr: number; why: "open-completing" | "most-recent-merged" } | null;
          open: Array<{ repo: string; pr: number; stories: number[] }>;
          lines: string[];
      };

export type EpicPrTargetResult = { ok: true; target: EpicPrTarget } | { ok: false; failures: StoryReadFailure[] };

/**
 * One pull request's identity, with the repository's host left out: `nexus pr-worktree open` writes
 * the analyzed repository host-qualified, and the claiming read writes `owner/name`, so comparing
 * raw strings would never recognize the analyzed pull request as itself (G30). This is the
 * comparison `sameRepo` makes.
 */
function key(p: { repo: string; pr: number }): string {
    const id = parseRepoIdentity(p.repo);
    return `${id === null ? p.repo.toLowerCase() : `${id.owner}/${id.name}`}#${p.pr}`;
}

function refOf(story: number, issuesRepo: string | undefined): string {
    return issuesRepo ? `${issuesRepo}#${story}` : `#${story}`;
}

type ClaimsRead = { ok: true; live: number[]; excluded: number[]; claims: Map<number, StoryClaimingPr[]> } | { ok: false; failures: StoryReadFailure[] };

/** The claiming read for every live story, each read even after one fails, so one run names every unreadable story. */
function readLiveClaims(deps: Pick<EpicCompletionDeps, "readClaims">, stories: readonly number[], excludedIn: readonly number[]): ClaimsRead {
    const excluded = [...excludedIn].sort((a, b) => a - b);
    const live = [...stories].filter((s) => !excluded.includes(s)).sort((a, b) => a - b);
    const claims = new Map<number, StoryClaimingPr[]>();
    const failures: StoryReadFailure[] = [];
    for (const story of live) {
        const read = deps.readClaims(story);
        if (read.ok) claims.set(story, read.result.prs);
        else failures.push(read.failure);
    }
    return failures.length > 0 ? { ok: false, failures } : { ok: true, live, excluded, claims };
}

/**
 * The live stories, other than `covered`, that keep a pull request from being the last one: each
 * has no merged claiming pull request, or still has an open one (D9). `self` is never counted as
 * an open claim against itself.
 */
function unshippedOthers(live: readonly number[], covered: ReadonlySet<number>, claims: ReadonlyMap<number, StoryClaimingPr[]>, self: string | null): UnshippedStory[] {
    const out: UnshippedStory[] = [];
    for (const story of live) {
        if (covered.has(story)) continue;
        const prs = (claims.get(story) ?? []).filter((p) => key(p) !== self);
        const openPrs = prs.filter((p) => p.state === "open").map((p) => ({ repo: p.repo, pr: p.pr }));
        if (openPrs.length > 0 || !prs.some((p) => p.state === "merged")) out.push({ story, open: openPrs });
    }
    return out;
}

/** Whether the pull request `pr`, resolved to `covered`, completes its epic (D9). */
export function epicCompletion(deps: EpicCompletionDeps, input: EpicCompletionInput): EpicCompletionResult {
    const read = readLiveClaims(deps, input.stories, input.excluded);
    if (!read.ok) return { ok: false, problem: "story-read-failed", failures: read.failures };
    const { live, excluded, claims } = read;
    const self = key(input.pr);
    const covered = new Set(input.covered);

    const unshipped = unshippedOthers(live, covered, claims, self);
    const coversAll = live.every((s) => covered.has(s));
    const completes = unshipped.length === 0;
    const basis = !completes ? null : coversAll ? "covers-every-story" : "last";

    // Every merged pull request of a live story but this one, once however many stories it claims,
    // in platform merge order.
    const byPr = new Map<string, { pr: StoryMergedPr; stories: number[] }>();
    for (const story of live) {
        for (const p of claims.get(story) ?? []) {
            if (p.state !== "merged" || key(p) === self) continue;
            const entry = byPr.get(key(p));
            if (entry !== undefined) entry.stories.push(story);
            else byPr.set(key(p), { pr: { story, pr: p.pr, repo: p.repo, mergeCommit: p.mergeCommit, mergedAt: p.mergedAt, edge: p.edge }, stories: [story] });
        }
    }
    const merged = [...byPr.values()].sort(
        (a, b) => a.pr.mergedAt.localeCompare(b.pr.mergedAt) || a.pr.repo.localeCompare(b.pr.repo) || a.pr.pr - b.pr.pr,
    );

    const siblings: MergedSibling[] = [];
    const notRun: NotRunCause[] = [];
    if (completes) {
        for (const { pr, stories } of merged) {
            const placed = place(deps, input, pr);
            const sibling: MergedSibling = { repo: pr.repo, pr: pr.pr, stories, mergeCommit: pr.mergeCommit, contained: placed.ok, files: null };
            if (placed.ok) {
                const derived = deps.derive(placed.checkout, pr);
                if (!derived.ok) sibling.filesCause = derived.message;
                else {
                    sibling.files = deps.changedFiles(placed.checkout, derived.base, derived.head);
                    if (sibling.files === null) sibling.filesCause = `the change ${derived.base}...${derived.head} could not be read in ${placed.checkout}`;
                }
            } else notRun.push({ repo: pr.repo, pr: pr.pr, stories, reason: placed.reason, remedy: placed.remedy });
            siblings.push(sibling);
        }
    } else {
        for (const { pr, stories } of merged) siblings.push({ repo: pr.repo, pr: pr.pr, stories, mergeCommit: pr.mergeCommit, contained: false, files: null });
    }

    const epicLevel = !completes ? "skip" : notRun.length > 0 ? "not-run" : "judge";
    return {
        ok: true,
        completion: {
            completes,
            basis,
            epicLevel,
            live,
            excluded,
            unshipped,
            siblings,
            notRun,
            lines: renderCompletion(input, { completes, basis, epicLevel, unshipped, siblings, notRun }),
        },
    };
}

type Placement = { ok: true; checkout: string } | { ok: false; reason: string; remedy: string };

/** Where a merged sibling's change is read from, or why the analyzed code does not contain it (D10). */
function place(deps: EpicCompletionDeps, input: EpicCompletionInput, pr: StoryMergedPr): Placement {
    const prRef = `${input.pr.repo}#${input.pr.pr}`;
    const again = `then run /nxs.analyze --pr ${prRef} again`;
    if (pr.mergeCommit === null) {
        return { ok: false, reason: "the platform reports no merge commit for it", remedy: `re-run once the platform reports its merge commit` };
    }
    if (sameRepo(pr.repo, input.pr.repo)) {
        const inHead = deps.inHead(pr.mergeCommit);
        if (!inHead.ok) return { ok: false, reason: inHead.message, remedy: `re-run once the head can be read` };
        if (inHead.contained) return { ok: true, checkout: input.worktree };
        return {
            ok: false,
            reason: `its merge commit ${pr.mergeCommit} is not in the analyzed head`,
            remedy: `bring the pull request's branch up to date with trunk (merge or rebase trunk into it and push), ${again}`,
        };
    }
    const found = deps.checkoutFor(pr.repo);
    if (!found.ok) {
        const where = found.expectedPath !== undefined ? ` at ${found.expectedPath}` : "";
        return { ok: false, reason: `${pr.repo} has no checkout: ${found.error.message}`, remedy: `check out ${pr.repo}${where}, ${again}` };
    }
    if (!deps.hasCommit(found.checkout, pr.mergeCommit)) {
        return {
            ok: false,
            reason: `the ${pr.repo} checkout ${found.checkout} does not hold its merge commit ${pr.mergeCommit}`,
            remedy: `run '${deps.fetchCommand(found.checkout)}', ${again}`,
        };
    }
    const trunk = deps.onTrunk(found.checkout, pr.mergeCommit);
    if (!trunk.ok) return { ok: false, reason: trunk.message, remedy: `re-run once trunk can be read in ${found.checkout}` };
    if (!trunk.onTrunk) {
        return {
            ok: false,
            reason: `trunk ${trunk.trunkRef} in ${found.checkout} does not reach its merge commit ${pr.mergeCommit}`,
            remedy: `bring ${trunk.trunkRef} in ${found.checkout} up to date with '${deps.fetchCommand(found.checkout)}', ${again}`,
        };
    }
    return { ok: true, checkout: found.checkout };
}

function renderCompletion(
    input: EpicCompletionInput,
    c: Pick<EpicCompletion, "completes" | "basis" | "epicLevel" | "unshipped" | "siblings" | "notRun">,
): string[] {
    const ref = (s: number) => refOf(s, input.issuesRepo);
    const lines: string[] = [];
    if (!c.completes) {
        const why = c.unshipped.map((u) =>
            u.open.length > 0 ? `${ref(u.story)} has open pull request ${u.open.map((o) => `${o.repo}#${o.pr}`).join(", ")}` : `${ref(u.story)} has no merged pull request`,
        );
        lines.push(`Does not complete the epic: ${why.join("; ")}. No success metric is judged on this pull request.`);
        return lines;
    }
    lines.push(
        c.basis === "covers-every-story"
            ? "Completes the epic: it covers every live story."
            : `Completes the epic: every other live story has merged (${c.siblings.map((s) => `${s.repo}#${s.pr}`).join(", ")}).`,
    );
    for (const n of c.notRun) {
        lines.push(`Epic-level check not run: ${n.repo}#${n.pr} (${n.stories.map(ref).join(", ")}) — ${n.reason}. Remedy: ${n.remedy}.`);
    }
    if (c.epicLevel === "judge") {
        for (const s of c.siblings) {
            lines.push(
                s.files === null
                    ? `Reading scope: ${s.repo}#${s.pr} — its landed files could not be listed: ${s.filesCause ?? "unknown cause"}.`
                    : `Reading scope: ${s.repo}#${s.pr} landed ${s.files.length} file${s.files.length === 1 ? "" : "s"}.`,
            );
        }
    }
    return lines;
}

/**
 * Where analyze addressed by epic number goes (D11). Once any live story has a merged claiming pull
 * request, it combines nothing and names `/nxs.analyze --pr` on the open pull request that
 * completes the epic or, when every live story has merged, the most recently merged one.
 */
export function epicPrTarget(
    deps: Pick<EpicCompletionDeps, "readClaims">,
    input: { stories: readonly number[]; excluded: readonly number[]; issuesRepo?: string },
): EpicPrTargetResult {
    const read = readLiveClaims(deps, input.stories, input.excluded);
    if (!read.ok) return { ok: false, failures: read.failures };
    const { live, claims } = read;
    const all = live.flatMap((s) => claims.get(s) ?? []);
    if (!all.some((p) => p.state === "merged")) {
        return { ok: true, target: { state: "local", lines: ["No live story has a merged pull request: the local check runs."] } };
    }

    // Each open pull request with the live stories it claims, in repository and number order.
    const openPrs = new Map<string, { repo: string; pr: number; stories: number[] }>();
    for (const story of live) {
        for (const p of claims.get(story) ?? []) {
            if (p.state !== "open") continue;
            const entry = openPrs.get(key(p)) ?? { repo: p.repo, pr: p.pr, stories: [] };
            entry.stories.push(story);
            openPrs.set(key(p), entry);
        }
    }
    const open = [...openPrs.values()].sort((a, b) => a.repo.localeCompare(b.repo) || a.pr - b.pr);

    const completing = open.find((o) => unshippedOthers(live, new Set(o.stories), claims, key(o)).length === 0);
    const name = (t: { repo: string; pr: number }) => `/nxs.analyze --pr ${t.repo}#${t.pr}`;
    const lead = "A story of this epic has already merged, so analyze combines nothing by epic number.";
    if (completing !== undefined) {
        const target = { repo: completing.repo, pr: completing.pr, why: "open-completing" as const };
        return { ok: true, target: { state: "redirect", target, open, lines: [lead, `Run ${name(target)}: it is the open pull request that completes the epic.`] } };
    }
    if (unshippedOthers(live, new Set(), claims, null).length === 0) {
        const latest = all.filter((p) => p.state === "merged").sort((a, b) => b.mergedAt.localeCompare(a.mergedAt) || b.repo.localeCompare(a.repo) || b.pr - a.pr)[0];
        const target = { repo: latest.repo, pr: latest.pr, why: "most-recent-merged" as const };
        return { ok: true, target: { state: "redirect", target, open, lines: [lead, `Run ${name(target)}: every live story has merged, and it merged last.`] } };
    }
    const unshipped = unshippedOthers(live, new Set(), claims, null).map((u) => refOf(u.story, input.issuesRepo));
    const lines = [
        lead,
        `No open pull request completes the epic yet, and ${unshipped.join(", ")} ${unshipped.length === 1 ? "has" : "have"} not merged.`,
        open.length > 0
            ? `Run /nxs.analyze --pr on the pull request that completes the epic once it is open. Open now: ${open.map((o) => `${o.repo}#${o.pr}`).join(", ")}.`
            : "Run /nxs.analyze --pr on the pull request that completes the epic once it is open.",
    ];
    return { ok: true, target: { state: "redirect", target: null, open, lines } };
}

/**
 * The platform-backed reads: close's own claiming read, checkout lookup, derivation and trunk
 * check, unchanged, plus the two reads only analyze makes — whether the analyzed head contains a
 * commit, and which files a range changed.
 *
 * `excludePathspecs` withholds the pipeline stores: the caller passes the toolkit's one exclusion
 * set rather than this module stating its own copy of the store list.
 */
export function epicCompletionDeps(run: Runner, root: string, issuesRepo: string, worktree: string, excludePathspecs: readonly string[]): EpicCompletionDeps {
    const close = closeRangesDeps(run, root, issuesRepo);
    return {
        readClaims: close.readClaims,
        checkoutFor: close.checkoutFor,
        hasCommit: close.hasCommit,
        onTrunk: close.onTrunk,
        fetchCommand: close.fetchCommand,
        derive: close.derive,
        inHead(sha) {
            // A commit the worktree does not hold cannot be an ancestor of the head it checked out.
            if (!close.hasCommit(worktree, sha)) return { ok: true, contained: false };
            const anc = run("git", ["merge-base", "--is-ancestor", sha, "HEAD"], { cwd: worktree });
            if (anc.status === 0 || anc.status === 1) return { ok: true, contained: anc.status === 0 };
            return { ok: false, message: `git merge-base --is-ancestor ${sha} HEAD failed in ${worktree}: ${anc.stderr.trim()}` };
        },
        changedFiles(checkout, base, head) {
            const out = git(run, checkout, "diff", "--name-only", `${base}...${head}`, "--", ".", ...excludePathspecs);
            if (out === null) return null;
            return out
                .split("\n")
                .map((l) => l.trim())
                .filter((l) => l.length > 0)
                .sort();
        },
    };
}
