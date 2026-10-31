/**
 * The context lookup: the one rule stub planning and the decision-record stage both use to find an
 * initiative's kept context (epic #850, decision record #961, D5).
 *
 * It reads the issue's parent, checks the parent for the declared initiative marker, then reads the
 * initiative body and every file in its context folder, verbatim, in name order. A folder the lead
 * wrote by hand is read the same as one the epic stage wrote. When the body carries a context
 * pointer but the checkout has no folder, the lookup refuses: the usual cause is a copy that was not
 * committed or not pulled, and planning on without it would silently re-derive the decisions the
 * context exists to carry.
 *
 * Read-only: it fetches through `gh` and reads the checkout; it writes nothing but the rendered
 * text, and only where the caller asks.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { isDeclaredInitiative, readKindMarkers } from "@nexus/delivery-config/issue-kind";
import { fetchIssue, fetchIssueFacts, type RepoSlug } from "@nexus/epic-resolve/gh";
import { type Runner } from "@nexus/epic-resolve/run";
import { canonicalIssuesRepo, issuesRepoSlug, onIssuesHost, resolveVerdictRepos } from "@nexus/epic-verdicts/verdict-repos";
import { initiativeContextDir, parsePointer } from "./initiative-context.js";

/** One file of a kept context, read verbatim. */
export interface ContextFile {
    name: string;
    text: string;
}

export type LookupOutcome =
    /** The issue has no parent, or its parent is not an initiative: the caller runs exactly as before. */
    | { state: "no-initiative"; issue: number }
    /** An initiative with a context folder: its body and every file in the folder. */
    | { state: "context"; issue: number; initiative: number; folder: string; body: string; files: ContextFile[] }
    /** An initiative with neither a pointer nor a folder: its body alone. */
    | { state: "body-only"; issue: number; initiative: number; folder: string; body: string };

export type LookupResult =
    | { ok: true; outcome: LookupOutcome }
    | { ok: false; problem: "context-missing" | "issue-not-found" | "gh-failed"; message: string };

/** The regular files directly in a context folder, sorted by name; empty when there is no folder. */
function readFolder(absolute: string): ContextFile[] {
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isDirectory()) return [];
    return fs
        .readdirSync(absolute, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .sort()
        .map((name) => ({ name, text: fs.readFileSync(path.join(absolute, name), "utf8") }));
}

/**
 * Look up the initiative context of `issue`.
 *
 * The issues are read in the repository `root` configures as its `epic-repo`, on the host that names,
 * and in `root`'s own repository only when nothing is configured: an epic filed into another
 * repository has its parent there, not here.
 *
 * @param baseRun  the process seam (`gh` runs with `cwd` = `root`)
 * @param root  the checkout that holds the initiative store and declares the issues repository
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
    const body: string = initiative.issue.body;
    const folder: string = initiativeContextDir(parent);
    const files: ContextFile[] = readFolder(path.join(root, folder));

    if (files.length > 0) return { ok: true, outcome: { state: "context", issue, initiative: parent, folder, body, files } };
    if (parsePointer(body) !== null) {
        return {
            ok: false,
            problem: "context-missing",
            message:
                `initiative #${parent}'s body names a kept context in ${folder}/, which this checkout does not hold. ` +
                `It is probably not committed or not pulled: pull it, or restore the folder, then run again. Nothing was drafted.`,
        };
    }
    return { ok: true, outcome: { state: "body-only", issue, initiative: parent, folder, body } };
}

/**
 * The context as source text: the initiative body, then each context file, each under a heading
 * that names where it came from. Empty when there is no initiative.
 */
export function renderContextSource(outcome: LookupOutcome): string {
    if (outcome.state === "no-initiative") return "";
    const parts: string[] = [`## From initiative #${outcome.initiative}: its issue body\n\n${outcome.body.trimEnd()}\n`];
    if (outcome.state === "context") {
        for (const file of outcome.files) {
            parts.push(`## From initiative #${outcome.initiative}: kept context file ${file.name}\n\n${file.text.trimEnd()}\n`);
        }
    }
    return parts.join("\n");
}
