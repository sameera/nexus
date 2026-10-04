/**
 * `nexus close` — close as a plain command (epic #830, story #864, decision record #872, D1, D3).
 *
 * Close used to be a model-driven stage that asked the lead at a checkpoint. This command asks
 * nothing and runs no model (G1). It reads what earlier stages already decided and either passes
 * or stops. Every gate runs before anything is created (G3): a stop leaves no worktree, no file and
 * no GitHub write behind, so nothing needs cleaning up. Every stop is one block naming the reason,
 * the story, pull request, sub-issue or path concerned, and a remedy that can clear it (G4). A
 * waiver stop prints the exact comment to post (D3).
 *
 * The order follows the record's Mechanism:
 *
 *   1. Resolve, read-only. The checkout's role (a member is refused, G44), the pull request (it must
 *      have merged), the epic — from the entry path when one is given, else from the pull request's
 *      story and that story's parent (more than one epic is a stop naming the entry path, which
 *      gives the epic) — and the issues repository every issue read targets (G46).
 *   2. Gate, read-only. Every sub-issue closed, with no exemption (G43). #849's evidence gate over
 *      every live story, which reads waivers only from trusted comments already on the pull request
 *      (G5, G6). For each merged claiming pull request, a verdict with no open critical or high item
 *      (G7) and with a judgments block (G8). The trunk the distill branch is cut from must hold every
 *      merged head. Every failing gate is reported in one pass.
 *   4. Worktree. The distill branch an earlier run cut for this epic, local or pushed, else a fresh
 *      one from the trunk; then the committed queue entry, or the entry born at close (G45).
 *
 *   3. Assemble in memory (story #865): Key Decisions, Deviation Rationale, the superseded
 *      decisions, the approved proposals and the `analyze:` value, from the verdicts, the record
 *      body close stamps and the gate's stamps only — never the diff, a decision stub, a note or a
 *      story-issue comment (G2). See close-record.ts.
 *   6. Write the close record into the queue entry and commit it on the distill branch.
 *   7. Post the record amendment from the superseding marks, with find before write. A failed
 *      post is reported and stops nothing (G48).
 *
 * The close comment is rendered from the same content (G9) but not posted yet. Filing deferred
 * scope, the markers, the push, the close comment, closing the epic issue and the hand-off note
 * belong to story #866 (D11's order puts the stubs and the push before the record commit and the
 * amendment). Until it lands, this command says what it has not done. It writes no hand-off note,
 * because that note means the close finished (G17).
 *
 * Every platform read is injected, so a spec stands in for GitHub and git.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { resolveKindClassification } from "@nexus/epic-resolve/classify";
import { fetchSubIssueFacts, resolveRepoSlug, type IssueFacts } from "@nexus/epic-resolve/gh";
import { renderDiagnostic as renderEpicResolveDiagnostic } from "@nexus/epic-resolve/render";
import { resolveEpic, type ResolveEpicResult } from "@nexus/epic-resolve/resolve";
import { parseJudgmentsBlock, type Judgments } from "@nexus/pr-acceptance/judgments-block";
import { MAINTAINER_ASSOCIATIONS } from "@nexus/pr-acceptance/receipt-blocks";
import { verifyReceipt } from "@nexus/pr-acceptance/verify";
import { WAIVER_MARKER, type RejectedWaiver } from "@nexus/pr-acceptance/waiver";
import { resolvePr, type PrInfo, type ResolvePrResult } from "@nexus/pr-worktree/pr";
import { resolveStories, type ResolveStoriesResult } from "@nexus/pr-worktree/story-candidates";
import { verifyTrunkContainsHeads, type TrunkCheckItem, type VerifyTrunkResult } from "@nexus/pr-worktree/trunk-check";
import { openEpicDistillWorktree, type EpicDistillWorktreeResult } from "@nexus/pr-worktree/worktree";
import { resolvePublishingKey } from "@nexus/delivery-config/resolve";
import { canonicalRemote } from "@nexus/workspace/canonical-remote";
import { closePreflight, type PreflightResult } from "@nexus/workspace/close-role";
import { parseIssueRef, sameRepo } from "@nexus/workspace/issue-ref";
import { defaultRunner, git } from "@nexus/workspace/run";
import { fetchRecord } from "@nexus/record-digest/fetch";
import { amendmentKey, assembleCloseContent, renderCloseComment, renderCloseRecord, renderRecordAmendment, type CloseContent, type CloseVerdict } from "./close-record.js";
import { closeRangesDeps, deriveCloseRanges, type CloseRangeBlock, type CloseRanges, type CloseRangesResult, type StoryState, type StoryStateFinding } from "./close-ranges.js";
import { storyCarriesLabel } from "./exclusion.js";
import { fetchShippedRecords, type UntrustedRecord } from "./ledger.js";
import { type Runner } from "./run.js";
import { type ResolveVerdictReposResult, resolveVerdictRepos } from "./verdict-repos.js";

/** What the lead passed: the arguments `/nxs.close` takes (D1), plus today's date for the branch name. */
export interface CloseInput {
    /** The directory the command was run in. */
    cwd: string;
    pr: number;
    /** An `epic.md` path, absolute, or null when the epic comes from the pull request. */
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
    /** The pull request, merged or not; the gate words the not-merged stop itself. */
    readPr(repoRoot: string, pr: number): ResolvePrResult;
    /** The issues repository every issue read and write targets. */
    issuesRepo(root: string): ResolveVerdictReposResult;
    /** The epic and the stories the pull request implements, through the validated candidate ladder. */
    storiesOfPr(root: string, issuesRepo: string, pr: PrInfo): ResolveStoriesResult;
    /** The epic: its live stories, its decision record and the materialized `epic.md`. */
    resolveEpic(root: string, epic: number): ResolveEpicResult;
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
}

export interface ClosePassed {
    ok: true;
    epic: number;
    issuesRepo: string;
    pr: number;
    wtPath: string;
    branch: string;
    /** The close record written and committed in the worktree's queue entry. */
    recordPath: string;
    /** The close comment's body, rendered from the same content; #866 posts it. */
    closeComment: string;
    content: CloseContent;
    lines: string[];
}

export type CloseOutcome = ClosePassed | { ok: false; stops: CloseStop[] };

const stopped = (...stops: CloseStop[]): CloseOutcome => ({ ok: false, stops });

/** The epic number an `epic.md`'s `link` names, or null. */
function linkedEpic(markdown: string): number | null {
    const fm = /^---\n([\s\S]*?)\n---/.exec(markdown);
    if (fm === null) return null;
    const line = /^link:\s*(.+)$/m.exec(fm[1]);
    if (line === null) return null;
    const ref = parseIssueRef(line[1].trim().replace(/^["']|["']$/g, ""));
    return ref?.number ?? null;
}

/** Run close through the close record and the amendment. Asks nothing; every outcome is returned. */
export function runCloseCommand(deps: CloseCommandDeps, input: CloseInput): CloseOutcome {
    const prRef = `#${input.pr}`;
    const rerun = `nexus close --pr ${input.pr}`;

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

    const read = deps.readPr(repoRoot, input.pr);
    if (!read.ok) {
        return stopped({ reason: `pull request ${prRef} could not be read: ${read.error.message}`, item: `pull request ${prRef}`, remedy: `check the number, then re-run ${rerun}` });
    }
    const pr = read.pr;
    if (!pr.merged) {
        return stopped({
            reason: `pull request ${prRef} is not merged (it is ${pr.state.toLowerCase()}); close runs only after the merge`,
            item: `pull request ${prRef}`,
            remedy: `merge it, then re-run ${rerun}`,
        });
    }

    const repos = deps.issuesRepo(repoRoot);
    if (!repos.ok) return stopped({ reason: repos.error.message, item: repoRoot, remedy: `fix the checkout's remote or the configured epic-repo, then re-run ${rerun}` });
    const { issuesRepo, repo: codeRepo } = repos.repos;

    let epic: number;
    let entryRel: string | null = null;
    if (input.entryPath !== null) {
        let markdown: string;
        try {
            markdown = fs.readFileSync(input.entryPath, "utf8");
        } catch (e) {
            return stopped({
                reason: `the entry path cannot be read: ${e instanceof Error ? e.message : String(e)}`,
                item: input.entryPath,
                remedy: `pass the epic's epic.md, or omit the path so close resolves the epic from pull request ${prRef}`,
            });
        }
        const linked = linkedEpic(markdown);
        if (linked === null) {
            return stopped({
                reason: "the entry path's frontmatter has no link naming the epic issue",
                item: input.entryPath,
                remedy: `add link: "#<epic>" to its frontmatter, or omit the path so close resolves the epic from pull request ${prRef}`,
            });
        }
        epic = linked;
        entryRel = path.relative(repoRoot, path.resolve(input.entryPath));
    } else {
        const stories = deps.storiesOfPr(repoRoot, issuesRepo, pr);
        if (!stories.ok) {
            const ambiguous = stories.error.problem === "story-candidates-multiple-epics";
            return stopped({
                reason: ambiguous ? `pull request ${prRef} does not name one epic: ${stories.error.message}` : `the epic of pull request ${prRef} cannot be resolved: ${stories.error.message}`,
                item: `pull request ${prRef}`,
                remedy:
                    `name the epic with its entry path: nexus close --pr ${input.pr} <path to the epic's epic.md> ` +
                    `(nexus epic-resolve --epic <epic> --out <path> writes one)` +
                    (ambiguous ? "" : `, or have the pull request close its story issue`),
            });
        }
        epic = stories.epic;
    }
    const epicRef = `${issuesRepo}#${epic}`;

    const resolved = deps.resolveEpic(repoRoot, epic);
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
    const ranges = deps.ranges(repoRoot, issuesRepo, epic, { stories, excluded, record });
    let gate: CloseRanges | null = null;
    const verdicts: CloseVerdict[] = [];
    if (!ranges.ok) {
        stops.push(...rangesFailureStops(ranges, issuesRepo, rerun));
    } else {
        gate = ranges.ranges;
        for (const b of gate.blocking) stops.push(blockStop(b, rerun));
        for (const s of gate.states) stops.push(...storyStops(s, issuesRepo, record, rerun));
        if (ranges.untrusted.length > 0) {
            notes.push(
                `Shipped records on epic ${epicRef} from authors who cannot speak for ${issuesRepo}, not read: ` +
                    ranges.untrusted.map((u) => `@${u.author || "unknown"} (${u.authorAssociation || "none"})`).join(", ") +
                    ".",
            );
        }

        // Each merged claiming pull request's verdict, read once however many stories it implements,
        // in merge order: the range list is in merge order, and a pull request with no range follows.
        const seen = new Set<string>();
        const merged = [...gate.range.map((r) => ({ repo: r.repo, pr: r.pr })), ...gate.stories.flatMap((s) => s.ranges.map((r) => ({ repo: r.repo, pr: r.pr })))];
        for (const entry of merged) {
            const key = `${entry.repo.toLowerCase()}#${entry.pr}`;
            if (seen.has(key)) continue;
            seen.add(key);
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
    });

    // 4. Worktree. The first step that creates anything.
    const wt = deps.openWorktree(repoRoot, epic, input.date);
    if (!wt.ok) return stopped({ reason: wt.error.message, item: repoRoot, remedy: `re-run ${rerun} once the cause above is fixed` });
    const entry = queueEntry(wt.wtPath, epic, entryRel, resolved.markdown);

    // 6. The close record, written and committed in the entry. Stub numbers arrive with filing (#866).
    const recordPath = path.join(entry.dir, "close-record.md");
    fs.writeFileSync(recordPath, renderCloseRecord(content));
    const commit = deps.commitEntry(wt.wtPath, [path.join(entry.dir, "epic.md"), recordPath], `close: epic-${epic} — ${entry.kind === "born" ? "born-at-close epic, close record" : "close record"}`);
    if (!commit.ok) {
        return stopped({ reason: `the close record could not be committed on ${wt.branch}: ${commit.message}`, item: recordPath, remedy: `fix the cause above, then re-run ${rerun}; the re-run reuses the branch and rewrites the same record` });
    }

    // 7. The record amendment, with find before write. A failed post is reported and stops nothing (G48).
    const amendment = postAmendment(deps, repoRoot, content);

    const lines: string[] = [
        `nexus close: epic ${epicRef} passed every gate.`,
        "",
        `Pull request:      ${codeRepo}#${input.pr} (merged)`,
        `Issues repository: ${issuesRepo}`,
        `Stories:           ${passed.states.map((s) => `${issuesRepo}#${s.story} ${s.state}`).join(", ") || "none"}`,
        ...passed.waivers.map(
            (w) =>
                `Waiver applied:    ${w.repo}#${w.pr} ${w.cause}` +
                (w.cause === "landed-change" ? ` naming ${w.files.join(", ")}` : ` accepting ${issuesRepo}#${w.record} at ${w.digest}`) +
                ` by @${w.author || "unknown"} (${w.url})`,
        ),
        ...content.waivedFindings.map((f) => `Finding waived:    ${f.repo}#${f.pr} ${f.id} (${f.severity}) by @${f.author || "unknown"} (${f.link})`),
        ...passed.lines.map((l) => `  ${l}`),
        ...notes,
        ...content.notes,
        "",
        `Distill branch:    ${wt.branch} (${wt.source === "new" ? "cut from the trunk" : wt.source === "local" ? "reused from an earlier run" : "reused from an earlier run's push"})`,
        `Worktree:          ${wt.wtPath}`,
        `Queue entry:       ${entry.dir} (${entry.kind === "born" ? "born at close" : entry.kind === "reused" ? "reused from an earlier run" : "committed entry, used as is"})`,
        `Close record:      ${recordPath} (${commit.committed ? `committed on ${wt.branch}` : "unchanged since an earlier run's commit"})`,
        `Analyze:           ${content.analyze}`,
        `Key decisions:     ${content.keyDecisions.length} (${content.keyDecisions.filter((d) => d.kind !== "stub").length} from the record, ${content.keyDecisions.filter((d) => d.kind === "stub").length} confirmed stub(s))`,
        `Deviations:        ${content.deviations.length} accepted departure(s)`,
        `Deferred scope:    ${content.approved.length === 0 ? "none approved" : `${content.approved.length} approved proposal(s), not yet filed`}`,
        ...(record === null ? [] : [`Record amendment:  ${issuesRepo}#${record} — ${amendment}`]),
        "",
        "Not done yet by this release's nexus close: filing deferred scope, writing story markers, pushing",
        "the distill branch, posting the close comment and closing the epic issue. /nxs.close --pr " + String(input.pr),
        "still does those.",
    ];
    if (input.handoff !== null) lines.push(`Hand-off note:     not written to ${input.handoff}; it is written only when a close finishes.`);
    return { ok: true, epic, issuesRepo, pr: input.pr, wtPath: wt.wtPath, branch: wt.branch, recordPath, closeComment: renderCloseComment(content), content, lines };
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
function postAmendment(deps: CloseCommandDeps, root: string, content: CloseContent): string {
    if (content.record === null) return "none";
    const body = renderRecordAmendment(content);
    if (body === null) return "none (no departure is marked as superseding a record decision)";
    const n = content.superseded.length;
    const key = amendmentKey(content.issuesRepo, content.epic);
    const existing = deps.issueComments(root, content.issuesRepo, content.record.number);
    if (!existing.ok) return `NOT POSTED — could not check for an earlier amendment: ${existing.message}; ${n} superseding decision(s) stand in the close record's Deviation Rationale. Close not blocked; re-run to post it`;
    if (existing.comments.some((c) => c.body.includes(key) && MAINTAINER_ASSOCIATIONS.includes(c.authorAssociation.toUpperCase()))) {
        return `${n} superseding decision(s), already posted by an earlier run`;
    }
    const posted = deps.postComment(root, content.issuesRepo, content.record.number, body);
    if (!posted.ok) return `NOT POSTED — ${posted.message}; ${n} superseding decision(s) stand in the close record's Deviation Rationale. Close not blocked; re-run to post it`;
    return `${n} superseding decision(s) posted`;
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

function describeRejected(r: RejectedWaiver): string {
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
function waiverComment(lines: string[]): string {
    return [WAIVER_MARKER, "```yaml", ...lines, "reason: <optional, one line>", "```"].join("\n");
}

/** One stop per thing that keeps a story from being current, each with the remedy that clears it. */
function storyStops(s: StoryState, issuesRepo: string, record: number | null, rerun: string): CloseStop[] {
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
                    reason: `story ${ref} is unshipped: no pull request claims it`,
                    item,
                    remedy:
                        `ship it through a pull request that claims it; or, when it shipped inside another story's pull request, ` +
                        `mark it with nexus epic-verdicts waive-story --story ${s.story}; then re-run ${rerun}`,
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
function verdictStops(v: CloseVerdictRead, repo: string, n: number, rerun: string): CloseStop[] {
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

/** What the command prints, and its exit code: 0 when every gate passed, 1 on a stop. */
export function renderCloseOutcome(outcome: CloseOutcome): { stdout: string[]; stderr: string[]; exitCode: number } {
    if (outcome.ok) return { stdout: outcome.lines, stderr: [], exitCode: 0 };
    const err: string[] = [`nexus close stopped: ${outcome.stops.length} thing${outcome.stops.length === 1 ? "" : "s"} to fix. Nothing was created or written.`];
    for (const s of outcome.stops) {
        err.push("", `STOP`, `  reason: ${s.reason}`, `  item:   ${s.item}`, `  remedy: ${s.remedy}`);
        if (s.post !== undefined) {
            err.push(`  comment to post on ${s.post.on}:`, "", ...s.post.comment.split("\n").map((l) => `    ${l}`));
        }
    }
    return { stdout: [], stderr: err, exitCode: 1 };
}

/** The platform-backed reads, against the checkout at `root`. */
export function closeCommandDeps(run: Runner, opts: { singleRepo: (root: string) => boolean }): CloseCommandDeps {
    return {
        role: (cwd) => closePreflight(cwd, run),
        readPr: (repoRoot, pr) => resolvePr(run, repoRoot, pr, { requireMerged: false }),
        issuesRepo: (root) => resolveVerdictRepos(run, root),
        storiesOfPr: (root, issuesRepo, pr) => {
            const kinds = resolveKindClassification(root);
            if (!kinds.ok) return { ok: false, error: { problem: "classification-mode-mismatch", message: kinds.error.message } };
            const prSlug = resolveRepoSlug(run, root);
            const slash = issuesRepo.lastIndexOf("/");
            const slug = { owner: issuesRepo.slice(0, slash).split("/").pop() ?? "", repo: issuesRepo.slice(slash + 1) };
            return resolveStories(run, root, slug, kinds.classification, {
                prRepo: prSlug.ok ? `${prSlug.slug.owner}/${prSlug.slug.repo}` : undefined,
                closingIssues: pr.closingIssues,
                commitMessages: pr.commitMessages,
                branchName: pr.headRef,
                prBody: pr.body,
            });
        },
        resolveEpic: (root, epic) => resolveEpic(run, root, epic, { requireEpic: false, singleRepo: opts.singleRepo(root) }),
        subIssues: (root, issuesRepo, epic) => {
            const slash = issuesRepo.lastIndexOf("/");
            const slug = { owner: issuesRepo.slice(0, slash).split("/").pop() ?? "", repo: issuesRepo.slice(slash + 1) };
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
            const slug = issuesRepo.split("/").slice(-2).join("/");
            const r = run("gh", ["api", "--method", "POST", `repos/${slug}/issues/${issue}/comments`, "-f", `body=${body}`], { cwd: root });
            return r.status === 0 ? { ok: true } : { ok: false, message: r.stderr.trim() || "gh api failed" };
        },
    };
}
