/**
 * The context lookup: the one rule stub planning and the decision-record stage both use to find an
 * initiative's kept context (epic #850, decision record #961, D5; read from the initiative issue by
 * epic #1011, decision record #1016, D5–D7).
 *
 * It reads the issue's parent, checks the parent for the declared initiative marker, then reads the
 * context from the initiative issue alone: collapsed in its body, or in numbered comments. A comment
 * counts only when its author can speak for the repository, and each part is checked against the
 * digest the body recorded at filing. A missing or changed part, an unreadable comment list, or a
 * body that still names a context folder stops the run before drafting. The checkout is never read.
 *
 * Read-only: it fetches through `gh`; it writes nothing but the rendered text, and only where the
 * caller asks.
 */

import { recordDigest } from "@nexus/record-digest/digest";
import { isDeclaredInitiative, readKindMarkers } from "@nexus/delivery-config/issue-kind";
import { fetchIssue, fetchIssueFacts, type RepoSlug } from "@nexus/epic-resolve/gh";
import { type Runner } from "@nexus/epic-resolve/run";
import { canonicalIssuesRepo, issuesRepoSlug, onIssuesHost, resolveVerdictRepos } from "@nexus/epic-verdicts/verdict-repos";
import { fetchComments, isTrustedAssociation, parseContextFromBody, parsePartMarker, withoutContext } from "./initiative-context-store.js";

/** A context comment the run set aside, and who posted it. */
export interface IgnoredPart {
    author: string;
    reason: string;
}

export type LookupOutcome =
    /** The issue has no parent, or its parent is not an initiative: the caller runs exactly as before. */
    | { state: "no-initiative"; issue: number }
    /** An initiative whose context is kept on its issue: the body (without the context) and the context text. */
    | { state: "context"; issue: number; initiative: number; where: "body" | "comments"; body: string; text: string; ignored: IgnoredPart[] }
    /** An initiative with no context beyond its summary: its body alone. */
    | { state: "body-only"; issue: number; initiative: number; body: string };

export type LookupResult =
    | { ok: true; outcome: LookupOutcome }
    | { ok: false; problem: "context-missing" | "context-changed" | "legacy-folder" | "comments-unreadable" | "issue-not-found" | "gh-failed"; message: string };

const LEGACY_POINTER: RegExp = /The full planning context of this initiative is kept in the repository, in `([^`]+)`/;

/**
 * Look up the initiative context of `issue`.
 *
 * The issues are read in the repository `root` configures as its `epic-repo`, on the host that names,
 * and in `root`'s own repository only when nothing is configured: an epic filed into another
 * repository has its parent there, not here.
 *
 * @param baseRun  the process seam (`gh` runs with `cwd` = `root`)
 * @param root  the checkout that declares the issues repository
 */
export function lookupInitiativeContext(baseRun: Runner, root: string, issue: number): LookupResult {
    const repos = resolveVerdictRepos(baseRun, root);
    if (!repos.ok) return { ok: false, problem: "gh-failed", message: repos.error.message };
    const issuesRepo: string = canonicalIssuesRepo(repos.repos.issuesRepo);
    const run: Runner = onIssuesHost(baseRun, issuesRepo);
    const slug: RepoSlug = issuesRepoSlug(issuesRepo);

    const facts = fetchIssueFacts(run, root, slug, issue);
    if (!facts.ok) return { ok: false, problem: "gh-failed", message: facts.error.message };
    if (!facts.facts.exists) return { ok: false, problem: "issue-not-found", message: `#${issue} names no issue.` };
    const parent: number | null = facts.facts.parent;
    if (parent === null) return { ok: true, outcome: { state: "no-initiative", issue } };

    const parentFacts = fetchIssueFacts(run, root, slug, parent);
    if (!parentFacts.ok) return { ok: false, problem: "gh-failed", message: parentFacts.error.message };
    const markers = readKindMarkers(root);
    if (!isDeclaredInitiative(markers, { labels: parentFacts.facts.labels, issueType: parentFacts.facts.issueType })) {
        return { ok: true, outcome: { state: "no-initiative", issue } };
    }

    const initiative = fetchIssue(run, root, parent, "gh-failed", slug);
    if (!initiative.ok) return { ok: false, problem: "gh-failed", message: initiative.error.message };
    const issueBody: string = initiative.issue.body;

    const body: string = withoutContext(issueBody);
    const legacy: RegExpExecArray | null = LEGACY_POINTER.exec(body);
    if (legacy !== null) {
        return {
            ok: false,
            problem: "legacy-folder",
            message:
                `initiative #${parent}'s body still names a context folder, ${legacy[1]}. Context is read from the initiative issue only, ` +
                `so move that folder's text onto the issue (see the release notes), then run again. Nothing was drafted.`,
        };
    }

    const kept = parseContextFromBody(issueBody);
    if (kept.kind === "none") return { ok: true, outcome: { state: "body-only", issue, initiative: parent, body: issueBody } };
    if (kept.kind === "damaged") {
        return {
            ok: false,
            problem: kept.damage === "missing" ? "context-missing" : "context-changed",
            message:
                kept.damage === "missing"
                    ? `the collapsed planning context in initiative #${parent}'s body is gone, though its record says it was filed there. Restore it from the issue's edit history. Nothing was drafted.`
                    : `the planning context in initiative #${parent}'s body, or the record of it, was damaged after filing and cannot be read. Restore it from the issue's edit history. Nothing was drafted.`,
        };
    }
    if (kept.kind === "inline") {
        if (!kept.matches) {
            return {
                ok: false,
                problem: "context-changed",
                message: `the planning context in initiative #${parent}'s body no longer matches the digest recorded when it was filed. Restore it by editing it back to its filed text. Nothing was drafted.`,
            };
        }
        return { ok: true, outcome: { state: "context", issue, initiative: parent, where: "body", body, text: kept.text, ignored: [] } };
    }

    const fetched = fetchComments(run, root, slug, parent);
    if (!fetched.ok) return { ok: false, problem: "comments-unreadable", message: `${fetched.message}. Nothing was drafted.` };
    const ignored: IgnoredPart[] = [];
    const trusted: { number: number; total: number; body: string; author: string }[] = [];
    for (const c of fetched.comments) {
        const marker = parsePartMarker(c.body);
        if (marker === null) continue;
        if (!isTrustedAssociation(c.association)) {
            ignored.push({ author: c.author, reason: `part ${marker.number} was posted by someone who cannot speak for the repository` });
            continue;
        }
        trusted.push({ ...marker, body: c.body, author: c.author });
    }
    const slices: string[] = [];
    for (let n = 1; n <= kept.count; n++) {
        const mine = trusted.filter((t) => t.number === n && t.total === kept.count);
        const good = mine.find((t) => recordDigest(t.body) === kept.digests[n - 1]);
        if (good === undefined) {
            const changed: boolean = mine.length > 0;
            return {
                ok: false,
                problem: changed ? "context-changed" : "context-missing",
                message: changed
                    ? `part ${n} of ${kept.count} of initiative #${parent}'s planning context was changed after filing. Restore it by editing it back to its filed text. Nothing was drafted.`
                    : `part ${n} of ${kept.count} of initiative #${parent}'s planning context is missing from its comments. Nothing was drafted.`,
            };
        }
        const slice: string = good.body.replace(/\r\n?/g, "\n").split("\n").slice(1).join("\n");
        // A trimmed trailing newline does not change the digest; restore it so parts never fuse,
        // except after a part the filer cut inside a line, which never had one.
        slices.push(slice.endsWith("\n") || kept.cuts.includes(n) ? slice : `${slice}\n`);
    }
    for (const t of trusted) {
        if (t.total !== kept.count || t.number < 1 || t.number > kept.count) {
            ignored.push({ author: t.author, reason: `part ${t.number}/${t.total} is not listed in the initiative's record` });
        }
    }
    return { ok: true, outcome: { state: "context", issue, initiative: parent, where: "comments", body, text: slices.join(""), ignored } };
}

/**
 * The context as source text: the initiative body, then the context, each under a heading that
 * names where it came from. Empty when there is no initiative.
 */
export function renderContextSource(outcome: LookupOutcome): string {
    if (outcome.state === "no-initiative") return "";
    const parts: string[] = [`## From initiative #${outcome.initiative}: its issue body\n\n${outcome.body.trimEnd()}\n`];
    if (outcome.state === "context") {
        parts.push(`## From initiative #${outcome.initiative}: its planning context (kept ${outcome.where === "body" ? "in its body" : "in its comments"})\n\n${outcome.text.trimEnd()}\n`);
    }
    return parts.join("\n");
}
