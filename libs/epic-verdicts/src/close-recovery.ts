/**
 * `nexus close --recover <epic>` — re-stamp a closed epic whose decision record was revised (epic
 * #830, story #867, decision record #872: D13, Mechanism step 11; G30–G33).
 *
 * A closed epic's close record stamps the digest of the record body it was written against. When
 * the record is revised after close, that stamp no longer matches, and distill refuses the entry —
 * with no drain-side waiver. Code cannot tell a wording change from a design change, so recovery
 * reads that judgment from where a person or analyze already gave it, per merged pull request:
 *
 * - its newest verdict was judged against the current revision: Key Decisions and its Deviation
 *   Rationale entries are rebuilt from that verdict;
 * - a trusted waiver on it accepts the current revision (#849's revised-record waiver, read through
 *   #849's one reader): its Deviation Rationale entries are kept as they are;
 * - neither: recovery stops and names both remedies — re-running analyze on it, or the exact waiver.
 *
 * Key Decisions always takes the record's decisions from the new body, then the stubs the verdicts
 * confirmed (D5). Recovery then re-stamps `record_hash` and the `analyze:` value (D7), commits the
 * entry on its distill branch, pushes it, and posts a fresh close comment, so distill's recovery
 * from the epic issue — which takes the newest trusted close comment — finds the new hash.
 *
 * Recovery changes only Key Decisions, Deviation Rationale, `analyze:` and `record_hash` (G32): the
 * entry and the comment are the earlier close's text with those four replaced, so the range, the
 * deferred scope, the waived stories and every other stamp stay byte for byte. It files nothing and
 * amends nothing. Every check runs before anything is created or written (G3), every stop names its
 * reason, item and remedy (G4), and copied text is made inert by close's own renderers (D8).
 *
 * A re-run finishes a partial recovery: an entry already carrying the new hash is not rewritten,
 * and a newest close comment already carrying it is not posted again.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { matchRecordWaiver, readPrWaivers, type PrWaivers } from "@nexus/pr-acceptance/waiver";
import { findEpicDistillBranch, type EpicDistillWorktreeResult } from "@nexus/pr-worktree/worktree";
import { fetchRecord } from "@nexus/record-digest/fetch";
import { canonicalRemote } from "@nexus/workspace/canonical-remote";
import { git } from "@nexus/workspace/run";
import { type PreflightResult } from "@nexus/workspace/close-role";
import { sameRepo } from "@nexus/workspace/issue-ref";
import { closeCommandDeps, describeRejected, linkedEpic, verdictStops, waiverComment, type CloseStop, type CloseVerdictRead } from "./close-command.js";
import { assembleCloseContent, CLOSE_RECORD_MARKER, findEpicCloseComment, OWN_MARKER_RE, recordNumber, renderDeviationRationale, renderKeyDecisions, scalar, stampedPrs, type CloseContent, type CloseVerdict } from "./close-record.js";
import { type AppliedWaiver } from "./close-ranges.js";
import { inertLines } from "./close-text.js";
import { type Runner } from "./run.js";
import { type ResolveVerdictReposResult, canonicalIssuesRepo, issuesRepoPath, onIssuesHost } from "./verdict-repos.js";

/** What the lead passed: the closed epic, plus today's date for a distill branch cut from the trunk. */
export interface RecoverInput {
    cwd: string;
    epic: number;
    /** Today, as YYYY-MM-DD. */
    date: string;
}

/** Where the earlier close left the epic's entry, asked before anything is created. */
export type EntryLocation = { ok: true; at: "branch"; branch: string } | { ok: true; at: "trunk" } | { ok: true; at: "none" } | { ok: false; message: string };

/** The reads and writes recovery depends on, injected so a spec can stand in for them. */
export interface CloseRecoveryDeps {
    role(cwd: string): PreflightResult;
    issuesRepo(root: string): ResolveVerdictReposResult;
    /** The comments on an issue, oldest first, with each author's association. */
    issueComments(root: string, issuesRepo: string, issue: number): { ok: true; comments: { body: string; authorAssociation: string }[] } | { ok: false; message: string };
    /** The record's current body, its digest through the one digest implementation, and whether it is approved. */
    record(
        root: string,
        issuesRepo: string,
        record: number,
    ): { ok: true; body: string; digest: string; approved: boolean; state: "open" | "closed"; stateReason: string | null } | { ok: false; message: string };
    /** The newest verdict on a merged pull request, read as close reads it. */
    verdict(root: string, issuesRepo: string, pr: { repo: string; pr: number }): CloseVerdictRead;
    /** The waiver comments on a pull request, through #849's one waiver reader. */
    prWaivers(root: string, pr: { repo: string; pr: number }): { ok: true; waivers: PrWaivers } | { ok: false; message: string };
    /** Read-only: the distill branch an earlier close left, else a committed entry on the trunk, else none. */
    findEntry(repoRoot: string, epic: number): EntryLocation;
    openWorktree(repoRoot: string, epic: number, date: string): EpicDistillWorktreeResult;
    commitEntry(wtPath: string, files: string[], message: string): { ok: true; committed: boolean } | { ok: false; message: string };
    push(wtPath: string, branch: string): { ok: true } | { ok: false; message: string };
    postComment(root: string, issuesRepo: string, issue: number, body: string): { ok: true } | { ok: false; message: string };
}

export type RecoveryOutcome = { ok: true; lines: string[]; recordPath: string | null; closeComment: string | null } | { ok: false; stops: CloseStop[]; done?: string[] };

const stopped = (...stops: CloseStop[]): RecoveryOutcome => ({ ok: false, stops });
const stoppedAfter = (done: string[], ...stops: CloseStop[]): RecoveryOutcome => ({ ok: false, stops, done: [...done] });

/** A merged pull request, by its repository and number. */
type Pr = { repo: string; pr: number };

/** How one merged pull request clears the revision: a verdict judged against it, or a waiver accepting it. */
type Cleared = { pr: { repo: string; pr: number }; by: "verdict"; verdict: CloseVerdict } | { pr: { repo: string; pr: number }; by: "waiver"; verdict: CloseVerdict; waiver: AppliedWaiver & { cause: "record-revised" } };

/** Run recovery. Asks nothing; every outcome is returned. */
export function runCloseRecovery(deps: CloseRecoveryDeps, input: RecoverInput): RecoveryOutcome {
    const rerun = `nexus close --recover ${input.epic}`;

    // Resolve, read-only.
    const role = deps.role(input.cwd);
    if (!role.ok) return stopped({ reason: role.error.message, item: input.cwd, remedy: `run ${rerun} from inside a single-repo checkout or a workspace hub` });
    const { repoRoot } = role.preflight;
    if (role.preflight.role === "member") {
        return stopped({ reason: "this checkout is a member of a workspace; close runs only from a single-repo checkout or the hub", item: repoRoot, remedy: `run ${rerun} from the workspace hub` });
    }
    const repos = deps.issuesRepo(repoRoot);
    if (!repos.ok) return stopped({ reason: repos.error.message, item: repoRoot, remedy: `fix the checkout's remote or the configured epic-repo, then re-run ${rerun}` });
    const issuesRepo = canonicalIssuesRepo(repos.repos.issuesRepo);
    const codeRepo = repos.repos.repo;
    const epicRef = `${issuesRepo}#${input.epic}`;

    // The earlier close: the epic's own close comment, the one close resumes from, through the same finder.
    const comments = deps.issueComments(repoRoot, issuesRepo, input.epic);
    if (!comments.ok) return stopped({ reason: `the comments on epic ${epicRef} could not be read: ${comments.message}`, item: `epic ${epicRef}`, remedy: `re-run ${rerun} once the read succeeds` });
    const earlier = findEpicCloseComment(comments.comments, input.epic, issuesRepo);
    if (earlier.found === "none") {
        return stopped({
            reason: `epic ${epicRef} carries no close comment from someone who can speak for ${issuesRepo}, so it was never closed; recovery re-stamps a closed epic`,
            item: `epic ${epicRef}`,
            remedy: `close it with nexus close --epic ${input.epic}`,
        });
    }
    if (earlier.found === "unreadable") {
        return stopped({ reason: `the close comment on epic ${epicRef} cannot be read as this epic's: ${earlier.why}`, item: `epic ${epicRef}`, remedy: `check that comment: correct its machine block if it is this epic's close, or remove its marker if it is a copy; then re-run ${rerun}` });
    }
    const { body: closeComment, block } = earlier;
    const record = recordNumber(block["record"]);
    if (record === null) {
        return stopped({ reason: `the close comment on epic ${epicRef} names no decision record, so there is no record hash to re-stamp`, item: `epic ${epicRef}`, remedy: "nothing to recover: distill reads an epic with no record from its close record alone" });
    }
    const recordRef = `${issuesRepo}#${record}`;

    // Gate, read-only. Every check runs, so one pass names everything to fix.
    const current = deps.record(repoRoot, issuesRepo, record);
    if (!current.ok) return stopped({ reason: `the decision record ${recordRef} could not be read: ${current.message}`, item: `record ${recordRef}`, remedy: `re-run ${rerun} once the read succeeds` });
    if (!current.approved) {
        const how = current.state === "open" ? "it is open" : `it was closed as ${current.stateReason ?? "not completed"}`;
        return stopped({
            reason: `the decision record ${recordRef} is not approved (${how}), so its revision has no approved body to stamp`,
            item: `record ${recordRef}`,
            remedy: `approve the revision by closing ${recordRef} as completed (/nxs.decision-record --revise ends with that), then re-run ${rerun}`,
        });
    }
    const digest = current.digest;

    const { prs, unnamed } = stampedPrs(block);
    const stops: CloseStop[] = [];
    if (unnamed > 0) {
        stops.push({
            reason: `the close comment's range names ${unnamed} entr${unnamed === 1 ? "y" : "ies"} with no pull request, so recovery cannot tell which verdict judged it`,
            item: `epic ${epicRef}`,
            remedy: `re-run /nxs.analyze --pr <N> on each merged pull request, then re-stamp record_hash in the entry's close-record.md by hand with nexus record-digest --issue ${record} --repo ${issuesRepo}`,
        });
    }
    const cleared: Cleared[] = [];
    for (const pr of prs) {
        const ref = `${pr.repo}#${pr.pr}`;
        const item = `pull request ${ref}`;
        const read = deps.verdict(repoRoot, issuesRepo, pr);
        const verdictProblems = verdictStops(read, pr.repo, pr.pr, rerun);
        stops.push(...verdictProblems);
        if (!read.ok) continue;
        if (read.found && read.judgments === "present" && read.recordHash === digest) {
            if (verdictProblems.length === 0) cleared.push({ pr, by: "verdict", verdict: { ...pr, date: read.date, head: read.head, recordHash: read.recordHash, judgments: read.read } });
            continue;
        }
        const waivers = deps.prWaivers(repoRoot, pr);
        if (!waivers.ok) {
            stops.push({ reason: `the waiver comments on ${ref} could not be read: ${waivers.message}. A failed read is not the same as no waiver`, item, remedy: `re-run ${rerun} once the read succeeds` });
            continue;
        }
        // A waiver names the record as owner/repo#N, the one form the waiver reader parses.
        const match = matchRecordWaiver(waivers.waivers, record, digest, issuesRepoPath(issuesRepo));
        if (match.applied === null) {
            stops.push({
                reason: `${ref} has neither a verdict judged against the current revision of ${recordRef} (${digest}) nor a trusted waiver accepting it${match.rejected.map((w) => `; ${describeRejected(w)}`).join("")}`,
                item,
                remedy: `run /nxs.analyze --pr ${pr.pr} on ${ref}, or post this waiver comment on ${ref} as someone who can speak for the repository; then re-run ${rerun}`,
                post: { on: ref, comment: waiverComment(["waive: record-revised", `record: "${issuesRepoPath(issuesRepo)}#${record}"`, `digest: ${digest}`]) },
            });
            continue;
        }
        if (!read.found) {
            stops.push({ reason: `${ref} carries no verdict, so recovery has no key decisions to read from it`, item, remedy: `run a full /nxs.analyze --pr ${pr.pr} on ${ref}, then re-run ${rerun}` });
            continue;
        }
        if (read.judgments !== "present" || verdictProblems.length > 0) continue;
        const w = match.applied;
        cleared.push({
            pr,
            by: "waiver",
            verdict: { ...pr, date: read.date, head: read.head, recordHash: read.recordHash, judgments: read.read },
            waiver: { repo: pr.repo, pr: pr.pr, author: w.author, url: w.url, at: w.at, reason: w.waiver.ok ? w.waiver.reason : null, stories: [], cause: "record-revised", record, digest },
        });
    }

    const location = deps.findEntry(repoRoot, input.epic);
    if (!location.ok) stops.push({ reason: `where the earlier close left the entry of epic ${epicRef} could not be read: ${location.message}`, item: repoRoot, remedy: `re-run ${rerun} once the read succeeds` });
    if (stops.length > 0 || !location.ok) return { ok: false, stops };

    // Assemble in memory, from the new body and the verdicts (D5, D6, D7).
    const content = assembleCloseContent({
        epic: input.epic,
        title: "",
        feature: "",
        featurePath: "",
        date: input.date,
        nexusVersion: null,
        issuesRepo,
        codeRepo,
        record: { number: record, body: current.body, digest },
        verdicts: cleared.map((c) => c.verdict),
        ranges: { range: [], stories: [], landed: [], waivers: cleared.flatMap((c) => (c.by === "waiver" ? [c.waiver] : [])) },
    });
    const rejudged = cleared.filter((c) => c.by === "verdict").map((c) => c.pr);
    const commentStamped = String(block["record_hash"] ?? "") === digest;
    const freshComment = commentStamped ? null : restampComment(closeComment, content, prs, rejudged);

    // The entry, then the comment (D11's order: a pushed entry before the durable copy).
    const done: string[] = [];
    let recordPath: string | null = null;
    let entryLine: string;
    let wtPath: string | null = null;
    if (location.at === "none") {
        entryLine = "none left: no distill branch and no committed entry; the fresh close comment is the copy distill recovers from";
    } else {
        const wt = deps.openWorktree(repoRoot, input.epic, input.date);
        if (!wt.ok) return stopped({ reason: wt.error.message, item: repoRoot, remedy: `re-run ${rerun} once the cause above is fixed` });
        wtPath = wt.wtPath;
        done.push(`distill branch ${wt.branch} checked out at ${wt.wtPath}`);
        const again = `re-run ${rerun}; it reuses ${wt.branch} and repeats nothing already done`;
        const dir = findEntryDir(wt.wtPath, input.epic);
        if (dir === null) {
            return stoppedAfter(done, {
                reason: `${wt.branch} holds no close record for epic ${epicRef}`,
                item: `branch ${wt.branch}`,
                remedy: `if distill already drained the entry, nothing is left to re-stamp; otherwise run /nxs.distill --recover ${input.epic} once the epic's close comment carries the new hash`,
            });
        }
        recordPath = path.join(dir, "close-record.md");
        const before = fs.readFileSync(recordPath, "utf8");
        const restamped = entryHash(before) !== digest;
        if (restamped) {
            const after = restampRecord(before, content, prs, rejudged);
            if (after === null) {
                return stoppedAfter(done, { reason: `${recordPath} has no frontmatter with a record_hash to re-stamp`, item: recordPath, remedy: `re-stamp it by hand with nexus record-digest --issue ${record} --repo ${issuesRepo}, then re-run ${rerun}` });
            }
            fs.writeFileSync(recordPath, after);
            const commit = deps.commitEntry(wt.wtPath, [recordPath], `close: epic-${input.epic} — re-stamp record #${record} at ${digest.slice(0, 12)}`);
            if (!commit.ok) return stoppedAfter(done, { reason: `the re-stamped close record could not be committed on ${wt.branch}: ${commit.message}`, item: recordPath, remedy: `fix the cause above, then ${again}` });
        }
        // Pushed whenever the comment is still to post: an earlier run's push may be the step that failed.
        if (restamped || freshComment !== null) {
            const pushed = deps.push(wt.wtPath, wt.branch);
            if (!pushed.ok) {
                return stoppedAfter([...done, `committed the re-stamped close record on ${wt.branch}`], {
                    reason: `the distill branch ${wt.branch} could not be pushed: ${pushed.message}. No fresh close comment was posted`,
                    item: `branch ${wt.branch}`,
                    remedy: `fix the cause above, then ${again} and pushes the branch`,
                });
            }
            done.push(`committed and pushed the close record on ${wt.branch}, stamped with ${digest}`);
        }
        entryLine = restamped ? `${recordPath} (re-stamped, committed on ${wt.branch} and pushed)` : `${recordPath} (already carries the new hash)`;
    }

    let commentLine: string;
    if (freshComment === null) {
        commentLine = `the newest close comment on ${epicRef} already carries the new hash; nothing posted`;
    } else {
        const posted = deps.postComment(repoRoot, issuesRepo, input.epic, freshComment);
        if (!posted.ok) {
            return stoppedAfter(done, {
                reason: `the fresh close comment did not post on epic ${epicRef}: ${posted.message}. Distill's recovery from the epic issue still reads the old hash`,
                item: `epic ${epicRef}`,
                remedy: `re-run ${rerun}; it rebuilds the same comment and posts it`,
            });
        }
        commentLine = `posted on ${epicRef}, stamped with ${digest}`;
    }

    const lines = [
        `RECORD RE-STAMPED: epic ${epicRef}`,
        "",
        `nexus close --recover: decision record ${recordRef} is stamped at ${digest}${commentStamped ? "" : ` (was ${String(block["record_hash"] ?? "none")})`}.`,
        "",
        ...cleared.map((c) =>
            c.by === "verdict"
                ? `Pull request:      ${c.pr.repo}#${c.pr.pr} — verdict judged against the current revision (ran ${c.verdict.date} @ ${c.verdict.head}); its key decisions and departures rebuilt`
                : `Pull request:      ${c.pr.repo}#${c.pr.pr} — waiver accepting the current revision by @${c.waiver.author || "unknown"} (${c.waiver.url}); its departures kept`,
        ),
        `Key decisions:     ${content.keyDecisions.length} (${content.keyDecisions.filter((d) => d.kind !== "stub").length} from the record's new body, ${content.keyDecisions.filter((d) => d.kind === "stub").length} confirmed stub(s))`,
        `Analyze:           ${content.analyze}`,
        `Close record:      ${entryLine}`,
        `Close comment:     ${commentLine}`,
        "Unchanged:         range, story ranges, landed checks, waivers, deferred scope and waived stories; nothing filed, nothing amended.",
        ...content.notes,
        "",
        ...(wtPath === null
            ? ["NEXT — rebuild the entry from the fresh close comment:", `    /nxs.distill --recover ${input.epic}`]
            : ["NEXT — continue the drain from the worktree:", `    cd ${wtPath} && /nxs.distill`]),
    ];
    return { ok: true, lines, recordPath, closeComment: freshComment };
}

/** The close record's directory inside the worktree: the epic-keyed entry, else the entry whose `epic.md` links the epic. */
function findEntryDir(wtPath: string, epic: number): string | null {
    const queue = path.join(wtPath, ".nexus", "queue");
    const keyed = path.join(queue, `epic-${epic}`);
    if (fs.existsSync(path.join(keyed, "close-record.md"))) return keyed;
    const dirs = fs.existsSync(queue) ? fs.readdirSync(queue, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort() : [];
    for (const name of dirs) {
        const dir = path.join(queue, name);
        const md = path.join(dir, "epic.md");
        if (fs.existsSync(md) && fs.existsSync(path.join(dir, "close-record.md")) && linkedEpic(fs.readFileSync(md, "utf8")) === epic) return dir;
    }
    return null;
}

/** The `record_hash` a close record's frontmatter stamps, or null. */
function entryHash(text: string): string | null {
    const fm = /^---\n([\s\S]*?)\n---/.exec(text);
    if (fm === null) return null;
    const line = /^record_hash:\s*(\S+)\s*$/m.exec(fm[1]);
    return line === null ? null : line[1].replace(/^["']|["']$/g, "");
}

/** Replace a top-level `key:` line in `lines[from, to)`; when absent, insert it after the `after` key, else at `to`. */
function setKey(lines: string[], from: number, to: number, key: string, value: string, after: string): void {
    const find = (k: string): number => lines.slice(from, to).findIndex((l) => l.startsWith(`${k}:`));
    const at = find(key);
    if (at >= 0) lines[from + at] = `${key}: ${value}`;
    else lines.splice(find(after) >= 0 ? from + find(after) + 1 : to, 0, `${key}: ${value}`);
}

/** Where a section's heading is and where its body ends: the next heading at its level or above, or the machine block. */
function sectionAt(lines: string[], heading: string): { start: number; end: number } | null {
    const start = lines.findIndex((l) => l.trim() === heading);
    if (start < 0) return null;
    const level = (/^#+/.exec(heading) ?? [""])[0].length;
    const next = new RegExp(`^#{1,${level}} `);
    let end = start + 1;
    while (end < lines.length && !next.test(lines[end]) && lines[end].trim() !== CLOSE_RECORD_MARKER) end++;
    return { start, end };
}

/**
 * Set a section's body, or remove the section when `body` is null. A missing section is inserted
 * before the first of `before` that is present, else before the machine block, else at the end.
 */
function setSection(lines: string[], heading: string, body: string[] | null, before: string[]): string[] {
    const at = sectionAt(lines, heading);
    const block = body === null ? [] : [heading, "", ...body, ""];
    if (at !== null) return [...lines.slice(0, at.start), ...block, ...lines.slice(at.end)];
    if (body === null) return lines;
    let i = -1;
    for (const b of [...before, CLOSE_RECORD_MARKER]) {
        i = lines.findIndex((l) => l.trim() === b);
        if (i >= 0) break;
    }
    if (i < 0) i = lines.length;
    return [...lines.slice(0, i), ...block, ...lines.slice(i)];
}

/** The bullets of a section's body, each with its continuation lines; text before the first bullet is dropped. */
function bullets(lines: string[], heading: string): string[][] {
    const at = sectionAt(lines, heading);
    if (at === null) return [];
    const out: string[][] = [];
    for (const l of lines.slice(at.start + 1, at.end)) {
        if (l.startsWith("- ")) out.push([l]);
        else if (out.length > 0) out[out.length - 1].push(l);
    }
    return out.map((b) => {
        while (b.length > 0 && b[b.length - 1].trim() === "") b.pop();
        return b;
    });
}

/** The pull request a Deviation Rationale bullet names, as close writes it: `— <repo>#<pr> <ID>.**`. */
function bulletPr(bullet: string[]): Pr | null {
    const m = / — (\S+)#(\d+) [A-Z]+\d+\.\*\*/.exec(bullet[0] ?? "");
    return m === null ? null : { repo: m[1], pr: Number(m[2]) };
}

/**
 * The Deviation Rationale after recovery (D13): a waived pull request's bullets kept as they were,
 * a re-judged one's rebuilt from its verdict, in merge order. With nothing re-judged, the section
 * is left alone. Kept text passes through the inert filter too, so no copy can carry a marker or a
 * fence (D8). A kept bullet that names no merged pull request stays first, as it stood.
 */
function deviationBody(lines: string[], heading: string, content: CloseContent, prs: readonly Pr[], rejudged: readonly Pr[]): string[] | "unchanged" {
    if (rejudged.length === 0) return "unchanged";
    const same = (a: Pr, b: Pr | null): boolean => b !== null && a.pr === b.pr && sameRepo(a.repo, b.repo);
    const kept = bullets(lines, heading).map((b) => ({ pr: bulletPr(b), lines: b.flatMap((l) => inertLines(l)) }));
    const out: string[] = kept.filter((k) => !prs.some((p) => same(p, k.pr))).flatMap((k) => k.lines);
    for (const p of prs) {
        if (rejudged.some((r) => same(r, p))) out.push(...renderDeviationRationale({ ...content, deviations: content.deviations.filter((d) => same(p, d)) }));
        else out.push(...kept.filter((k) => same(p, k.pr)).flatMap((k) => k.lines));
    }
    return out;
}

/** The close record with only Key Decisions, Deviation Rationale, `analyze:` and `record_hash` replaced (G32). */
function restampRecord(text: string, content: CloseContent, prs: readonly Pr[], rejudged: readonly Pr[]): string | null {
    let lines = text.split("\n");
    if (lines[0] !== "---") return null;
    const close = lines.indexOf("---", 1);
    if (close < 0 || !lines.slice(1, close).some((l) => l.startsWith("record_hash:"))) return null;
    setKey(lines, 1, close, "record_hash", content.record?.digest ?? "", "record");
    setKey(lines, 1, lines.indexOf("---", 1), "analyze", scalar(content.analyze), "date");
    lines = setSection(lines, "## Key Decisions", renderKeyDecisions(content), ["## Deviation Rationale", "## Waived Stories", "## Deferred Scope"]);
    const dr = deviationBody(lines, "## Deviation Rationale", content, prs, rejudged);
    if (dr !== "unchanged") lines = setSection(lines, "## Deviation Rationale", dr.length === 0 ? ["none"] : dr, ["## Waived Stories", "## Deferred Scope"]);
    return lines.join("\n");
}

/** The earlier close comment with only the same four things replaced, and its prose lines that state them. */
function restampComment(text: string, content: CloseContent, prs: readonly Pr[], rejudged: readonly Pr[]): string {
    // A comment saved by the web editor has CRLF endings; rewrite it with one kind throughout.
    let lines = text.replace(/\r\n/g, "\n").split("\n");
    const digest = content.record?.digest ?? "";
    const recordLine = `Decision record: #${content.record?.number ?? ""} @ \`${digest}\``;
    const d = lines.findIndex((l) => l.startsWith("Decision record: "));
    if (d >= 0) lines[d] = recordLine;
    const c = lines.findIndex((l) => l.startsWith("Conformance: "));
    if (c >= 0) {
        if (content.conformance === null) lines.splice(c, lines[c + 1] === "" ? 2 : 1);
        else lines[c] = `Conformance: ${content.conformance}`;
    } else if (content.conformance !== null) {
        const after = lines.findIndex((l) => l.startsWith("Decision record: "));
        lines.splice(after >= 0 ? after + 2 : Math.min(4, lines.length), 0, `Conformance: ${content.conformance}`, "");
    }
    lines = setSection(lines, "### Key Decisions", renderKeyDecisions(content), ["### Deviation Rationale", "### Pointers (durable)"]);
    const dr = deviationBody(lines, "### Deviation Rationale", content, prs, rejudged);
    if (dr !== "unchanged") lines = setSection(lines, "### Deviation Rationale", dr.length === 0 ? null : dr, ["### Pointers (durable)"]);

    // The machine block: the block machineBlock reads, under the first own marker line with a fence
    // right below it. A bare marker line above it, or copied text, is passed over.
    const marker = lines.findIndex((l, i) => OWN_MARKER_RE.test(l) && l.trim() === CLOSE_RECORD_MARKER && /^```ya?ml$/.test(lines[i + 1] ?? ""));
    const open = marker + 1;
    const end = lines.findIndex((l, i) => i > open && l.startsWith("```"));
    if (marker >= 0 && end > open) {
        setKey(lines, open + 1, end, "record_hash", digest, "record");
        const end2 = lines.findIndex((l, i) => i > open && l.startsWith("```"));
        setKey(lines, open + 1, end2, "analyze", scalar(content.analyze), "record_hash");
    }
    return lines.join("\n");
}

/**
 * The committed entry for `epic` on the trunk, read without a worktree or a fetch: the epic-keyed
 * directory, else the directory whose `epic.md` links the epic, holding a `close-record.md`.
 */
function trunkEntry(run: Runner, repoRoot: string, epic: number): boolean {
    const remote = canonicalRemote(run, repoRoot);
    const trunk = git(run, repoRoot, "rev-parse", "--verify", `${remote}/main`) ?? git(run, repoRoot, "rev-parse", "--verify", "main");
    if (trunk === null) return false;
    const files = (git(run, repoRoot, "ls-tree", "-r", "--name-only", trunk, "--", ".nexus/queue") ?? "").split("\n").map((l) => l.trim());
    const dirs = files.filter((f) => /^\.nexus\/queue\/[^/]+\/close-record\.md$/.test(f)).map((f) => path.posix.dirname(f));
    return dirs.some((d) => d === `.nexus/queue/epic-${epic}` || (files.includes(`${d}/epic.md`) && linkedEpic(git(run, repoRoot, "show", `${trunk}:${d}/epic.md`) ?? "") === epic));
}

/** The platform-backed reads and writes, against the checkout at `root`. Close's own where they are the same. */
export function closeRecoveryDeps(run: Runner): CloseRecoveryDeps {
    const close = closeCommandDeps(run, { singleRepo: () => true });
    return {
        role: close.role,
        issuesRepo: close.issuesRepo,
        issueComments: close.issueComments,
        record: (root, issuesRepo, record) => {
            const r = fetchRecord(onIssuesHost(run, issuesRepo), root, record, issuesRepoPath(issuesRepo));
            return r.ok
                ? { ok: true, body: r.record.body, digest: r.record.digest, approved: r.record.approved, state: r.record.state, stateReason: r.record.stateReason }
                : { ok: false, message: r.error.message };
        },
        verdict: close.verdict,
        prWaivers: (root, pr) => {
            const r = readPrWaivers(run, root, pr.pr, { ghRepo: pr.repo });
            return r.ok ? { ok: true, waivers: r.value } : { ok: false, message: r.error.message };
        },
        findEntry: (repoRoot, epic) => {
            const branch = findEpicDistillBranch(run, repoRoot, epic);
            if (!branch.ok) return { ok: false, message: branch.error.message };
            if (branch.branch !== null) return { ok: true, at: "branch", branch: branch.branch };
            return trunkEntry(run, repoRoot, epic) ? { ok: true, at: "trunk" } : { ok: true, at: "none" };
        },
        openWorktree: close.openWorktree,
        commitEntry: close.commitEntry,
        push: close.push,
        postComment: close.postComment,
    };
}
