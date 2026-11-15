/**
 * Restamping an initiative's kept context: the way a lead accepts a deliberate edit to the planning
 * context, instead of editing it back to its filed text.
 *
 * The lookup stops on a context whose digest no longer matches the record written at filing,
 * because the context counts as what the lead asked for and a silent edit would become that request.
 * Restamping keeps the guarantee and drops the revert. A preview reads the issue's edit history,
 * shows what changed in the context since the version that matched the record, and names everyone
 * whose edit changed it. Every one of them must hold write access or more. Accepting the preview's
 * token rewrites the record line alone, so later lookups read the edited context, and a context that
 * changed again after the preview is refused rather than accepted unseen.
 */

import { isDeclaredInitiative, readKindMarkers } from "@nexus/delivery-config/issue-kind";
import { fetchIssue, fetchIssueFacts, type RepoSlug } from "@nexus/epic-resolve/gh";
import { type Runner } from "@nexus/epic-resolve/run";
import { canonicalIssuesRepo, issuesRepoSlug, onIssuesHost, resolveVerdictRepos } from "@nexus/epic-verdicts/verdict-repos";
import { recordDigest } from "@nexus/record-digest/digest";
import { fetchComments, isTrustedAssociation, parseContextFromBody, parsePartMarker, readContextRecord, replaceContextRecord } from "./initiative-context-store.js";

/** One version of an issue body or comment, from its edit history. */
interface Version {
    editedAt: string;
    /** Null when the account was deleted. */
    editor: string | null;
    text: string;
}

export interface Editor {
    login: string;
    editedAt: string;
}

/** What changed in one place the context is kept: the collapsed block (part null) or one part. */
export interface ContextChange {
    part: number | null;
    /** Whether the edit history still holds the version that matched the record. */
    baseline: "found" | "not-found";
    /** Everyone whose edit changed the context since that version, oldest first. */
    editors: Editor[];
    /** The changed lines, `-` for filed text and `+` for current text, with two lines of context. */
    diff: string;
}

export type RestampProblem =
    | "issue-not-found"
    | "not-initiative"
    | "no-context"
    | "context-missing"
    | "record-damaged"
    | "part-ambiguous"
    | "history-unreadable"
    | "history-incomplete"
    | "untrusted-editor"
    | "token-mismatch"
    | "edit-failed"
    | "gh-failed";

export type RestampResult =
    | { ok: true; state: "unchanged"; initiative: number }
    | { ok: true; state: "preview" | "restamped"; initiative: number; where: "body" | "comments"; changes: ContextChange[]; token: string }
    | { ok: false; problem: RestampProblem; message: string };

const WRITE_PERMISSIONS: readonly string[] = ["admin", "maintain", "write"];

const ISSUE_EDITS_QUERY: string =
    "query($owner:String!,$repo:String!,$num:Int!){repository(owner:$owner,name:$repo){issue(number:$num){userContentEdits(first:100){nodes{editedAt editor{login} diff}}}}}";
const COMMENT_EDITS_QUERY: string = "query($id:ID!){node(id:$id){... on IssueComment{userContentEdits(first:100){nodes{editedAt editor{login} diff}}}}}";

const lf = (s: string): string => s.replace(/\r\n?/g, "\n");
const refuse = (problem: RestampProblem, message: string): RestampResult => ({ ok: false, problem, message });

/**
 * Preview, or with `accept` restamp, the kept context of initiative `initiative`.
 *
 * @param accept  the token a preview printed; the record is rewritten only when the context still
 *                produces that token
 */
export function restampInitiativeContext(baseRun: Runner, root: string, initiative: number, accept?: string): RestampResult {
    const repos = resolveVerdictRepos(baseRun, root);
    if (!repos.ok) return refuse("gh-failed", repos.error.message);
    const issuesRepo: string = canonicalIssuesRepo(repos.repos.issuesRepo);
    const run: Runner = onIssuesHost(baseRun, issuesRepo);
    const slug: RepoSlug = issuesRepoSlug(issuesRepo);

    const facts = fetchIssueFacts(run, root, slug, initiative);
    if (!facts.ok) return refuse("gh-failed", facts.error.message);
    if (!facts.facts.exists) return refuse("issue-not-found", `#${initiative} names no issue. Nothing was written.`);
    if (!isDeclaredInitiative(readKindMarkers(root), { labels: facts.facts.labels, issueType: facts.facts.issueType })) {
        return refuse("not-initiative", `#${initiative} is not an initiative. Restamp the initiative the lookup named. Nothing was written.`);
    }
    const fetched = fetchIssue(run, root, initiative, "issue-not-found", slug);
    if (!fetched.ok) return refuse("gh-failed", fetched.error.message);
    const body: string = lf(fetched.issue.body);
    const kept = parseContextFromBody(body);
    const record: Record<string, unknown> | null = readContextRecord(body);

    if (kept.kind === "none") return refuse("no-context", `initiative #${initiative} keeps no planning context, so there is nothing to restamp. Nothing was written.`);
    if (kept.kind === "damaged") {
        return kept.damage === "missing"
            ? refuse("context-missing", `the collapsed planning context in initiative #${initiative}'s body is gone. Restamping records an edited context; it cannot replace a missing one. Restore it from the issue's edit history. Nothing was written.`)
            : refuse("record-damaged", `the planning context in initiative #${initiative}'s body, or its record, is damaged and cannot be read. Restore it from the issue's edit history. Nothing was written.`);
    }

    let where: "body" | "comments";
    let changes: ContextChange[];
    let newRecord: Record<string, unknown>;

    if (kept.kind === "inline") {
        if (record === null || record.kind !== "inline") {
            return refuse("record-damaged", `initiative #${initiative}'s body has a collapsed context but no readable record of it. Restore the record from the issue's edit history. Nothing was written.`);
        }
        if (kept.matches) return { ok: true, state: "unchanged", initiative };
        const history = readHistory(run, root, ["-f", `query=${ISSUE_EDITS_QUERY}`, "-F", `owner=${slug.owner}`, "-F", `repo=${slug.repo}`, "-F", `num=${initiative}`], ["data", "repository", "issue"], `initiative #${initiative}`);
        if (!history.ok) return history.result;
        const inlineText = (v: string): string | null => {
            const parsed = parseContextFromBody(lf(v));
            return parsed.kind === "inline" ? parsed.text : null;
        };
        const change = describeChange(history.versions, kept.text, String(record.digest ?? ""), inlineText, (t) => t, null);
        if (change === null) return incomplete(initiative, null);
        where = "body";
        changes = [change];
        newRecord = { kind: "inline", digest: recordDigest(kept.text) };
    } else {
        const comments = fetchComments(run, root, slug, initiative);
        if (!comments.ok) return refuse("history-unreadable", `${comments.message}. Nothing was written.`);
        where = "comments";
        changes = [];
        const digests: string[] = [...kept.digests];
        for (let n = 1; n <= kept.count; n++) {
            const mine = comments.comments.filter((c) => {
                const m = parsePartMarker(c.body);
                return m !== null && m.number === n && m.total === kept.count && isTrustedAssociation(c.association);
            });
            if (mine.some((c) => recordDigest(c.body) === kept.digests[n - 1])) continue;
            if (mine.length === 0) {
                return refuse("context-missing", `part ${n} of ${kept.count} of initiative #${initiative}'s planning context is missing from its comments. Restamping records an edited part; it cannot replace a missing one. Nothing was written.`);
            }
            if (mine.length > 1) {
                return refuse("part-ambiguous", `initiative #${initiative} has ${mine.length} comments that claim to be part ${n} of ${kept.count}, and none matches its record. Delete all but the one to keep, then restamp again. Nothing was written.`);
            }
            const comment = mine[0];
            const history = readHistory(run, root, ["-f", `query=${COMMENT_EDITS_QUERY}`, "-F", `id=${comment.nodeId}`], ["data", "node"], `part ${n} of initiative #${initiative}`);
            if (!history.ok) return history.result;
            const partText = (v: string): string => lf(v).split("\n").slice(1).join("\n");
            const change = describeChange(history.versions, comment.body, kept.digests[n - 1], (v) => v, partText, n);
            if (change === null) return incomplete(initiative, n);
            changes.push(change);
            digests[n - 1] = recordDigest(comment.body);
        }
        if (changes.length === 0) return { ok: true, state: "unchanged", initiative };
        newRecord = { ...(record ?? {}), kind: "parts", count: kept.count, digests };
    }

    const untrusted: string[] = [];
    const logins: (string | null)[] = [...new Set(changes.flatMap((c) => c.editors.map((e) => e.login || null)))];
    for (const login of logins) {
        if (login === null || !canWrite(run, root, slug, login)) untrusted.push(login ?? "a deleted account");
    }
    if (untrusted.length > 0) {
        return refuse(
            "untrusted-editor",
            `initiative #${initiative}'s planning context was changed by ${untrusted.join(", ")}, who cannot speak for the repository. ` +
                `Only an edit by someone with write access can be restamped. Restore the context from the issue's edit history. Nothing was written.`,
        );
    }

    const token: string = recordDigest(JSON.stringify(newRecord));
    if (accept === undefined) return { ok: true, state: "preview", initiative, where, changes, token };
    if (accept !== token) {
        return refuse("token-mismatch", `initiative #${initiative}'s planning context is not the one that preview showed; it changed since. Preview it again. Nothing was written.`);
    }

    const updated: string | null = replaceContextRecord(body, newRecord);
    if (updated === null) return refuse("record-damaged", `initiative #${initiative}'s body has no context record to restamp. Nothing was written.`);
    const edit = run("gh", ["issue", "edit", String(initiative), "--repo", `${slug.owner}/${slug.repo}`, "--body-file", "-"], { cwd: root, input: updated });
    if (edit.status !== 0) return refuse("edit-failed", `editing initiative #${initiative} failed: ${edit.stderr.trim() || "unknown gh error"}`);
    const back = fetchIssue(run, root, initiative, "issue-not-found", slug);
    const readBack: Record<string, unknown> | null = back.ok ? readContextRecord(back.issue.body) : null;
    if (readBack === null || JSON.stringify(readBack) !== JSON.stringify(newRecord)) {
        return refuse("edit-failed", `initiative #${initiative}'s record did not read back as written. Preview it again.`);
    }
    return { ok: true, state: "restamped", initiative, where, changes, token };
}

function incomplete(initiative: number, part: number | null): RestampResult {
    const what: string = part === null ? `initiative #${initiative}'s planning context` : `part ${part} of initiative #${initiative}'s planning context`;
    return refuse("history-incomplete", `${what} no longer matches its record, but its edit history names no edit that changed it, so no one can be shown as its author. Restore it from the issue's edit history. Nothing was written.`);
}

/** The edit history at `path` in a GraphQL answer, oldest first. */
function readHistory(run: Runner, cwd: string, args: string[], path: string[], what: string): { ok: true; versions: Version[] } | { ok: false; result: RestampResult } {
    const unreadable = (why: string): { ok: false; result: RestampResult } => ({ ok: false, result: refuse("history-unreadable", `reading the edit history of ${what} failed: ${why}. Nothing was written.`) });
    const r = run("gh", ["api", "graphql", ...args], { cwd });
    if (r.status !== 0) return unreadable(r.stderr.trim() || "unknown gh error");
    let node: unknown;
    try {
        node = JSON.parse(r.stdout);
    } catch {
        return unreadable("the answer was not readable JSON");
    }
    for (const key of [...path, "userContentEdits", "nodes"]) node = node !== null && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined;
    if (!Array.isArray(node)) return unreadable("the answer held no edit list");
    if (node.some((n: unknown) => n === null || typeof n !== "object")) return unreadable("the answer held an edit that could not be read");
    // GitHub lists edits newest first; reversing keeps the order of edits made in the same second.
    const versions: Version[] = [...node].reverse().map((n: Record<string, unknown>) => ({
        editedAt: String(n.editedAt ?? ""),
        editor: typeof (n.editor as { login?: unknown } | null)?.login === "string" ? (n.editor as { login: string }).login : null,
        text: typeof n.diff === "string" ? n.diff : "",
    }));
    return { ok: true, versions };
}

/**
 * What changed between the last version whose kept text matched `recorded` and `current`, and who
 * changed it. `extract` takes a version to the digested text (null when the version holds none);
 * `shown` takes digested text to the text the diff shows. Null when no edit in the history changed
 * the context, so its author cannot be named.
 */
function describeChange(
    versions: Version[],
    current: string,
    recorded: string,
    extract: (version: string) => string | null,
    shown: (text: string) => string,
    part: number | null,
): ContextChange | null {
    const texts: (string | null)[] = versions.map((v) => extract(v.text));
    let baseline: number = -1;
    texts.forEach((t, i) => {
        if (t !== null && recordDigest(t) === recorded) baseline = i;
    });
    const editors: Editor[] = [];
    // With no matching version, the oldest one held is itself a change of unknown origin.
    for (let i = Math.max(baseline + 1, 0); i < versions.length; i++) {
        const before: string | null = i === 0 ? null : texts[i - 1];
        if (i === 0 || texts[i] !== before) editors.push({ login: versions[i].editor ?? "", editedAt: versions[i].editedAt });
    }
    if (editors.length === 0) return null;
    const filed: string = baseline === -1 ? "" : shown(texts[baseline] as string);
    return { part, baseline: baseline === -1 ? "not-found" : "found", editors, diff: lineDiff(filed, shown(current)) };
}

function canWrite(run: Runner, cwd: string, slug: RepoSlug, login: string): boolean {
    const r = run("gh", ["api", `repos/${slug.owner}/${slug.repo}/collaborators/${login}/permission`], { cwd });
    if (r.status !== 0) return false;
    try {
        const permission: unknown = (JSON.parse(r.stdout) as { permission?: unknown }).permission;
        return typeof permission === "string" && WRITE_PERMISSIONS.includes(permission);
    } catch {
        return false;
    }
}

/** A line diff of `a` to `b`: changed lines with two lines of context, hunks separated by `@@`. */
export function lineDiff(a: string, b: string): string {
    const split = (s: string): string[] => (s === "" ? [] : s.replace(/\n$/, "").split("\n"));
    const x: string[] = split(a);
    const y: string[] = split(b);
    const lcs: number[][] = Array.from({ length: x.length + 1 }, () => new Array<number>(y.length + 1).fill(0));
    for (let i = x.length - 1; i >= 0; i--) {
        for (let j = y.length - 1; j >= 0; j--) lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
    const ops: { op: " " | "-" | "+"; line: string }[] = [];
    let i: number = 0;
    let j: number = 0;
    while (i < x.length || j < y.length) {
        if (i < x.length && j < y.length && x[i] === y[j]) {
            ops.push({ op: " ", line: x[i++] });
            j++;
        } else if (i < x.length && (j === y.length || lcs[i + 1][j] >= lcs[i][j + 1])) {
            ops.push({ op: "-", line: x[i++] });
        } else {
            ops.push({ op: "+", line: y[j++] });
        }
    }
    const keep: boolean[] = ops.map((_, k) => ops.slice(Math.max(0, k - 2), k + 3).some((o) => o.op !== " "));
    const out: string[] = [];
    let gap: boolean = false;
    ops.forEach((o, k) => {
        if (!keep[k]) {
            gap = true;
            return;
        }
        if (gap && out.length > 0) out.push("@@");
        gap = false;
        out.push(`${o.op} ${o.line}`);
    });
    return out.join("\n");
}
