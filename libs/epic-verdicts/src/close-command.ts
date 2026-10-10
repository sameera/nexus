/**
 * `nexus close` — close as a plain command (epic #830, decision record #872).
 *
 * Close used to be a model-driven stage that asked the lead at a checkpoint. This command asks
 * nothing and runs no model (G1). It reads what earlier stages already decided and either passes
 * or stops. Every gate runs before anything is created (G3): a stop leaves no worktree, no file and
 * no GitHub write behind, so nothing needs cleaning up. Every stop is one block naming the reason,
 * the story, pull request, sub-issue or path concerned, and a remedy that can clear it (G4). A
 * waiver stop prints the exact comment to post (D3, D10).
 *
 * The order follows the record's Mechanism:
 *
 *   1. Resolve, read-only (story #864). The checkout's role (a member is refused, G44), the issues
 *      repository every issue read and write targets (G46), and the epic. The lead names the epic
 *      (#906), or names a pull request that close resolves to it: the pull request must have
 *      merged, and its epic comes from the pull request's story and that story's parent; an entry
 *      path given with either must link the same epic. No gate reads that pull request again. Either way
 *      the epic must be filed as one. A trusted close comment already on the epic means
 *      an earlier run finished everything it carries: close then only closes the issue, writes the
 *      hand-off note and reports (G27).
 *   2. Gate, read-only (#864, #866). Every sub-issue closed, with no exemption (G43). #849's
 *      evidence gate over every live story, which reads waivers only from trusted comments already
 *      on the pull request (G5, G6). A story with no claiming pull request passes only with its
 *      marker or a trusted storyless waiver on its own issue (D10). For each merged claiming pull
 *      request, a verdict with no open critical or high item (G7) and with a judgments block (G8).
 *   3. Assemble in memory (#865): Key Decisions, Deviation Rationale, the superseded decisions,
 *      the approved proposals and the `analyze:` value, from the verdicts, the record body close
 *      stamps and the gate's stamps only (G2). Before anything is created, the issues that mention
 *      the epic are read through the platform's back-references, never search, to find each stub
 *      an earlier run filed by its key (D9, G21).
 *   4. Worktree. The distill branch an earlier run cut for this epic, local or pushed, else a fresh
 *      one from the trunk; then the committed queue entry, or the entry born at close (G45).
 *
 * Then the writes, in D11's order (G23), each looking first for what an earlier run already did:
 *
 *   5. File each approved proposal not yet filed as one unplanned epic stub (G19, G20); write the
 *      marker on each story a storyless waiver cleared (G22).
 *   6. Write the close record with the stub numbers, commit it on the distill branch and push it.
 *      A failed push stops close before anything is posted, with the epic issue open (G24).
 *   7. Post the record amendment from the superseding marks. A failed post stops nothing (G48).
 *   8. Post the close comment. A failed post stops close with the epic issue open (G25).
 *   9. Close the epic issue (already closed is fine, G49), never a sub-issue (G43), then write the
 *      hand-off note — only now, on full success (G17) — and report.
 *
 * There is no checkpoint file: a re-run reads its progress from GitHub and git (G26).
 *
 * Every platform read and write is injected, so a spec stands in for GitHub and git.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { classifyIssueKind, resolveKindClassification, type IssueKind } from "@nexus/epic-resolve/classify";
import { fetchIssueFacts, fetchSubIssueFacts, type IssueFacts } from "@nexus/epic-resolve/gh";
import { renderDiagnostic as renderEpicResolveDiagnostic } from "@nexus/epic-resolve/render";
import { resolveEpic, type ResolveEpicResult } from "@nexus/epic-resolve/resolve";
import { parseJudgmentsBlock, type Judgments } from "@nexus/pr-acceptance/judgments-block";
import { verifyReceipt } from "@nexus/pr-acceptance/verify";
import { WAIVER_MARKER, matchStorylessWaiver, readStoryWaivers, storylessWaiverComment, type RejectedWaiver, type StorylessWaiverComment } from "@nexus/pr-acceptance/waiver";
import { parsePrReference, prRepoOnForge, type ParsedPrReference } from "@nexus/pr-worktree/member-target";
import { resolvePr, type PrInfo, type ResolvePrResult } from "@nexus/pr-worktree/pr";
import { resolveStories, type ResolveStoriesResult } from "@nexus/pr-worktree/story-candidates";
import { verifyTrunkContainsHeads, type TrunkCheckItem, type VerifyTrunkResult } from "@nexus/pr-worktree/trunk-check";
import { findEpicDistillBranch, openEpicDistillWorktree, pushEpicDistillBranch, type EpicDistillBranchResult, type EpicDistillWorktreeResult } from "@nexus/pr-worktree/worktree";
import { type FilerEnvironment } from "@nexus/delivery-config/story-filer/environment";
import { resolvePublishingKey } from "@nexus/delivery-config/resolve";
import { canonicalRemote, canonicalRepoRef } from "@nexus/workspace/canonical-remote";
import { closePreflight, type PreflightResult } from "@nexus/workspace/close-role";
import { parseIssueRef, sameRepo } from "@nexus/workspace/issue-ref";
import { defaultRunner, git } from "@nexus/workspace/run";
import { fetchRecord } from "@nexus/record-digest/fetch";
import {
    amendmentKey,
    findEpicCloseComment,
    trustedComment,
    assembleCloseContent,
    recordNumber,
    stampedPrs,
    proposalKey,
    renderCloseComment,
    renderCloseRecord,
    renderDeferredStub,
    renderRecordAmendment,
    stubKey,
    type ApprovedProposal,
    type CloseContent,
    type CloseVerdict,
} from "./close-record.js";
import { fileDeferredStubs, type FileStubsResult, type StubToFile } from "./close-stubs.js";
import { closeRangesDeps, deriveCloseRanges, type CloseRangeBlock, type CloseRanges, type CloseRangesResult, type StoryState, type StoryStateFinding } from "./close-ranges.js";
import { storyCarriesLabel, waiveStory } from "./exclusion.js";
import { fetchShippedRecords, type UntrustedRecord } from "./ledger.js";
import { type Runner } from "./run.js";
import { type ResolveVerdictReposResult, canonicalIssuesRepo, issuesRepoSlug, resolveVerdictRepos } from "./verdict-repos.js";

/**
 * What close closes (#906): the epic the lead named, or the epic of a pull request. A pull request
 * only finds the epic; the gate and the close record are built from the epic's stories.
 */
export type CloseTarget = { epic: number } | { pr: ParsedPrReference };

/** What the lead passed: the arguments `/nxs.close` takes (D1), plus today's date for the branch name. */
export interface CloseInput {
    /** The directory the command was run in. */
    cwd: string;
    target: CloseTarget;
    /** An `epic.md` path, absolute, or null when the target alone names the epic. */
    entryPath: string | null;
    /** Where the close-and-distill script wants its hand-off note, or null. */
    handoff: string | null;
    /** Today, as YYYY-MM-DD. */
    date: string;
    /** The release writing the close record, or null when unresolved (the stamp is then omitted). */
    nexusVersion?: string | null;
}

/** One stop: the reason, the thing concerned and the remedy that can clear it (G4). */
export interface CloseStop {
    reason: string;
    item: string;
    remedy: string;
    /** A waiver stop: the exact comment to post, and the pull request to post it on (D3). */
    post?: { on: string; comment: string };
}

/** The verdict a merged pull request carries, as far as close's gate reads it. */
export type CloseVerdictRead =
    | { ok: true; found: false }
    | { ok: true; found: true; critical: number; high: number; judgments: "absent" }
    | {
          ok: true;
          found: true;
          critical: number;
          high: number;
          judgments: "present";
          /** The judgments close writes from, and the verdict block facts its `analyze:` value names. */
          read: Judgments;
          date: string;
          head: string;
          recordHash: string | null;
      }
    | { ok: true; found: true; critical: number; high: number; judgments: "malformed"; malformed: string }
    | { ok: false; cause: string };

export type CloseRangesRead =
    | { ok: true; ranges: CloseRanges; untrusted: UntrustedRecord[] }
    | Extract<CloseRangesResult, { ok: false }>
    | { ok: false; problem: "records-unreadable"; message: string };

/** The reads and the one create step close depends on, injected so a spec can stand in for them. */
export interface CloseCommandDeps {
    /** The checkout's role, through close's own role gate. */
    role(cwd: string): PreflightResult;
    /** The pull request, merged or not, in the repository a qualified reference names; the gate words the not-merged stop itself. */
    readPr(repoRoot: string, ref: ParsedPrReference): ResolvePrResult;
    /** The issues repository every issue read and write targets. */
    issuesRepo(root: string): ResolveVerdictReposResult;
    /** The epic and the stories the pull request implements, through the validated candidate ladder; `prRepo` is the repository it lives in. */
    storiesOfPr(root: string, issuesRepo: string, pr: PrInfo, prRepo: string): ResolveStoriesResult;
    /** What an issue is filed as, and its parent: the check on an epic number the lead typed. */
    issueKind(root: string, issuesRepo: string, issue: number): { ok: true; exists: boolean; kind: IssueKind; parent: number | null } | { ok: false; message: string };
    /** The epic: its live stories, its decision record and the materialized `epic.md`. */
    resolveEpic(root: string, issuesRepo: string, epic: number): ResolveEpicResult;
    /** Every sub-issue of the epic, whatever its kind, with its state. */
    subIssues(root: string, issuesRepo: string, epic: number): { ok: true; facts: Map<number, IssueFacts> } | { ok: false; message: string };
    /** The stories carrying the no-pull-request marker. */
    excludedStories(root: string, issuesRepo: string, stories: readonly number[]): number[];
    /** #849's evidence gate: ranges, landed checks, story states and applied waivers. */
    ranges(root: string, issuesRepo: string, epic: number, input: { stories: number[]; excluded: number[]; record: number | null }): CloseRangesRead;
    /** The verdict a merged pull request carries. */
    verdict(root: string, issuesRepo: string, pr: { repo: string; pr: number }): CloseVerdictRead;
    /** Whether the trunk the distill branch is cut from holds every merged head in this repository. */
    trunkCheck(repoRoot: string, heads: TrunkCheckItem[]): VerifyTrunkResult;
    /** The distill branch an earlier close cut for the epic, local or pushed, read-only: creates nothing. */
    findDistillBranch(repoRoot: string, epic: number): EpicDistillBranchResult;
    /** The epic's distill worktree: the first step that creates anything. */
    openWorktree(repoRoot: string, epic: number, date: string): EpicDistillWorktreeResult;
    /** The decision record's current body and its digest, through the one digest implementation. */
    recordBody(root: string, issuesRepo: string, record: number): { ok: true; body: string; digest: string } | { ok: false; message: string };
    /** Stage `files` in the worktree and commit them; `committed` is false when nothing changed. */
    commitEntry(wtPath: string, files: string[], message: string): { ok: true; committed: boolean } | { ok: false; message: string };
    /** The comments on an issue, with each author's association, for find before write. */
    issueComments(root: string, issuesRepo: string, issue: number): { ok: true; comments: { body: string; authorAssociation: string }[] } | { ok: false; message: string };
    /** Post one comment on an issue. */
    postComment(root: string, issuesRepo: string, issue: number, body: string): { ok: true } | { ok: false; message: string };
    /** The storyless waiver comments on a story's own issue, trust read against the issues repository (D10). */
    storyWaivers(root: string, issuesRepo: string, story: number): { ok: true; comments: StorylessWaiverComment[] } | { ok: false; message: string };
    /** The issues that mention the epic, through the platform's back-references — never search (D9). */
    epicMentions(root: string, issuesRepo: string, epic: number): { ok: true; issues: MentioningIssue[] } | { ok: false; message: string };
    /** File approved proposals as unplanned epic stubs through the batch filer; numbers by each stub's key. */
    fileStubs(root: string, issuesRepo: string, epic: number, stubs: StubToFile[]): FileStubsResult;
    /** Write the no-pull-request marker on a story issue, through the existing marker writer. */
    writeMarker(root: string, issuesRepo: string, story: number): { ok: true } | { ok: false; message: string };
    /** Push the distill branch from its worktree. */
    push(wtPath: string, branch: string): { ok: true } | { ok: false; message: string };
    /** Close an issue as completed; `already` when it was closed before. */
    closeIssue(root: string, issuesRepo: string, issue: number): { ok: true; already: boolean } | { ok: false; message: string };
}

/** An issue whose body mentions the epic, as its back-reference reports it. */
export interface MentioningIssue {
    number: number;
    /** The repository it lives in. */
    repo: string;
    body: string;
    pullRequest: boolean;
    /** Whether its author can speak for its repository. */
    trusted: boolean;
}

export interface ClosePassed {
    ok: true;
    /** False: this run wrote the close; true: an earlier run's close comment was found (G27). */
    resumed: false;
    epic: number;
    issuesRepo: string;
    wtPath: string;
    branch: string;
    /** The close record written, committed and pushed in the worktree's queue entry. */
    recordPath: string;
    /** The close comment's body, as posted (or as an earlier run posted it). */
    closeComment: string;
    content: CloseContent;
    /** Each approved proposal's stub number, by {@link proposalKey}. */
    stubs: Map<string, number>;
    lines: string[];
}

/** A re-run after the close comment was posted: it closed the issue, wrote the note and reported. */
export interface CloseResumed {
    ok: true;
    resumed: true;
    epic: number;
    issuesRepo: string;
    wtPath: string;
    branch: string;
    lines: string[];
}

export type CloseOutcome = ClosePassed | CloseResumed | { ok: false; stops: CloseStop[]; done?: string[] };

const stopped = (...stops: CloseStop[]): CloseOutcome => ({ ok: false, stops });

/** A stop after some writes: `done` names each, so the lead sees what a re-run will not repeat. */
const stoppedAfter = (done: string[], ...stops: CloseStop[]): CloseOutcome => ({ ok: false, stops, done: [...done] });

/** A story waived by a storyless waiver comment on its own issue (D10). */
interface WaivedStory {
    story: number;
    /** The waiver comment's date, YYYY-MM-DD. */
    date: string;
    author: string;
    url: string;
    /** Whether the story already carries the marker, so close writes none. */
    marked: boolean;
}

/** The batch filer's ref for a proposal's stub: named for the proposal, never for its place in the batch. */
function stubRef(p: Pick<ApprovedProposal, "repo" | "pr" | "id">): string {
    return `STUB-${p.repo.replace(/[^A-Za-z0-9]+/g, "-")}-${p.pr}-${p.id}`;
}

/** The epic number an `epic.md`'s `link` names, or null. */
export function linkedEpic(markdown: string): number | null {
    return linkedEpicRef(markdown)?.number ?? null;
}

/** The issue an `epic.md`'s `link` names, with the repository it qualifies it with (null when bare), or null. */
function linkedEpicRef(markdown: string): { repo: string | null; number: number } | null {
    const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
    if (fm === null) return null;
    const line = /^link:\s*(.+?)\r?$/m.exec(fm[1]);
    if (line === null) return null;
    return parseIssueRef(line[1].trim().replace(/^["']|["']$/g, ""));
}

/** The arguments a re-run repeats: the target as the lead named it, then the entry path and `--handoff`. */
function closeArgs(target: CloseTarget, input: Pick<CloseInput, "entryPath" | "handoff">): string {
    const named = "epic" in target ? `--epic ${target.epic}` : `--pr ${shellWord(prReference(target.pr))}`;
    return [named, ...trailingArgs(input)].join(" ");
}

/** The entry path and `--handoff` a re-run repeats, whatever names the epic. */
function trailingArgs(input: Pick<CloseInput, "entryPath" | "handoff">): string[] {
    return [...(input.entryPath === null ? [] : [shellWord(input.entryPath)]), ...(input.handoff === null ? [] : ["--handoff", shellWord(input.handoff)])];
}

/** A path as one shell word, so a re-run hint copied as is passes it as one argument. */
function shellWord(value: string): string {
    return /^[\w./@%+=:,-]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`;
}

/** A parsed pull-request reference as `--pr` takes it back: `N`, `owner/repo#N`, or the URL it came from. */
function prReference(ref: ParsedPrReference): string {
    if (ref.repo === null) return `${ref.number}`;
    return ref.host === undefined ? `${ref.repo}#${ref.number}` : `https://${ref.host}/${ref.repo}/pull/${ref.number}`;
}

/** A parsed reference's repository with its host when it names one other than github.com, for display and matching. */
function hostedRepo(ref: ParsedPrReference | null): string | null {
    if (ref === null || ref.repo === null) return null;
    return ref.host === undefined || ref.host === "github.com" ? ref.repo : `${ref.host}/${ref.repo}`;
}

/** The merged pull requests an earlier close comment stamped, as a re-run reports them. */
function stampedList(block: Record<string, unknown>): string {
    const { prs, unnamed } = stampedPrs(block);
    if (unnamed === 0) return mergedList(prs);
    return `${prs.length === 0 ? "" : `${mergedList(prs)}, and `}${unnamed} stamped without its repository`;
}

/** The merged pull requests a close covers, as its report lists them. */
function mergedList(prs: readonly { repo: string; pr: number }[]): string {
    return prs.length === 0 ? "none" : `${prs.map((p) => `${p.repo}#${p.pr}`).join(", ")} (merged)`;
}

/** The epic an entry path's frontmatter links, or the stop that says why it names none. */
function entryLink(entryPath: string): { ok: true; epic: number; repo: string | null } | { ok: false; stop: CloseStop } {
    let markdown: string;
    try {
        markdown = fs.readFileSync(entryPath, "utf8");
    } catch (e) {
        return { ok: false, stop: { reason: `the entry path cannot be read: ${e instanceof Error ? e.message : String(e)}`, item: entryPath, remedy: "pass the epic's epic.md, or omit the path" } };
    }
    const linked = linkedEpicRef(markdown);
    if (linked === null) {
        return { ok: false, stop: { reason: "the entry path's frontmatter has no link naming the epic issue", item: entryPath, remedy: 'add link: "#<epic>" to its frontmatter, or omit the path' } };
    }
    return { ok: true, epic: linked.number, repo: linked.repo };
}

/** Run close through the close record and the amendment. Asks nothing; every outcome is returned. */
export function runCloseCommand(deps: CloseCommandDeps, input: CloseInput): CloseOutcome {
    // Until the epic is known a re-run repeats what the lead ran; from then on it names the epic.
    let rerun = `nexus close ${closeArgs(input.target, input)}`;

    // 1. Resolve, read-only.
    const role = deps.role(input.cwd);
    if (!role.ok) {
        return stopped({ reason: role.error.message, item: input.cwd, remedy: `run ${rerun} from inside a single-repo checkout or a workspace hub` });
    }
    const { repoRoot } = role.preflight;
    if (role.preflight.role === "member") {
        return stopped({
            reason: "this checkout is a member of a workspace; close runs only from a single-repo checkout or the hub",
            item: repoRoot,
            remedy: `run ${rerun} from the workspace hub`,
        });
    }

    const repos = deps.issuesRepo(repoRoot);
    if (!repos.ok) return stopped({ reason: repos.error.message, item: repoRoot, remedy: `fix the checkout's remote or the configured epic-repo, then re-run ${rerun}` });
    // One written form for every read, write, key and report that names the issues repository. An
    // earlier run may have keyed its stubs and amendment with the form as configured, so a lookup
    // tries that spelling too.
    const issuesRepo = canonicalIssuesRepo(repos.repos.issuesRepo);
    const spellings = [...new Set([issuesRepo, repos.repos.issuesRepo])];
    const codeRepo = repos.repos.repo;

    const entryRel = input.entryPath === null ? null : path.relative(repoRoot, path.resolve(input.entryPath));

    let epic: number;
    if ("epic" in input.target) {
        epic = input.target.epic;
    } else {
        // A pull request only finds the epic. One that has not merged is the cheap early answer for
        // a lead who ran close too soon.
        const ref = input.target.pr;
        const read = deps.readPr(repoRoot, ref);
        if (!read.ok) {
            const asked = ref.repo === null ? `pull request ${ref.number} of this checkout's repository` : `pull request ${hostedRepo(ref)}#${ref.number}`;
            return stopped({ reason: `${asked} could not be read: ${read.error.message}`, item: asked, remedy: `check the reference, then re-run ${rerun}` });
        }
        // The repository it was read in, which in a fork checkout can differ from the checkout's
        // default: the platform's URL for it says which.
        const pr = { repo: hostedRepo(parsePrReference(read.pr.url)) ?? hostedRepo(ref) ?? codeRepo, pr: ref.number };
        const label = `pull request ${pr.repo}#${pr.pr}`;
        if (!read.pr.merged) {
            return stopped({ reason: `${label} is not merged (it is ${read.pr.state.toLowerCase()}); close runs only after the merge`, item: label, remedy: `merge it, then re-run ${rerun}` });
        }
        // The story ladder finds the epic, and checks it is filed as one. A pull request it cannot
        // place is named by its epic instead: --epic replaces the old entry-path way through.
        const stories = deps.storiesOfPr(repoRoot, issuesRepo, read.pr, pr.repo);
        if (!stories.ok) {
            const ambiguous = stories.error.problem === "story-candidates-multiple-epics";
            return stopped({
                reason: ambiguous ? `${label} does not name one epic: ${stories.error.message}` : `the epic of ${label} cannot be resolved: ${stories.error.message}`,
                item: label,
                remedy: `name the epic instead: nexus close ${["--epic <N>", ...trailingArgs(input)].join(" ")}` + (ambiguous ? "" : `, or have the pull request close its story issue`),
            });
        }
        epic = stories.epic;
    }
    // After the target, so a pull request that has not merged is still the first answer.
    const link = input.entryPath === null ? null : entryLink(input.entryPath);
    if (link !== null && !link.ok) return stopped(link.stop);
    if (link !== null && (link.epic !== epic || (link.repo !== null && !sameRepo(link.repo, issuesRepo)))) {
        return stopped({
            reason: `the entry path's link names epic ${link.repo ?? issuesRepo}#${link.epic}, not epic ${issuesRepo}#${epic}, the one close ${"epic" in input.target ? "was given" : "found from the pull request"}`,
            item: input.entryPath ?? "",
            remedy: `pass the epic.md of epic ${issuesRepo}#${epic}, or omit the path`,
        });
    }
    rerun = `nexus close ${closeArgs({ epic }, input)}`;
    const epicRef = `${issuesRepo}#${epic}`;

    // Find before write: a trusted close comment on the epic is the durable copy an earlier run
    // posted, so that run finished every write before it. Regenerate nothing (G27).
    const epicComments = deps.issueComments(repoRoot, issuesRepo, epic);
    const commentsUnread = (why: string): CloseOutcome =>
        stopped({ reason: `the comments on epic ${epicRef} could not be read, so close cannot tell whether an earlier run already posted its close comment: ${why}`, item: `epic ${epicRef}`, remedy: `re-run ${rerun} once the read succeeds` });
    const earlier = epicComments.ok ? findEpicCloseComment(epicComments.comments, epic, issuesRepo) : ({ found: "none" } as const);
    const unreadableClose = (why: string): CloseOutcome =>
        stopped({
            reason: `epic ${epicRef} carries a close comment from someone who can speak for ${issuesRepo}, but ${why}, so close can neither finish that close nor tell that none happened`,
            item: `epic ${epicRef}`,
            remedy: `check that comment: correct its machine block if it is this epic's close, or remove its marker if it is a copy; then re-run ${rerun}`,
        });

    // A number the lead typed must be an epic, checked before anything, even the re-run shortcut,
    // can close it; the story ladder already checked the epic it found from a pull request.
    if ("epic" in input.target) {
        const kind = deps.issueKind(repoRoot, issuesRepo, epic);
        // With the comments unread, close cannot know of an earlier close that would excuse a lost
        // marking; that read failing is the stop, unless the number names no issue at all.
        if (!epicComments.ok && !(kind.ok && !kind.exists)) {
            return commentsUnread(epicComments.message);
        }
        if (!kind.ok) {
            return stopped({ reason: `what ${epicRef} is filed as could not be determined, so close cannot tell it is an epic: ${kind.message}`, item: `issue ${epicRef}`, remedy: `fix the cause above, then re-run ${rerun}` });
        }
        // Only an issue filed as an epic. This epic's own close comment excuses a marking lost since
        // (an epic relabelled after close), never an issue filed as a story or a record. An issue
        // that only lacks a marking, beside a close comment that does not read, is told about the
        // comment first: relabelling would not get it past that.
        const filedAsOther = kind.exists && (kind.kind === "story" || kind.kind === "record");
        if (!filedAsOther && earlier.found === "unreadable") return unreadableClose(earlier.why);
        if (!kind.exists || !(kind.kind === "epic" || (kind.kind === "other" && earlier.found === "own"))) {
            const is = !kind.exists ? "does not exist" : kind.kind === "story" || kind.kind === "record" ? `is filed as a ${kind.kind}, not an epic` : "is not filed as an epic";
            const parent = kind.parent === null ? "" : ` (its parent is ${issuesRepo}#${kind.parent})`;
            const prHint = !kind.exists ? `; if ${epic} is a pull request, run nexus close --pr ${epic}, or --pr ${shellWord(`owner/repo#${epic}`)} when it is in another repository` : "";
            const unmarked = kind.exists && kind.kind === "other" ? `; if ${epicRef} is an epic, file it as one (its epic label or issue type), then re-run ${rerun}` : "";
            return stopped({
                reason: `${epicRef} ${is}${parent}; close closes only an issue filed as an epic`,
                item: `issue ${epicRef}`,
                remedy: `pass the epic's own issue number: nexus close --epic <N>${prHint}${unmarked}`,
            });
        }
    }

    // After the kind check, so a number that names no issue (whose comments cannot be read either)
    // is told so, not told to retry a read.
    if (!epicComments.ok) {
        return commentsUnread(epicComments.message);
    }
    if (earlier.found === "unreadable") return unreadableClose(earlier.why);
    if (earlier.found === "own") {
        return finishClosed(deps, input, { repoRoot, issuesRepo, codeRepo, epic, rerun, spellings }, earlier.block);
    }

    const resolved = deps.resolveEpic(repoRoot, issuesRepo, epic);
    if (!resolved.ok) {
        return stopped({ reason: `epic ${epicRef} cannot be resolved: ${renderEpicResolveDiagnostic(resolved.error)}`, item: `epic ${epicRef}`, remedy: `re-run ${rerun} once the read succeeds` });
    }
    const stories = resolved.resolved.stories.map((s) => s.number);
    const record = resolved.record?.number ?? null;

    // 2. Gate, read-only. Every gate runs, so one pass names everything to fix.
    const stops: CloseStop[] = [];
    const notes: string[] = [];

    const subs = deps.subIssues(repoRoot, issuesRepo, epic);
    if (!subs.ok) {
        stops.push({ reason: `the sub-issues of epic ${epicRef} could not be read: ${subs.message}`, item: `epic ${epicRef}`, remedy: `re-run ${rerun} once the read succeeds` });
    } else {
        if (subs.facts.size === 0) notes.push(`Epic ${epicRef} has no sub-issues (a manually managed epic).`);
        for (const [n, f] of [...subs.facts.entries()].sort((a, b) => a[0] - b[0])) {
            if (f.state.toUpperCase() !== "OPEN") continue;
            const ref = `${issuesRepo}#${n}`;
            if (n === record) {
                stops.push({ reason: `sub-issue ${ref} [decision record] is open: the record is not approved`, item: ref, remedy: `approve the record by closing ${ref}, then re-run ${rerun}` });
            } else if (stories.includes(n)) {
                stops.push({ reason: `sub-issue ${ref} [story] is open`, item: ref, remedy: `close ${ref} once its work has shipped, then re-run ${rerun}; close never closes a sub-issue` });
            } else {
                stops.push({ reason: `sub-issue ${ref} [other] is open`, item: ref, remedy: `close ${ref} or detach it from epic ${epicRef}, then re-run ${rerun}` });
            }
        }
    }

    const excluded = deps.excludedStories(repoRoot, issuesRepo, stories);
    let ranges = deps.ranges(repoRoot, issuesRepo, epic, { stories, excluded, record });
    let gate: CloseRanges | null = null;
    const verdicts: CloseVerdict[] = [];
    const waived: WaivedStory[] = [];
    const storyless = new Map<number, RejectedWaiver[]>();
    if (ranges.ok) {
        // The storyless waiver (D10): a story no pull request claims passes on a trusted comment in
        // the fixed form on its own issue. A story that already carries the marker is read too, so
        // Waived Stories reads the same on a re-run after this run wrote the marker.
        const unclaimed = ranges.ranges.states.filter((s) => s.state === "unshipped" && s.findings.length === 0).map((s) => s.story);
        for (const story of [...new Set([...excluded, ...unclaimed])].sort((a, b) => a - b)) {
            const read = deps.storyWaivers(repoRoot, issuesRepo, story);
            const ref = `${issuesRepo}#${story}`;
            if (!read.ok) {
                stops.push({ reason: `the comments on story ${ref} could not be read, so its storyless waiver cannot be: ${read.message}. A failed read is not the same as no waiver`, item: `story ${ref}`, remedy: `re-run ${rerun} once the read succeeds` });
                continue;
            }
            const match = matchStorylessWaiver(read.comments, story, issuesRepo);
            if (match.applied !== null) {
                waived.push({ story, date: match.applied.at.slice(0, 10), author: match.applied.author, url: match.applied.url, marked: excluded.includes(story) });
            } else if (unclaimed.includes(story)) {
                storyless.set(story, match.rejected);
            }
        }
        // A waived story is excluded, exactly as it will be once its marker is written, so the
        // stamps this run writes are the stamps a re-run writes.
        const newly = waived.filter((w) => !w.marked).map((w) => w.story);
        if (newly.length > 0) ranges = deps.ranges(repoRoot, issuesRepo, epic, { stories, excluded: [...excluded, ...newly].sort((a, b) => a - b), record });
    }
    if (!ranges.ok) {
        stops.push(...rangesFailureStops(ranges, issuesRepo, rerun));
    } else {
        gate = ranges.ranges;
        for (const b of gate.blocking) stops.push(blockStop(b, rerun));
        for (const s of gate.states) stops.push(...storyStops(s, issuesRepo, record, rerun, storyless.get(s.story) ?? []));
        if (ranges.untrusted.length > 0) {
            notes.push(
                `Shipped records on epic ${epicRef} from authors who cannot speak for ${issuesRepo}, not read: ` +
                    ranges.untrusted.map((u) => `@${u.author || "unknown"} (${u.authorAssociation || "none"})`).join(", ") +
                    ".",
            );
        }

        // Each merged claiming pull request's verdict, read once however many stories it implements,
        // in merge order, a pull request with no range of its own in its place (D6).
        for (const entry of gate.merged) {
            const read = deps.verdict(repoRoot, issuesRepo, { repo: entry.repo, pr: entry.pr });
            stops.push(...verdictStops(read, entry.repo, entry.pr, rerun));
            if (read.ok && read.found && read.judgments === "present") {
                verdicts.push({ repo: entry.repo, pr: entry.pr, date: read.date, head: read.head, recordHash: read.recordHash, judgments: read.read });
            }
        }

        if (stops.length === 0) {
            const heads = gate.range.filter((r) => sameRepo(r.repo, codeRepo)).map((r) => ({ pr: r.pr, head: r.head }));
            const trunk = deps.trunkCheck(repoRoot, heads);
            if (!trunk.ok) stops.push({ reason: trunk.error.message, item: repoRoot, remedy: `bring the local trunk up to date, then re-run ${rerun}` });
        }
    }

    // The record body close stamps, read before anything is created: a failed read is a stop (G3).
    let recordSource: { number: number; body: string; digest: string } | null = null;
    if (stops.length === 0 && record !== null) {
        const body = deps.recordBody(repoRoot, issuesRepo, record);
        if (!body.ok) stops.push({ reason: `the decision record ${issuesRepo}#${record} could not be read: ${body.message}`, item: `record ${issuesRepo}#${record}`, remedy: `re-run ${rerun} once the read succeeds` });
        else recordSource = { number: record, body: body.body, digest: body.digest };
    }

    if (stops.length > 0) return { ok: false, stops };
    const passed = gate as CloseRanges;

    // 3. Assemble in memory, from the verdicts, the record body and the gate's stamps only (G2).
    const fm = frontmatter(resolved.markdown);
    const content = assembleCloseContent({
        epic,
        title: resolved.resolved.title,
        feature: fm.get("feature") ?? "",
        featurePath: fm.get("feature_path") ?? "",
        date: input.date,
        nexusVersion: input.nexusVersion ?? null,
        issuesRepo,
        codeRepo,
        record: recordSource,
        verdicts,
        ranges: passed,
        waivedStories: waived.map((w) => ({ story: w.story, date: w.date })),
    });

    // Find before write for the stubs, still read-only: every issue that mentions the epic, through
    // its back-references, never search (search could miss a stub filed a moment ago). A stub an
    // earlier run filed carries its key, even once promoted (D9, G21).
    const stubs = new Map<string, number>();
    if (content.approved.length > 0) {
        const mentions = deps.epicMentions(repoRoot, issuesRepo, epic);
        if (!mentions.ok) {
            return stopped({ reason: `the issues that mention epic ${epicRef} could not be read, so close cannot tell which approved proposals an earlier run already filed: ${mentions.message}`, item: `epic ${epicRef}`, remedy: `re-run ${rerun} once the read succeeds` });
        }
        for (const p of content.approved) {
            const keys = spellings.map((repo) => stubKey({ ...content, issuesRepo: repo }, p));
            const found = mentions.issues
                .filter((i) => !i.pullRequest && i.trusted && sameRepo(i.repo, issuesRepo) && keys.some((k) => i.body.includes(k)))
                .map((i) => i.number)
                .sort((a, b) => a - b)[0];
            if (found !== undefined) stubs.set(proposalKey(p), found);
        }
    }
    const reusedStubs = stubs.size;

    // 4. Worktree. The first step that creates anything.
    const wt = deps.openWorktree(repoRoot, epic, input.date);
    if (!wt.ok) return stopped({ reason: wt.error.message, item: repoRoot, remedy: `re-run ${rerun} once the cause above is fixed` });
    const entry = queueEntry(wt.wtPath, epic, entryRel, resolved.markdown);
    const done: string[] = [`distill branch ${wt.branch} checked out at ${wt.wtPath}`];
    const again = `re-run ${rerun}; it reuses ${wt.branch} and repeats nothing already done`;

    // 5. The stubs, then the markers (D11).
    const notesAfter: string[] = [];
    const toFile = content.approved.filter((p) => !stubs.has(proposalKey(p)));
    if (toFile.length > 0) {
        const filed = deps.fileStubs(
            repoRoot,
            issuesRepo,
            epic,
            toFile.map((p) => ({ ref: stubRef(p), key: proposalKey(p), ...renderDeferredStub(content, p) })),
        );
        for (const [k, n] of filed.numbers) stubs.set(k, n);
        if (filed.numbers.size > 0) done.push(`filed ${[...filed.numbers.values()].map((n) => `${issuesRepo}#${n}`).join(", ")} as epic stub(s)`);
        if (!filed.ok) {
            return stoppedAfter(done, {
                reason: `the approved deferred scope could not all be filed: ${filed.message}`,
                item: `epic ${epicRef}`,
                remedy: `fix the cause above, then ${again}: it finds each stub already filed by its key and files only the rest`,
            });
        }
        notesAfter.push(...filed.notes);
    }
    for (const w of waived.filter((x) => !x.marked)) {
        const marked = deps.writeMarker(repoRoot, issuesRepo, w.story);
        if (!marked.ok) {
            return stoppedAfter(done, {
                reason: `the no-pull-request marker could not be written on story ${issuesRepo}#${w.story}: ${marked.message}`,
                item: `story ${issuesRepo}#${w.story}`,
                remedy: `fix the cause above, then ${again}`,
            });
        }
        done.push(`wrote the no-pull-request marker on ${issuesRepo}#${w.story}`);
    }

    // 6. The close record, with the stub numbers, committed and pushed.
    const recordPath = path.join(entry.dir, "close-record.md");
    fs.writeFileSync(recordPath, renderCloseRecord(content, stubs));
    const commit = deps.commitEntry(wt.wtPath, [path.join(entry.dir, "epic.md"), recordPath], `close: epic-${epic} — ${entry.kind === "born" ? "born-at-close epic, close record" : "close record"}`);
    if (!commit.ok) {
        return stoppedAfter(done, { reason: `the close record could not be committed on ${wt.branch}: ${commit.message}`, item: recordPath, remedy: `fix the cause above, then ${again}; it rewrites the same record` });
    }
    const pushed = deps.push(wt.wtPath, wt.branch);
    if (!pushed.ok) {
        return stoppedAfter([...done, `committed the close record on ${wt.branch}`], {
            reason: `the distill branch ${wt.branch} could not be pushed: ${pushed.message}. No amendment and no close comment were posted, and epic ${epicRef} stays open`,
            item: `branch ${wt.branch}`,
            remedy: `fix the cause above, then ${again} and pushes the branch`,
        });
    }
    done.push(`committed and pushed the close record on ${wt.branch}`);

    // 7. The record amendment, with find before write. A failed post is reported and stops nothing (G48).
    const amendment = postAmendment(deps, repoRoot, content, spellings);

    // 8. The close comment: the durable copy. A failed post is a stop, with the epic open (G25).
    const closeComment = renderCloseComment(content, stubs);
    const posted = deps.postComment(repoRoot, issuesRepo, epic, closeComment);
    if (!posted.ok) {
        return stoppedAfter(done, {
            reason: `the close comment did not post on epic ${epicRef}: ${posted.message}. It is the only durable copy of the close's rationale, so epic ${epicRef} stays open`,
            item: `epic ${epicRef}`,
            remedy: `${again}; it rebuilds the same close comment from the verdicts and posts it`,
        });
    }
    done.push(`posted the close comment on ${epicRef}`);

    // 9. Close the epic issue, then the hand-off note, only now (G17).
    const closedIssue = deps.closeIssue(repoRoot, issuesRepo, epic);
    if (!closedIssue.ok) {
        return stoppedAfter(done, { reason: `epic ${epicRef} could not be closed: ${closedIssue.message}`, item: `epic ${epicRef}`, remedy: `${again}; with the close comment posted, it only closes the issue and hands off` });
    }
    const note = writeHandoff(input.handoff, epic, wt.branch, wt.wtPath);
    if (!note.ok) return stoppedAfter([...done, `closed ${epicRef}`], { reason: note.message, item: input.handoff ?? "", remedy: `fix the cause above, then ${again}` });

    const filedNow = [...stubs.entries()].filter(([k]) => toFile.some((p) => proposalKey(p) === k)).length;
    const lines: string[] = [
        `EPIC CLOSED: ${resolved.resolved.title}`,
        "",
        `nexus close: epic ${epicRef} passed every gate and is closed.`,
        "",
        `Pull requests:     ${mergedList(passed.merged)}`,
        `Issues repository: ${issuesRepo}`,
        `Stories:           ${passed.states.map((s) => `${issuesRepo}#${s.story} ${s.state}`).join(", ") || "none"}`,
        ...passed.waivers.map(
            (w) =>
                `Waiver applied:    ${w.repo}#${w.pr} ${w.cause}` +
                (w.cause === "landed-change" ? ` naming ${w.files.join(", ")}` : ` accepting ${issuesRepo}#${w.record} at ${w.digest}`) +
                ` by @${w.author || "unknown"} (${w.url})`,
        ),
        ...content.waivedFindings.map((f) => `Finding waived:    ${f.repo}#${f.pr} ${f.id} (${f.severity}) by @${f.author || "unknown"} (${f.link})`),
        ...waived.map((w) => `Story waived:      ${issuesRepo}#${w.story} storyless, waived ${w.date} by @${w.author || "unknown"} (${w.url}); ${w.marked ? "marker already on the issue" : "marker written"}`),
        ...passed.lines.map((l) => `  ${l}`),
        ...notes,
        ...content.notes,
        ...notesAfter,
        "",
        `Distill branch:    ${wt.branch} (${wt.source === "new" ? "cut from the trunk" : wt.source === "local" ? "reused from an earlier run" : "reused from an earlier run's push"}; pushed)`,
        `Worktree:          ${wt.wtPath}`,
        `Queue entry:       ${entry.dir} (${entry.kind === "born" ? "born at close" : entry.kind === "reused" ? "reused from an earlier run" : "committed entry, used as is"})`,
        `Close record:      ${recordPath} (${commit.committed ? `committed on ${wt.branch}` : "unchanged since an earlier run's commit"})`,
        `Analyze:           ${content.analyze}`,
        `Key decisions:     ${content.keyDecisions.length} (${content.keyDecisions.filter((d) => d.kind !== "stub").length} from the record, ${content.keyDecisions.filter((d) => d.kind === "stub").length} confirmed stub(s))`,
        `Deviations:        ${content.deviations.length} accepted departure(s)`,
        `Deferred scope:    ${
            content.approved.length === 0
                ? "none approved"
                : `${content.approved.length} approved proposal(s) as epic stub issue(s): ${content.approved.map((p) => `${issuesRepo}#${stubs.get(proposalKey(p))}`).join(", ")}` +
                  ` (${filedNow} filed now, ${reusedStubs} found from an earlier run)`
        }`,
        ...(record === null ? [] : [`Record amendment:  ${issuesRepo}#${record} — ${amendment.line}`]),
        `Close comment:     posted on ${epicRef}`,
        `Epic issue:        ${epicRef} — ${closedIssue.already ? "already closed" : "closed"}`,
        "",
        ...amendment.byHand,
        ...nextLines(input.handoff, wt.wtPath),
    ];
    return { ok: true, resumed: false, epic, issuesRepo, wtPath: wt.wtPath, branch: wt.branch, recordPath, closeComment, content, stubs, lines };
}

/**
 * A re-run after the close comment posted (G27): close regenerates nothing. It reuses the distill
 * branch the earlier run pushed, closes the epic issue if it is still open, writes the hand-off
 * note and reports.
 */
function finishClosed(
    deps: CloseCommandDeps,
    input: CloseInput,
    at: { repoRoot: string; issuesRepo: string; codeRepo: string; epic: number; rerun: string; spellings: string[] },
    block: Record<string, unknown>,
): CloseOutcome {
    const epicRef = `${at.issuesRepo}#${at.epic}`;
    // Look for the earlier run's branch read-only first, so a missing one stops with nothing created (G3).
    const earlier = deps.findDistillBranch(at.repoRoot, at.epic);
    if (!earlier.ok) return stopped({ reason: earlier.error.message, item: at.repoRoot, remedy: `re-run ${at.rerun} once the cause above is fixed` });
    if (earlier.branch === null) {
        return stopped({
            reason: `epic ${epicRef} already carries its close comment, but no distill branch an earlier close cut for it was found, locally or on the push remote; distill may already have drained it`,
            item: `epic ${epicRef}`,
            remedy: `if the entry still needs draining, run /nxs.distill --recover ${at.epic}, which rebuilds it from the close comment; otherwise nothing is left to do`,
        });
    }
    const wt = deps.openWorktree(at.repoRoot, at.epic, input.date);
    if (!wt.ok) return stopped({ reason: wt.error.message, item: at.repoRoot, remedy: `re-run ${at.rerun} once the cause above is fixed` });
    // The one write an earlier run can leave undone after its close comment: the amendment (G26, G28).
    const amendment = amendOnRerun(deps, input, at, block);
    const closedIssue = deps.closeIssue(at.repoRoot, at.issuesRepo, at.epic);
    if (!closedIssue.ok) return stopped({ reason: `epic ${epicRef} could not be closed: ${closedIssue.message}`, item: `epic ${epicRef}`, remedy: `re-run ${at.rerun}` });
    const note = writeHandoff(input.handoff, at.epic, wt.branch, wt.wtPath);
    if (!note.ok) return stopped({ reason: note.message, item: input.handoff ?? "", remedy: `fix the cause above, then re-run ${at.rerun}` });
    const lines = [
        `EPIC CLOSED: ${epicRef}`,
        "",
        `nexus close: epic ${epicRef} already carries its close comment from an earlier run; nothing was regenerated or reposted.`,
        "",
        `Pull requests:     ${stampedList(block)}`,
        `Issues repository: ${at.issuesRepo}`,
        `Distill branch:    ${wt.branch} (reused from an earlier run${wt.source === "pushed" ? "'s push" : ""})`,
        `Worktree:          ${wt.wtPath}`,
        ...(amendment === null ? [] : [`Record amendment:  ${amendment.record} — ${amendment.line}`]),
        `Epic issue:        ${epicRef} — ${closedIssue.already ? "already closed" : "closed"}`,
        "",
        ...(amendment === null ? [] : amendment.byHand),
        ...nextLines(input.handoff, wt.wtPath),
    ];
    return { ok: true, resumed: true, epic: at.epic, issuesRepo: at.issuesRepo, wtPath: wt.wtPath, branch: wt.branch, lines };
}

/**
 * On a re-run after the close comment posted, post the amendment if an earlier run did not (G26,
 * G28). The record's own comments are checked first, so an amendment already posted costs no
 * verdict read. Otherwise the amendment is rebuilt from the verdicts of the pull requests the close
 * comment stamped and the record body it stamped. Nothing here stops close (G48): a failed read is
 * reported, a failed post hands the lead the comment to post. Null when the close named no record.
 */
function amendOnRerun(
    deps: CloseCommandDeps,
    input: CloseInput,
    at: { repoRoot: string; issuesRepo: string; codeRepo: string; epic: number; rerun: string; spellings: string[] },
    block: Record<string, unknown>,
): { record: string; line: string; byHand: string[] } | null {
    const record = recordNumber(block["record"]);
    if (record === null) return null;
    const recordRef = `${at.issuesRepo}#${record}`;
    const notChecked = (why: string) => ({ record: recordRef, line: `NOT CHECKED — ${why}. Close not blocked`, byHand: [] });

    const existing = deps.issueComments(at.repoRoot, at.issuesRepo, record);
    if (!existing.ok) return notChecked(`the comments on ${recordRef} could not be read: ${existing.message}; re-run ${at.rerun} to check again`);
    const keys = at.spellings.map((repo) => amendmentKey(repo, at.epic));
    if (existing.comments.some((c) => trustedComment(c) && keys.some((k) => c.body.includes(k)))) return { record: recordRef, line: "already posted by an earlier run", byHand: [] };

    const body = deps.recordBody(at.repoRoot, at.issuesRepo, record);
    if (!body.ok) return notChecked(`${recordRef} could not be read: ${body.message}; re-run ${at.rerun} to check again`);
    if (body.digest !== String(block["record_hash"] ?? "")) {
        return notChecked(`${recordRef} was revised since the close, so an amendment now would describe a revision the close did not stamp; run nexus close --recover ${at.epic} first`);
    }
    const verdicts: CloseVerdict[] = [];
    for (const pr of stampedPrs(block).prs) {
        const read = deps.verdict(at.repoRoot, at.issuesRepo, pr);
        if (!read.ok) return notChecked(`the verdict on ${pr.repo}#${pr.pr} could not be read: ${read.cause}; re-run ${at.rerun} to check again`);
        if (read.found && read.judgments === "present") verdicts.push({ ...pr, date: read.date, head: read.head, recordHash: read.recordHash, judgments: read.read });
    }
    const content = assembleCloseContent({
        epic: at.epic,
        title: "",
        feature: "",
        featurePath: "",
        date: input.date,
        nexusVersion: null,
        issuesRepo: at.issuesRepo,
        codeRepo: at.codeRepo,
        record: { number: record, body: body.body, digest: body.digest },
        verdicts,
        ranges: { range: [], stories: [], landed: [], waivers: [] },
    });
    return { record: recordRef, ...postAmendment(deps, at.repoRoot, content, at.spellings) };
}

/**
 * The hand-off note the close-and-distill script reads, in today's three-line format (G17). Written
 * only after every write succeeded, so its presence means the close finished.
 */
function writeHandoff(at: string | null, epic: number, branch: string, wtPath: string): { ok: true } | { ok: false; message: string } {
    if (at === null) return { ok: true };
    try {
        fs.mkdirSync(path.dirname(at), { recursive: true });
        fs.writeFileSync(at, `epic: ${epic}\nbranch: ${branch}\nworktree: ${wtPath}\n`);
        return { ok: true };
    } catch (e) {
        return { ok: false, message: `the hand-off note could not be written to ${at}: ${e instanceof Error ? e.message : String(e)}` };
    }
}

/** How the report ends: the hand-off to the script, or the command that continues the drain. */
function nextLines(handoff: string | null, wtPath: string): string[] {
    if (handoff !== null) return [`Hand-off note written: ${handoff}`, "", "NEXT — utils/close-epic.sh continues from here."];
    return ["NEXT — continue the drain from the worktree:", `    cd ${wtPath} && /nxs.distill`];
}

/** The frontmatter keys of a materialized `epic.md`, unquoted. */
function frontmatter(markdown: string): Map<string, string> {
    const out = new Map<string, string>();
    const fm = /^---\n([\s\S]*?)\n---/.exec(markdown);
    if (fm === null) return out;
    for (const line of fm[1].split("\n")) {
        const m = /^([A-Za-z_][\w-]*):\s*(.*?)\s*$/.exec(line);
        if (m !== null) out.set(m[1], m[2].replace(/^["']|["']$/g, ""));
    }
    return out;
}

/**
 * Post the amendment on the record issue once (D12, G28, G48): nothing when no departure is marked
 * superseding, nothing when a trusted comment already carries this epic's key. Never edits the
 * record's body, title, labels or state. Returns the report line; a failure never stops close.
 */
function postAmendment(deps: CloseCommandDeps, root: string, content: CloseContent, spellings: readonly string[]): { line: string; byHand: string[] } {
    if (content.record === null) return { line: "none", byHand: [] };
    const body = renderRecordAmendment(content);
    if (body === null) return { line: "none (no departure is marked as superseding a record decision)", byHand: [] };
    const n = content.superseded.length;
    const recordRef = `${content.issuesRepo}#${content.record.number}`;
    // A failed post also hands the lead the exact comment to post: a re-run posts it too, but only
    // once someone runs one.
    const notPosted = (why: string, check: string) => ({
        line: `NOT POSTED — ${why}; ${n} superseding decision(s) stand in the close record's Deviation Rationale. Close not blocked; post the amendment below by hand`,
        byHand: [
            `AMENDMENT TO POST BY HAND on ${recordRef}${check}:`,
            "",
            ...body.replace(/\n+$/, "").split("\n").map((l) => (l === "" ? "" : `    ${l}`)),
            "",
        ],
    });
    const keys = spellings.map((repo) => amendmentKey(repo, content.epic));
    const existing = deps.issueComments(root, content.issuesRepo, content.record.number);
    if (!existing.ok) return notPosted(`could not check for an earlier amendment: ${existing.message}`, ", unless a comment there already carries its last line");
    if (existing.comments.some((c) => keys.some((k) => c.body.includes(k)) && trustedComment(c))) {
        return { line: `${n} superseding decision(s), already posted by an earlier run`, byHand: [] };
    }
    const posted = deps.postComment(root, content.issuesRepo, content.record.number, body);
    if (!posted.ok) return notPosted(posted.message, "");
    return { line: `${n} superseding decision(s) posted`, byHand: [] };
}

/** The queue entry inside the worktree: the committed one, the one an earlier run created, or born at close (G45). */
function queueEntry(wtPath: string, epic: number, entryRel: string | null, markdown: string): { dir: string; kind: "committed" | "reused" | "born" } {
    const queue = path.join(wtPath, ".nexus", "queue");
    if (entryRel !== null && !entryRel.startsWith("..") && fs.existsSync(path.join(wtPath, entryRel))) {
        return { dir: path.dirname(path.join(wtPath, entryRel)), kind: "committed" };
    }
    const keyed = path.join(queue, `epic-${epic}`);
    const keyedEpic = path.join(keyed, "epic.md");
    if (fs.existsSync(keyedEpic)) {
        const tracked = git(defaultRunner, wtPath, "ls-files", "--error-unmatch", keyedEpic) !== null;
        return { dir: keyed, kind: tracked ? "committed" : "reused" };
    }
    // An old-contract entry rode its pull request into the trunk under its own directory name.
    const dirs = fs.existsSync(queue) ? fs.readdirSync(queue, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort() : [];
    for (const name of dirs) {
        const candidate = path.join(queue, name, "epic.md");
        if (fs.existsSync(candidate) && linkedEpic(fs.readFileSync(candidate, "utf8")) === epic) return { dir: path.join(queue, name), kind: "committed" };
    }
    // Born at close: the epic-keyed directory may already hold committed scratch, left where it is.
    fs.mkdirSync(keyed, { recursive: true });
    fs.writeFileSync(keyedEpic, markdown);
    return { dir: keyed, kind: "born" };
}

function rangesFailureStops(r: Exclude<CloseRangesRead, { ok: true }>, issuesRepo: string, rerun: string): CloseStop[] {
    if (r.problem === "story-read-failed") {
        return r.failures.map((f) => ({
            reason: `the pull requests claiming story ${issuesRepo}#${f.story} could not be read: ${f.cause}. A failed read is not the same as no pull request`,
            item: `story ${issuesRepo}#${f.story}`,
            remedy: `re-run ${rerun} once the read succeeds`,
        }));
    }
    if (r.problem === "checkout-missing") {
        return r.missing.map((m) => ({
            reason: `${m.repo}, a repository a story merged in, has no checkout: ${m.message}`,
            item: m.expectedPath ?? m.repo,
            remedy: `check ${m.repo} out${m.expectedPath ? ` at ${m.expectedPath}` : ""}, then re-run ${rerun}`,
        }));
    }
    return [{ reason: r.message, item: "the epic's shipped records", remedy: `re-run ${rerun} once the read succeeds` }];
}

function blockStop(b: CloseRangeBlock, rerun: string): CloseStop {
    const item = `pull request ${b.repo}#${b.pr}`;
    switch (b.kind) {
        case "merge-commit-moved":
            return { reason: `the platform no longer reports the merge commit its shipped record stamped (recorded ${b.recorded}, reports ${b.reported ?? "none"})`, item, remedy: "find out why the merge commit changed on the platform; close cannot use a range whose commits are not on the trunk" };
        case "checkout-behind":
            return { reason: `the checkout ${b.checkout} does not hold merge commit ${b.mergeCommit}; the checkout is behind`, item, remedy: `run '${b.fetch}', then re-run ${rerun}` };
        case "not-landed":
            return { reason: `${b.checkout} holds merge commit ${b.mergeCommit}, but trunk ${b.trunkRef} does not reach it: it merged somewhere other than trunk`, item, remedy: `land it on trunk (or fetch trunk if it has moved since), then re-run ${rerun}` };
        case "landed-unreadable":
            return { reason: `whether it landed as reviewed could not be read: ${b.message}`, item, remedy: `re-run ${rerun} once the read succeeds` };
        case "range-underivable":
            return { reason: `no range could be derived (${b.problem}): ${b.message}`, item, remedy: `fix the cause named, then re-run ${rerun}` };
    }
}

/** Why one waiver comment cleared nothing, as a stop names it. */
export function describeRejected(r: RejectedWaiver): string {
    const who = `the waiver comment ${r.url} by @${r.author || "unknown"} cleared nothing`;
    switch (r.why) {
        case "untrusted":
            return `${who}: its author cannot speak for the repository`;
        case "malformed":
            return `${who}: ${r.problem}`;
        case "incomplete":
            return `${who}: it does not name ${r.uncovered.join(", ")}`;
        case "other-revision":
            return `${who}: it accepts record ${r.record} at digest ${r.digest}, not the current revision`;
    }
}

/** The exact close-waiver comment for one cause, as the one waiver reader reads it. */
export function waiverComment(lines: string[]): string {
    return [WAIVER_MARKER, "```yaml", ...lines, "reason: <optional, one line>", "```"].join("\n");
}

/** One stop per thing that keeps a story from being current, each with the remedy that clears it. */
function storyStops(s: StoryState, issuesRepo: string, record: number | null, rerun: string, rejected: readonly RejectedWaiver[]): CloseStop[] {
    const ref = `${issuesRepo}#${s.story}`;
    const item = `story ${ref}`;
    const pr = (f: { repo: string; pr: number }): string => `${f.repo}#${f.pr}`;
    const analyze = (f: { pr: number }): string => `/nxs.analyze --pr ${f.pr}`;
    switch (s.state) {
        case "current":
        case "excluded":
            return [];
        case "unshipped": {
            const open = s.findings.filter((f) => f.finding === "open").map(pr);
            if (open.length > 0) {
                return [{ reason: `story ${ref} is unshipped: ${open.join(", ")} ${open.length === 1 ? "is" : "are"} open and claim${open.length === 1 ? "s" : ""} it`, item, remedy: `merge or close ${open.join(", ")}, then re-run ${rerun}` }];
            }
            const closed = s.findings.filter((f) => f.finding === "closed-unmerged").map(pr);
            if (closed.length > 0) {
                return [{ reason: `story ${ref} is unshipped: its only claiming pull request${closed.length === 1 ? "" : "s"} ${closed.join(", ")} closed without merging`, item, remedy: `ship it through a pull request that claims it, then re-run ${rerun}` }];
            }
            return [
                {
                    reason: `story ${ref} is unshipped: no pull request claims it, and its issue carries neither the no-pull-request marker nor a trusted storyless waiver${rejected.map((w) => `; ${describeRejected(w)}`).join("")}`,
                    item,
                    remedy:
                        `ship it through a pull request that claims it; or, when it shipped inside another story's pull request, ` +
                        `post this waiver comment on story ${ref} as someone who can speak for ${issuesRepo}; then re-run ${rerun}`,
                    post: { on: `story ${ref}`, comment: storylessWaiverComment(s.story) },
                },
            ];
        }
        case "never-reviewed":
            return s.findings
                .filter((f): f is Extract<StoryStateFinding, { finding: "no-receipt" }> => f.finding === "no-receipt")
                .map((f) => ({ reason: `story ${ref} was never reviewed: no verdict on ${pr(f)} names it`, item, remedy: `run ${f.remedy} on ${pr(f)}, then re-run ${rerun}; no waiver clears this` }));
        case "unknown":
        case "stale":
            return s.findings.flatMap((f): CloseStop[] => {
                switch (f.finding) {
                    case "unreadable":
                        return [{ reason: `story ${ref} is unknown: the ${f.evidence === "landed-check" ? "landed check" : f.evidence} evidence for ${pr(f)} could not be read: ${f.cause}`, item, remedy: `re-run ${rerun} once the read succeeds` }];
                    case "head-mismatch":
                        return [{ reason: `story ${ref} is stale: ${pr(f)}'s verdict analyzed head ${f.analyzedHead}, but ${f.mergedHead} merged`, item, remedy: `run ${analyze(f)} on ${pr(f)}, then re-run ${rerun}; no waiver clears a moved head` }];
                    case "record-revised": {
                        const recordRef = `${issuesRepo}#${record ?? f.record}`;
                        return [
                            {
                                reason: `story ${ref} is stale: the decision record ${recordRef} was revised after ${pr(f)}'s verdict (${f.stampedDigest} → ${f.currentDigest})${(f.waivers ?? []).map((w) => `; ${describeRejected(w)}`).join("")}`,
                                item,
                                remedy: `run ${analyze(f)} on ${pr(f)}, or post this waiver comment on ${pr(f)} as someone who can speak for the repository; then re-run ${rerun}`,
                                post: { on: pr(f), comment: waiverComment(["waive: record-revised", `record: "${recordRef}"`, `digest: ${f.currentDigest}`]) },
                            },
                        ];
                    }
                    case "landed-change":
                        return [
                            {
                                reason: `story ${ref} is stale: ${pr(f)} did not land ${f.files.join(", ")} as reviewed${(f.waivers ?? []).map((w) => `; ${describeRejected(w)}`).join("")}`,
                                item,
                                remedy: `post this waiver comment on ${pr(f)} as someone who can speak for the repository, naming every changed file; then re-run ${rerun}. No analyze run can change what landed`,
                                post: { on: pr(f), comment: waiverComment(["waive: landed-change", "files:", ...f.files.map((file) => `  - ${file}`)]) },
                            },
                        ];
                    default:
                        return [];
                }
            });
    }
}

/** The verdict gate on one merged claiming pull request (G7, G8). */
export function verdictStops(v: CloseVerdictRead, repo: string, n: number, rerun: string): CloseStop[] {
    const ref = `${repo}#${n}`;
    const item = `pull request ${ref}`;
    if (!v.ok) return [{ reason: `the verdict on ${ref} could not be read: ${v.cause}`, item, remedy: `re-run ${rerun} once the read succeeds` }];
    // No verdict at all: the evidence gate already stops a story it leaves unreviewed, and a pull
    // request with no range of its own needs none.
    if (!v.found) return [];
    const out: CloseStop[] = [];
    if (v.critical > 0 || v.high > 0) {
        out.push({
            reason: `the verdict on ${ref} has open blocking items (critical ${v.critical}, high ${v.high})`,
            item,
            remedy:
                `fix the code, or answer each open item on ${ref} in a comment from someone who can speak for the repository — ` +
                `"<ID> — accepted: <reason>" for a departure, "<ID> — waived: <reason>" for a critical or high finding; ` +
                `then run /nxs.analyze --pr ${n} --resolve to record the answers; then re-run ${rerun}`,
        });
    }
    if (v.judgments === "absent") {
        out.push({
            reason: `the verdict on ${ref} has no judgments block (it was published before analyze recorded its judgments), so close has nothing to read its decisions from`,
            item,
            remedy: `run a full /nxs.analyze --pr ${n} on ${ref}, then re-run ${rerun}`,
        });
    } else if (v.judgments === "malformed") {
        out.push({ reason: `the judgments block of the verdict on ${ref} cannot be read: ${v.malformed}`, item, remedy: `run a full /nxs.analyze --pr ${n} on ${ref}, then re-run ${rerun}` });
    }
    return out;
}

/** What the command prints, and its exit code: 0 when every gate passed, 1 on a stop. Recovery's outcome prints the same way. */
export function renderCloseOutcome(outcome: { ok: true; lines: string[] } | { ok: false; stops: CloseStop[]; done?: string[] }): { stdout: string[]; stderr: string[]; exitCode: number } {
    if (outcome.ok) return { stdout: outcome.lines, stderr: [], exitCode: 0 };
    const things = `${outcome.stops.length} thing${outcome.stops.length === 1 ? "" : "s"} to fix`;
    const err: string[] =
        outcome.done === undefined || outcome.done.length === 0
            ? [`nexus close stopped: ${things}. Nothing was created or written.`]
            : [`nexus close stopped: ${things}. Already done, and not repeated by a re-run:`, ...outcome.done.map((d) => `  - ${d}`)];
    for (const s of outcome.stops) {
        err.push("", `STOP`, `  reason: ${s.reason}`, `  item:   ${s.item}`, `  remedy: ${s.remedy}`);
        if (s.post !== undefined) {
            err.push(`  comment to post on ${s.post.on}:`, "", ...s.post.comment.split("\n").map((l) => `    ${l}`));
        }
    }
    return { stdout: [], stderr: err, exitCode: 1 };
}

/** The issues repository as `gh api` addresses it: its owner/repo path, and `--hostname` off github.com. */
function apiRepo(issuesRepo: string): { host: string[]; path: string } {
    const parts = issuesRepo.split("/");
    if (parts.length !== 3) return { host: [], path: issuesRepo };
    return { host: parts[0].toLowerCase() === "github.com" ? [] : ["--hostname", parts[0]], path: `${parts[1]}/${parts[2]}` };
}

/** The platform-backed reads, against the checkout at `root`. */
export function closeCommandDeps(run: Runner, opts: { singleRepo: (root: string) => boolean; filerEnv?: FilerEnvironment }): CloseCommandDeps {
    // How the repository files issues, read once per checkout however many reads need it.
    const classifications = new Map<string, ReturnType<typeof resolveKindClassification>>();
    const classificationOf = (root: string): ReturnType<typeof resolveKindClassification> => {
        const known = classifications.get(root);
        if (known !== undefined) return known;
        const read = resolveKindClassification(root);
        classifications.set(root, read);
        return read;
    };
    return {
        role: (cwd) => closePreflight(cwd, run),
        readPr: (repoRoot, ref) => {
            // A bare number is read where resolvePr reads one, the checkout's own repository; a
            // qualified one on the forge prRepoOnForge names, gh's own when the checkout names none.
            const repo = ref.repo === null ? null : prRepoOnForge(ref, canonicalRepoRef(run, repoRoot));
            return resolvePr(run, repoRoot, ref.number, { requireMerged: false, ...(repo === null ? {} : { repo }) });
        },
        issuesRepo: (root) => resolveVerdictRepos(run, root),
        storiesOfPr: (root, issuesRepo, pr, prRepo) => {
            const kinds = classificationOf(root);
            if (!kinds.ok) return { ok: false, error: { problem: "classification-mode-mismatch", message: kinds.error.message } };
            const slug = issuesRepoSlug(issuesRepo);
            return resolveStories(run, root, slug, kinds.classification, {
                prRepo,
                closingIssues: pr.closingIssues,
                commitMessages: pr.commitMessages,
                branchName: pr.headRef,
                prBody: pr.body,
            });
        },
        issueKind: (root, issuesRepo, issue) => {
            const kinds = classificationOf(root);
            if (!kinds.ok) return { ok: false, message: kinds.error.message };
            const slug = issuesRepoSlug(issuesRepo);
            const facts = fetchIssueFacts(run, root, slug, issue);
            if (!facts.ok) return { ok: false, message: facts.error.message };
            if (!facts.facts.exists) return { ok: true, exists: false, kind: "other", parent: null };
            const kind = classifyIssueKind(kinds.classification, { number: issue, labels: facts.facts.labels, issueType: facts.facts.issueType });
            return kind.ok ? { ok: true, exists: true, kind: kind.kind, parent: facts.facts.parent } : { ok: false, message: kind.error.message };
        },
        resolveEpic: (root, issuesRepo, epic) => resolveEpic(run, root, epic, { requireEpic: false, singleRepo: opts.singleRepo(root), repo: issuesRepo }),
        subIssues: (root, issuesRepo, epic) => {
            const slug = issuesRepoSlug(issuesRepo);
            const r = fetchSubIssueFacts(run, root, slug, epic);
            return r.ok ? { ok: true, facts: r.facts } : { ok: false, message: r.error.message };
        },
        excludedStories: (root, issuesRepo, stories) => {
            const label = resolvePublishingKey(root, "no-pr-label");
            return label.length > 0 ? stories.filter((s) => storyCarriesLabel(run, root, issuesRepo, s, label)) : [];
        },
        ranges: (root, issuesRepo, epic, input) => {
            const collected = fetchShippedRecords(run, root, issuesRepo, epic);
            if (!collected.ok) return { ok: false, problem: "records-unreadable", message: collected.error.message };
            const derived = deriveCloseRanges(closeRangesDeps(run, root, issuesRepo, input.record), {
                stories: input.stories,
                excluded: input.excluded,
                records: collected.collected.records.map((f) => f.record),
                issuesRepo,
            });
            return derived.ok ? { ok: true, ranges: derived.ranges, untrusted: collected.collected.untrusted } : derived;
        },
        verdict: (root, issuesRepo, pr) => {
            const r = verifyReceipt(run, root, pr.pr, pr.repo, issuesRepo, { ghRepo: pr.repo });
            if (!r.ok) return { ok: false, cause: r.error.message };
            if (!r.value.found || r.value.receipt === null) {
                if (r.value.issuesRepoRejected.length > 0) {
                    return { ok: false, cause: `every verdict on it names another issues repository (${[...new Set(r.value.issuesRepoRejected)].join(", ")}), not ${issuesRepo}; re-run /nxs.analyze --pr ${pr.pr} so it names this one` };
                }
                return { ok: true, found: false };
            }
            const findings = r.value.receipt.findings;
            if (findings["critical"] === undefined || findings["high"] === undefined) return { ok: false, cause: "its verdict states no critical or high count" };
            const counts = { critical: findings["critical"], high: findings["high"] };
            const parsed = parseJudgmentsBlock(r.value.rawBody);
            if (!parsed.ok) return { ok: true, found: true, ...counts, judgments: "malformed", malformed: parsed.message };
            if (parsed.judgments === null) return { ok: true, found: true, ...counts, judgments: "absent" };
            const receipt = r.value.receipt;
            return { ok: true, found: true, ...counts, judgments: "present", read: parsed.judgments, date: receipt.date, head: receipt.head, recordHash: receipt.recordHash };
        },
        trunkCheck: (repoRoot, heads) => {
            const remote = canonicalRemote(run, repoRoot);
            run("git", ["fetch", remote, "main"], { cwd: repoRoot });
            const trunk = git(run, repoRoot, "rev-parse", "--verify", `${remote}/main`) ?? git(run, repoRoot, "rev-parse", "--verify", "main");
            if (trunk === null) return { ok: false, error: { problem: "git-failed", message: `neither ${remote}/main nor main resolves in ${repoRoot}.` } };
            return verifyTrunkContainsHeads(run, repoRoot, trunk, heads, { remote });
        },
        findDistillBranch: (repoRoot, epic) => findEpicDistillBranch(run, repoRoot, epic),
        openWorktree: (repoRoot, epic, date) => openEpicDistillWorktree(run, repoRoot, epic, date),
        recordBody: (root, issuesRepo, record) => {
            const r = fetchRecord(run, root, record, issuesRepo);
            return r.ok ? { ok: true, body: r.record.body, digest: r.record.digest } : { ok: false, message: r.error.message };
        },
        commitEntry: (wtPath, files, message) => {
            const add = run("git", ["add", "--", ...files], { cwd: wtPath });
            if (add.status !== 0) return { ok: false, message: add.stderr.trim() || "git add failed" };
            if (run("git", ["diff", "--cached", "--quiet", "--", ...files], { cwd: wtPath }).status === 0) return { ok: true, committed: false };
            const commit = run("git", ["commit", "-m", message, "--", ...files], { cwd: wtPath });
            return commit.status === 0 ? { ok: true, committed: true } : { ok: false, message: commit.stderr.trim() || commit.stdout.trim() || "git commit failed" };
        },
        issueComments: (root, issuesRepo, issue) => {
            const r = run("gh", ["issue", "view", String(issue), "--repo", issuesRepo, "--json", "comments"], { cwd: root });
            if (r.status !== 0) return { ok: false, message: r.stderr.trim() || "gh issue view failed" };
            try {
                const doc = JSON.parse(r.stdout) as { comments?: unknown };
                const list = Array.isArray(doc.comments) ? doc.comments : [];
                return {
                    ok: true,
                    comments: list.map((c) => {
                        const rec = (c ?? {}) as Record<string, unknown>;
                        return { body: typeof rec["body"] === "string" ? rec["body"] : "", authorAssociation: typeof rec["authorAssociation"] === "string" ? rec["authorAssociation"] : "" };
                    }),
                };
            } catch (e) {
                return { ok: false, message: `the comments could not be read as JSON: ${e instanceof Error ? e.message : String(e)}` };
            }
        },
        postComment: (root, issuesRepo, issue, body) => {
            const { host, path: repoPath } = apiRepo(issuesRepo);
            const r = run("gh", ["api", ...host, "--method", "POST", `repos/${repoPath}/issues/${issue}/comments`, "-f", `body=${body}`], { cwd: root });
            return r.status === 0 ? { ok: true } : { ok: false, message: r.stderr.trim() || "gh api failed" };
        },
        storyWaivers: (root, issuesRepo, story) => {
            const r = readStoryWaivers(run, root, issuesRepo, story);
            return r.ok ? { ok: true, comments: r.value } : { ok: false, message: r.error.message };
        },
        epicMentions: (root, issuesRepo, epic) => {
            const { host, path: repoPath } = apiRepo(issuesRepo);
            const r = run("gh", ["api", ...host, "--paginate", `repos/${repoPath}/issues/${epic}/timeline`, "--jq", MENTIONS_JQ], { cwd: root });
            if (r.status !== 0) return { ok: false, message: r.stderr.trim() || "gh api failed" };
            const issues: MentioningIssue[] = [];
            for (const line of r.stdout.split("\n")) {
                if (line.trim() === "") continue;
                try {
                    const doc = JSON.parse(line) as Record<string, unknown>;
                    issues.push({
                        number: typeof doc["number"] === "number" ? doc["number"] : 0,
                        repo: typeof doc["repo"] === "string" ? doc["repo"] : "",
                        body: typeof doc["body"] === "string" ? doc["body"] : "",
                        pullRequest: doc["pullRequest"] === true,
                        trusted: trustedComment({ authorAssociation: typeof doc["association"] === "string" ? doc["association"] : "" }),
                    });
                } catch (e) {
                    return { ok: false, message: `a back-reference could not be read as JSON: ${e instanceof Error ? e.message : String(e)}` };
                }
            }
            return { ok: true, issues };
        },
        fileStubs: (root, issuesRepo, epic, stubs) => fileDeferredStubs(root, issuesRepo, `epic-${epic}`, stubs, opts.filerEnv),
        writeMarker: (root, issuesRepo, story) => {
            const r = waiveStory(run, root, story, resolvePublishingKey(root, "no-pr-label"), issuesRepo);
            return r.ok ? { ok: true } : { ok: false, message: r.error.message };
        },
        push: (wtPath, branch) => pushEpicDistillBranch(run, wtPath, branch),
        closeIssue: (root, issuesRepo, issue) => {
            const state = run("gh", ["issue", "view", String(issue), "--repo", issuesRepo, "--json", "state", "--jq", ".state"], { cwd: root });
            if (state.status !== 0) return { ok: false, message: state.stderr.trim() || "gh issue view failed" };
            if (state.stdout.trim().toUpperCase() === "CLOSED") return { ok: true, already: true };
            const r = run("gh", ["issue", "close", String(issue), "--repo", issuesRepo, "--reason", "completed"], { cwd: root });
            return r.status === 0 ? { ok: true, already: false } : { ok: false, message: r.stderr.trim() || "gh issue close failed" };
        },
    };
}

/**
 * Each issue a cross-reference on the epic's timeline names, one compact JSON object per line:
 * its number, repository, body, whether it is a pull request, and its author's association.
 */
const MENTIONS_JQ =
    '.[] | select(.event == "cross-referenced") | .source.issue | select(. != null) | ' +
    '{ number: .number, body: (.body // ""), repo: (.repository.full_name // ((.repository_url // "") | sub("^.*/repos/"; ""))), ' +
    'pullRequest: (.pull_request != null), association: (.author_association // "") } | @json';
