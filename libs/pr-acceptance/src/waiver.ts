/**
 * The one trusted waiver reader (epic #828, story #856, decision record #849, D11).
 *
 * Close stops on two stale causes that a lead may knowingly accept: a reviewed file that did not
 * land as reviewed, and a decision record revised after the analysis. The lead accepts them by
 * posting a comment on the pull request before close runs, in a fixed form, and close reads that
 * comment here. Close never asks for a waiver and never reads comment threads by hand.
 *
 * The form is a marker followed by a fenced block, the shape the analyze receipt already uses:
 *
 *     <!-- nexus:close-waiver -->
 *     ```yaml
 *     waive: landed-change
 *     files:
 *       - src/a.ts
 *     reason: <optional, one line>
 *     ```
 *
 *     <!-- nexus:close-waiver -->
 *     ```yaml
 *     waive: record-revised
 *     record: "#849"
 *     digest: <the record's full current digest>
 *     reason: <optional, one line>
 *     ```
 *
 * A waiver covers only what it names. A landed-change waiver must name every changed file, or it
 * clears nothing. A revised-record waiver accepts one revision, so a later revision stops close
 * again. No other cause can be waived this way.
 *
 * Trust is the receipt reader's rule (`maintainerAuthored`), not a second copy of it: a comment
 * counts only from an author who can speak for the repository. An untrusted or unreadable waiver is
 * reported, never dropped, so the lead can see why it cleared nothing. The reader only reads; which
 * waiver clears which stop is the matchers' answer.
 *
 * The same read also yields the **answers** on the pull request (epic #829, story #860, decision
 * record #871, D3). An engineer answers an item a verdict lists — a departure, a finding or a
 * deferred-scope proposal — with one line per answer, and a comment may hold several:
 *
 *     DV2 — accepted: the platform has no batch endpoint, so one call per item is the only option
 *     F1 — waived: the flaky check is tracked in #901
 *     DS1 — approved
 *
 * The ID, a dash, a verb, a colon and a reason. There is no second comment reader: an answer line
 * is read here, from the same comments, with the same trust rule. Which answer applies to which
 * item is the item registry's question, not this reader's. A comment that carries either verdict
 * marker is never read for answers, so a verdict published as a comment cannot answer itself.
 */

import { parseIssueRef, sameRepo } from "@nexus/workspace/issue-ref";
import { type Result, fail, ok } from "./diagnostic.js";
import { JUDGMENTS_MARKER } from "./judgments-block.js";
import { RECEIPT_MARKER, maintainerAuthored, newestReceiptBlock } from "./receipt-blocks.js";
import { type Runner } from "./run.js";

/** The comment marker a waiver is posted under. */
export const WAIVER_MARKER = "<!-- nexus:close-waiver -->";

/** The stale causes a waiver comment can clear. */
export type WaiverCause = "landed-change" | "record-revised";

/** What a waiver says it accepts. */
export type WaiverTerms =
    /** The reviewed files that did not land as reviewed, by path. */
    | { cause: "landed-change"; files: string[] }
    /** The record revision accepted: the record reference as written, and its full digest, lowercased. */
    | { cause: "record-revised"; record: string; digest: string };

/** A waiver block as parsed: its terms, or why it could not be read. */
export type ParsedWaiver = { ok: true; terms: WaiverTerms; reason: string | null } | { ok: false; problem: string };

/** One waiver comment on the pull request. */
export interface WaiverComment {
    /** The author's login, or "" when the platform stated none. */
    author: string;
    /** The comment's own link. */
    url: string;
    /** The platform's timestamp on the comment. */
    at: string;
    /** Whether its author can speak for the repository, by the receipt reader's rule. */
    trusted: boolean;
    waiver: ParsedWaiver;
}

/** The verbs an answer line carries. Each fits one kind of item: departure, finding, deferred scope. */
export type AnswerVerb = "accepted" | "waived" | "approved";

/** One answer line as written: the ID it names, its verb, and its reason ("" when it gave none). */
export interface AnswerLine {
    id: string;
    verb: AnswerVerb;
    reason: string;
}

/** One answer line on the pull request, with the comment it was read from. */
export interface PrAnswer extends AnswerLine {
    author: string;
    url: string;
    at: string;
    /** Whether its author can speak for the repository, by the receipt reader's rule. */
    trusted: boolean;
}

export interface PrWaivers {
    pr: number;
    /** Every comment carrying the waiver marker, in the order the platform returned them. */
    comments: WaiverComment[];
    /** Every answer line in the pull request's comments, trusted or not, in the order they were read. */
    answers: PrAnswer[];
}

/** Why a waiver comment cleared nothing. */
export type RejectedWaiver =
    | { author: string; url: string; why: "untrusted" }
    | { author: string; url: string; why: "malformed"; problem: string }
    | { author: string; url: string; why: "incomplete"; uncovered: string[] }
    | { author: string; url: string; why: "other-revision"; record: string; digest: string };

/** The waiver applied to one stop, if any, and every waiver comment that tried and cleared nothing. */
export interface WaiverMatch {
    applied: WaiverComment | null;
    rejected: RejectedWaiver[];
}

const unquote = (v: string): string => v.trim().replace(/^["']|["']$/g, "");

/** The fenced block after the waiver marker in `body`: null with no marker, a problem with no block. */
function waiverFence(body: string): string | { problem: string } | null {
    const i = body.indexOf(WAIVER_MARKER);
    if (i < 0) return null;
    const fence = /```(?:yaml)?\s*\n([\s\S]*?)```/.exec(body.slice(i + WAIVER_MARKER.length));
    return fence === null ? { problem: "no fenced block follows the waiver marker" } : fence[1];
}

/** Parse the waiver block in `body`. Null when the body carries no waiver marker. */
export function parseWaiverBlock(body: string): ParsedWaiver | null {
    const block = waiverFence(body);
    if (block === null) return null;
    if (typeof block !== "string") return { ok: false, problem: block.problem };

    const fields = new Map<string, string>();
    const files: string[] = [];
    let inFiles = false;
    for (const line of block.split("\n")) {
        const item = /^\s+-\s+(.+?)\s*$/.exec(line);
        if (item && inFiles) {
            files.push(unquote(item[1]));
            continue;
        }
        const m = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*?)\s*$/.exec(line);
        if (m === null) continue;
        inFiles = m[1] === "files";
        if (inFiles && m[2].startsWith("[")) files.push(...m[2].replace(/^\[|\]$/g, "").split(",").map(unquote).filter((f) => f.length > 0));
        else fields.set(m[1], unquote(m[2]));
    }

    const reason = fields.get("reason") || null;
    const waive = fields.get("waive") ?? "";
    if (waive === "landed-change") {
        if (files.length === 0) return { ok: false, problem: "a landed-change waiver names no file under `files:`" };
        return { ok: true, terms: { cause: "landed-change", files: [...new Set(files)] }, reason };
    }
    if (waive === "record-revised") {
        const record = fields.get("record") ?? "";
        const digest = (fields.get("digest") ?? "").toLowerCase();
        if (record === "" || digest === "") return { ok: false, problem: "a record-revised waiver must name both `record:` and `digest:`" };
        return { ok: true, terms: { cause: "record-revised", record, digest }, reason };
    }
    if (waive === STORYLESS_CAUSE) return { ok: false, problem: "a storyless waiver belongs on the story's own issue, not on a pull request" };
    return { ok: false, problem: `\`waive: ${waive}\` is not a cause a waiver can clear (landed-change or record-revised)` };
}

// ---------------------------------------------------------------------------------------------
// The storyless waiver (epic #830, story #866, decision record #872, D10).
//
// A closed story with no claiming pull request — one that shipped inside a sibling's pull request —
// has no pull request to carry a comment, so its waiver is a comment on the story's own issue, in
// the same marker-and-fence form:
//
//     <!-- nexus:close-waiver -->
//     ```yaml
//     waive: storyless
//     story: "#865"
//     reason: <optional, one line>
//     ```
//
// Trust is the same rule, read from the comment's association on the story issue, so it is decided
// against the issues repository the story lives in, never against a code repository.
// ---------------------------------------------------------------------------------------------

/** The cause a storyless waiver names. */
export const STORYLESS_CAUSE = "storyless";

/** A storyless waiver block as parsed: the story it names, or why it could not be read. */
export type ParsedStorylessWaiver = { ok: true; story: string; reason: string | null } | { ok: false; problem: string };

/** One storyless waiver comment on a story issue. */
export interface StorylessWaiverComment {
    author: string;
    url: string;
    /** The platform's timestamp on the comment; its date is the waiver's date. */
    at: string;
    trusted: boolean;
    waiver: ParsedStorylessWaiver;
}

/** The storyless waiver that applies to a story, if any, and every one that cleared nothing. */
export interface StorylessWaiverMatch {
    applied: StorylessWaiverComment | null;
    rejected: RejectedWaiver[];
}

/** Parse a storyless waiver in `body`. Null when the body carries no waiver marker or waives another cause. */
export function parseStorylessWaiver(body: string): ParsedStorylessWaiver | null {
    const block = waiverFence(body);
    if (block === null) return null;
    if (typeof block !== "string") return { ok: false, problem: block.problem };
    const fields = new Map<string, string>();
    for (const line of block.split("\n")) {
        const m = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*?)\s*$/.exec(line);
        if (m !== null) fields.set(m[1], unquote(m[2]));
    }
    const waive = fields.get("waive") ?? "";
    if (waive === "landed-change" || waive === "record-revised") return null;
    if (waive !== STORYLESS_CAUSE) return { ok: false, problem: `\`waive: ${waive}\` is not the storyless form (waive: storyless)` };
    const story = fields.get("story") ?? "";
    if (story === "") return { ok: false, problem: "a storyless waiver must name the story under `story:`" };
    return { ok: true, story, reason: fields.get("reason") || null };
}

/** The exact storyless waiver comment to post on story `story`'s own issue. */
export function storylessWaiverComment(story: number): string {
    return [WAIVER_MARKER, "```yaml", `waive: ${STORYLESS_CAUSE}`, `story: "#${story}"`, "reason: <optional, one line>", "```"].join("\n");
}

/**
 * Every storyless waiver comment on story issue `story` in `issuesRepo`. A failed or unparseable
 * read fails: it is never "no waiver".
 */
export function readStoryWaivers(run: Runner, cwd: string, issuesRepo: string, story: number): Result<StorylessWaiverComment[]> {
    const r = run("gh", ["issue", "view", String(story), "--repo", issuesRepo, "--json", "comments"], { cwd });
    if (r.status !== 0) return fail("gh-failed", `gh issue view ${story} --json comments failed: ${r.stderr.trim()}`);
    let doc: Record<string, unknown>;
    try {
        doc = JSON.parse(r.stdout) as Record<string, unknown>;
    } catch (e) {
        return fail("gh-failed", `gh issue view ${story} returned unparseable JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
    const out: StorylessWaiverComment[] = [];
    for (const item of Array.isArray(doc["comments"]) ? doc["comments"] : []) {
        if (item === null || typeof item !== "object") continue;
        const c = item as Record<string, unknown>;
        const waiver = parseStorylessWaiver(typeof c["body"] === "string" ? c["body"] : "");
        if (waiver === null) continue;
        const author = c["author"] !== null && typeof c["author"] === "object" ? (c["author"] as Record<string, unknown>)["login"] : undefined;
        out.push({
            author: typeof author === "string" ? author : "",
            url: typeof c["url"] === "string" ? c["url"] : "",
            at: typeof c["createdAt"] === "string" ? c["createdAt"] : "",
            trusted: maintainerAuthored({ authorAssociation: typeof c["authorAssociation"] === "string" ? c["authorAssociation"] : null }),
            waiver,
        });
    }
    return ok(out);
}

/**
 * The storyless waiver that clears story `story`: the newest trusted comment naming that story in
 * `issuesRepo` (a bare `#<n>` names the story's own repository). Every other one is named with why
 * it cleared nothing.
 */
export function matchStorylessWaiver(comments: readonly StorylessWaiverComment[], story: number, issuesRepo: string): StorylessWaiverMatch {
    const accepted: StorylessWaiverComment[] = [];
    const rejected: RejectedWaiver[] = [];
    for (const c of comments) {
        const who = { author: c.author, url: c.url };
        if (!c.waiver.ok) {
            rejected.push({ ...who, why: "malformed", problem: c.waiver.problem });
            continue;
        }
        if (!c.trusted) {
            rejected.push({ ...who, why: "untrusted" });
            continue;
        }
        const ref = parseIssueRef(c.waiver.story);
        if (ref === null || ref.number !== story || (ref.repo !== null && !sameRepo(ref.repo, issuesRepo))) {
            rejected.push({ ...who, why: "malformed", problem: `it names story ${c.waiver.story}, not #${story}` });
            continue;
        }
        accepted.push(c);
    }
    const applied = newestReceiptBlock(accepted);
    return { applied, rejected: applied === null ? rejected : rejected.filter((r) => r.why === "untrusted" || r.why === "malformed") };
}

/**
 * The answer form: an ID numbered under its kind's prefix, a dash (an em dash, an en dash or one or
 * two hyphens), a verb, then a colon and the reason. A line with no colon or nothing after it is
 * still read, with no reason, so the verdict can name it rather than ignore it.
 */
const ANSWER_LINE = /^[ \t]*((?:DV|DS|F)[1-9]\d*)[ \t]*(?:\u2014|\u2013|--?)[ \t]*(accepted|waived|approved)[ \t]*(?::(.*))?$/i;

/**
 * The answer lines in `body`, in the order written. A body that carries the verdict block's or the
 * judgments block's marker is a verdict and holds no answer (G12). Anything that is not exactly the
 * form — a freely worded reply, a quoted line — answers nothing.
 */
export function parseAnswerLines(body: string): AnswerLine[] {
    if (body.includes(RECEIPT_MARKER) || body.includes(JUDGMENTS_MARKER)) return [];
    const answers: AnswerLine[] = [];
    for (const line of body.split(/\r?\n/)) {
        const m = ANSWER_LINE.exec(line);
        if (m === null) continue;
        answers.push({ id: m[1].toUpperCase(), verb: m[2].toLowerCase() as AnswerVerb, reason: (m[3] ?? "").trim() });
    }
    return answers;
}

export interface ReadPrWaiversOptions {
    /** The repository the pull request lives in, when it is not the checkout's own. */
    ghRepo?: string;
}

/**
 * Every waiver comment and every answer line on pull request `pr`. `gh pr view --json comments`
 * follows every page before it answers, as the receipt reader's read does. A failed or unparseable
 * read fails: it is never "no waiver" and never "no answer".
 */
export function readPrWaivers(run: Runner, cwd: string, pr: number, opts: ReadPrWaiversOptions = {}): Result<PrWaivers> {
    const repoArgs = opts.ghRepo === undefined ? [] : ["--repo", opts.ghRepo];
    const r = run("gh", ["pr", "view", String(pr), ...repoArgs, "--json", "comments"], { cwd });
    if (r.status !== 0) return fail("gh-failed", `gh pr view ${pr} --json comments failed: ${r.stderr.trim()}`);
    let doc: Record<string, unknown>;
    try {
        doc = JSON.parse(r.stdout) as Record<string, unknown>;
    } catch (e) {
        return fail("gh-failed", `gh pr view ${pr} returned unparseable JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
    const comments: WaiverComment[] = [];
    const answers: PrAnswer[] = [];
    for (const item of Array.isArray(doc["comments"]) ? doc["comments"] : []) {
        if (item === null || typeof item !== "object") continue;
        const c = item as Record<string, unknown>;
        const body = typeof c["body"] === "string" ? c["body"] : "";
        const author = c["author"] !== null && typeof c["author"] === "object" ? (c["author"] as Record<string, unknown>)["login"] : undefined;
        const from = {
            author: typeof author === "string" ? author : "",
            url: typeof c["url"] === "string" ? c["url"] : "",
            at: typeof c["createdAt"] === "string" ? c["createdAt"] : "",
            trusted: maintainerAuthored({ authorAssociation: typeof c["authorAssociation"] === "string" ? c["authorAssociation"] : null }),
        };
        for (const line of parseAnswerLines(body)) answers.push({ ...line, ...from });
        const waiver = parseWaiverBlock(body);
        if (waiver !== null) comments.push({ ...from, waiver });
    }
    return ok({ pr, comments, answers });
}

/**
 * Sort the waiver comments that address `cause` into the one that clears it — the newest trusted
 * comment `covers` accepts — and every other one, with why it cleared nothing. A comment that
 * waives the other cause is not about this stop and is left out; an unreadable one is named,
 * because close cannot tell which stop it meant. When a waiver applies, an untrusted or unreadable
 * comment is still named (G32); a trusted one the applied waiver supersedes is not.
 */
function match(waivers: PrWaivers, cause: WaiverCause, covers: (terms: WaiverTerms, c: WaiverComment) => RejectedWaiver | null): WaiverMatch {
    const accepted: WaiverComment[] = [];
    const rejected: RejectedWaiver[] = [];
    for (const c of waivers.comments) {
        const who = { author: c.author, url: c.url };
        if (!c.waiver.ok) {
            rejected.push({ ...who, why: "malformed", problem: c.waiver.problem });
            continue;
        }
        if (c.waiver.terms.cause !== cause) continue;
        if (!c.trusted) {
            rejected.push({ ...who, why: "untrusted" });
            continue;
        }
        const refused = covers(c.waiver.terms, c);
        if (refused === null) accepted.push(c);
        else rejected.push(refused);
    }
    const applied = newestReceiptBlock(accepted);
    return applied === null ? { applied: null, rejected } : { applied, rejected: rejected.filter((r) => r.why === "untrusted" || r.why === "malformed") };
}

/** The waiver that clears a landed-change stop on `changed` files: it must name every one (G31). */
export function matchLandedChangeWaiver(waivers: PrWaivers, changed: readonly string[]): WaiverMatch {
    return match(waivers, "landed-change", (terms, c) => {
        const named = new Set(terms.cause === "landed-change" ? terms.files : []);
        const uncovered = changed.filter((f) => !named.has(f));
        return uncovered.length === 0 ? null : { author: c.author, url: c.url, why: "incomplete", uncovered };
    });
}

/**
 * The waiver that clears a revised-record stop: it must name record `issue` at its `digest` now
 * (G35). When the record's repository `issuesRepo` is known, a waiver that names another repository
 * clears nothing; a bare `#<n>` reference names the record's own.
 */
export function matchRecordWaiver(waivers: PrWaivers, issue: number, digest: string, issuesRepo?: string): WaiverMatch {
    return match(waivers, "record-revised", (terms, c) => {
        if (terms.cause !== "record-revised") return null;
        const ref = parseIssueRef(terms.record);
        const sameRepo = ref?.repo == null || issuesRepo === undefined || ref.repo === issuesRepo.toLowerCase();
        return ref?.number === issue && sameRepo && terms.digest === digest.toLowerCase()
            ? null
            : { author: c.author, url: c.url, why: "other-revision", record: terms.record, digest: terms.digest };
    });
}
