/**
 * The link from an epic or a stub to its feature issue (epic #998, decision record #1010, D8, D9).
 *
 * The link is GitHub's relates-to relationship, never a parent link: an epic under an initiative
 * already holds the one parent slot. Both filers call this module, and only after the issue exists
 * and its number is recorded, so a link step can never lose an issue. A link that already exists is
 * success, and a failed link is reported, never thrown, so the caller can warn and go on.
 *
 * Before anything is filed, a filer checks that the issue it was handed reads as a feature through
 * the shared kind rule, the same reading every stage makes, rather than trusting its caller.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { type GhRunner, type RunResult } from "./gh.js";
import { type KindClassification, isDeclaredFeature, readKindMarkers } from "./issue-kind.js";

/** One issue, by repository and number. */
export interface IssueAt {
    owner: string;
    name: string;
    number: string;
}

const key = (at: IssueAt): string => `${at.owner}/${at.name}#${at.number}`;

/** Read a feature reference: `#12`, `12`, `owner/repo#12` or an issue URL. Null when it is none. */
export function parseIssueAt(reference: string, home: { owner: string; name: string }): IssueAt | null {
    const value: string = reference.trim();
    const url: RegExpExecArray | null = /([^/\s]+)\/([^/\s]+)\/issues\/(\d+)\/?$/.exec(value);
    if (url !== null) return { owner: url[1], name: url[2], number: url[3] };
    const cross: RegExpExecArray | null = /^([^/\s#]+)\/([^/\s#]+)#(\d+)$/.exec(value);
    if (cross !== null) return { owner: cross[1], name: cross[2], number: cross[3] };
    const local: RegExpExecArray | null = /^#?([1-9]\d*)$/.exec(value);
    return local === null ? null : { ...home, number: local[1] };
}

const ISSUE_QUERY: string =
    "query($owner:String!,$repo:String!,$num:Int!){repository(owner:$owner,name:$repo){issue(number:$num){" +
    "id issueType{name} labels(first:100){nodes{name}} relatesTo(first:100){nodes{number repository{nameWithOwner}}}}}}";

const LINK_MUTATION: string =
    "mutation($issue:ID!,$related:ID!){addRelatesTo(input:{issueId:$issue,relatedIssueId:$related}){clientMutationId}}";

interface IssueRead {
    id: string;
    labels: string[];
    issueType: string | null;
    /** Each related issue as `owner/name#number`. */
    related: Set<string>;
}

function readIssue(run: GhRunner, at: IssueAt): IssueRead | null {
    const result: RunResult = run([
        "api", "graphql",
        "-f", `query=${ISSUE_QUERY}`,
        "-f", `owner=${at.owner}`,
        "-f", `repo=${at.name}`,
        "-F", `num=${at.number}`,
    ]);
    if (result.status !== 0) return null;
    try {
        const issue = (JSON.parse(result.stdout) as { data?: { repository?: { issue?: unknown } } }).data?.repository?.issue as
            | {
                  id?: string;
                  issueType?: { name?: string } | null;
                  labels?: { nodes?: { name?: string }[] };
                  relatesTo?: { nodes?: { number?: number; repository?: { nameWithOwner?: string } }[] };
              }
            | null
            | undefined;
        if (issue === null || issue === undefined || typeof issue.id !== "string") return null;
        return {
            id: issue.id,
            labels: (issue.labels?.nodes ?? []).map((n) => n.name ?? "").filter((n) => n !== ""),
            issueType: issue.issueType?.name ?? null,
            related: new Set((issue.relatesTo?.nodes ?? []).map((n) => `${n.repository?.nameWithOwner ?? ""}#${n.number ?? ""}`)),
        };
    } catch {
        return null;
    }
}

export type FeatureCheck = { ok: true; at: IssueAt } | { ok: false; message: string };

/** Whether `reference` names an issue that reads as a feature in the repository at `root` (G16). */
export function checkFeatureIssue(run: GhRunner, root: string, reference: string, home: { owner: string; name: string }): FeatureCheck {
    const at: IssueAt | null = parseIssueAt(reference, home);
    if (at === null) return { ok: false, message: `'${reference}' does not name an issue` };
    const markers: KindClassification = readKindMarkers(root);
    const issue: IssueRead | null = readIssue(run, at);
    if (issue === null) return { ok: false, message: `${key(at)} could not be read` };
    if (!isDeclaredFeature(markers, { labels: issue.labels, issueType: issue.issueType })) {
        return { ok: false, message: `${key(at)} is not declared a feature` };
    }
    return { ok: true, at };
}

export type LinkResult = { outcome: "linked" } | { outcome: "present" } | { outcome: "failed"; reason: string };

/** Add the relates-to link from `issue` to `feature`, or confirm it is already there (G15, G17). */
export function linkToFeature(run: GhRunner, issue: IssueAt, feature: IssueAt): LinkResult {
    const from: IssueRead | null = readIssue(run, issue);
    const to: IssueRead | null = readIssue(run, feature);
    if (from === null || to === null) return { outcome: "failed", reason: `${key(from === null ? issue : feature)} could not be read` };
    if (from.related.has(key(feature)) || to.related.has(key(issue))) return { outcome: "present" };
    const result: RunResult = run(["api", "graphql", "-f", `query=${LINK_MUTATION}`, "-f", `issue=${from.id}`, "-f", `related=${to.id}`]);
    if (result.status === 0) return { outcome: "linked" };
    // A link made between the read and the write is still success.
    if (readIssue(run, feature)?.related.has(key(issue))) return { outcome: "present" };
    return { outcome: "failed", reason: result.stderr.trim() || `gh exited ${result.status}` };
}

/**
 * The issues the feature does not list as related, as `owner/name#number`. Null when the feature
 * cannot be read, which a caller must treat as incomplete, never as nothing missing (G18).
 */
export function missingFromFeature(run: GhRunner, feature: IssueAt, issues: IssueAt[]): string[] | null {
    const read: IssueRead | null = readIssue(run, feature);
    if (read === null) return null;
    return issues.map(key).filter((k) => !read.related.has(k));
}

export type ReferenceWrite = { outcome: "written" } | { outcome: "stale" } | { outcome: "failed"; reason: string };

function readBody(run: GhRunner, at: IssueAt): string | null {
    const result: RunResult = run(["api", `repos/${at.owner}/${at.name}/issues/${at.number}`]);
    if (result.status !== 0) return null;
    try {
        return ((JSON.parse(result.stdout) as { body?: string | null }).body ?? "").replace(/\r\n/g, "\n");
    } catch {
        return null;
    }
}

/**
 * Name the feature issue on an existing epic or stub (decision record #1049, D5): replace its body
 * with `next` only while it still reads `expected`, edit nothing but the body, and confirm by reading
 * it back. The migration writes every body through here and links through {@link linkToFeature}, so
 * both of its writes go through this one shared step (G3).
 */
export function writeFeatureReference(run: GhRunner, issue: IssueAt, expected: string, next: string): ReferenceWrite {
    const current: string | null = readBody(run, issue);
    if (current === null) return { outcome: "failed", reason: `${key(issue)} could not be read` };
    if (current !== expected) return { outcome: "stale" };
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-feature-ref-"));
    try {
        const file: string = path.join(dir, "body.md");
        fs.writeFileSync(file, next);
        const result: RunResult = run(["issue", "edit", issue.number, "--repo", `${issue.owner}/${issue.name}`, "--body-file", file]);
        if (result.status !== 0) return { outcome: "failed", reason: result.stderr.trim() || `gh exited ${result.status}` };
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    return readBody(run, issue) === next ? { outcome: "written" } : { outcome: "failed", reason: `${key(issue)} did not read back as written` };
}
