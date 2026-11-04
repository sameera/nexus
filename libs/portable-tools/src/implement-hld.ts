/**
 * The HLD comment `nexus implement` reads from the epic's decision record (epic #971, decision
 * record #986).
 *
 * `/nxs.hld` posts a comment on the record whose first line is its marker, and which names the
 * record digest the page was rendered from, a one-line verdict and a pinned link to the page. The
 * command reads that comment to decide whether the agent builds from the page. The comment format is
 * owned by `/nxs.hld`; a test reads its template and fails when the wording this reader accepts
 * changes (R1).
 */

import { maintainerAuthored } from "@nexus/pr-acceptance/receipt-blocks";

/** The first line of every comment `/nxs.hld` posts on a record. */
export const HLD_MARKER = "<!-- nxs.hld -->";

/** The verdict `/nxs.hld` writes when every criterion is achievable and no decision is violated (D3). */
export const CLEAN_VERDICT = "All acceptance criteria achievable, no decision violated";

/** One comment on the decision record, as the platform recorded it. */
export interface RecordComment {
    body: string;
    /** The platform's creation time, ISO 8601. */
    createdAt: string;
    /** The platform's author association, or null when it states none. */
    authorAssociation: string | null;
    url: string;
}

/** Whether `body`'s first line is exactly the `/nxs.hld` marker (G2). */
export function isHldComment(body: string): boolean {
    return body.split(/\r?\n/, 1)[0].trimEnd() === HLD_MARKER;
}

/**
 * The newest trusted HLD comment (D1): untrusted comments are removed first, so one can never hide
 * a trusted one (G3), then the latest creation time wins (G1). Null when there is none.
 */
export function newestHldComment(comments: readonly RecordComment[]): RecordComment | null {
    let newest: RecordComment | null = null;
    let newestAt = -Infinity;
    for (const c of comments) {
        if (!isHldComment(c.body) || !maintainerAuthored({ authorAssociation: c.authorAssociation })) continue;
        const at = Date.parse(c.createdAt);
        const when = Number.isNaN(at) ? -Infinity : at;
        if (newest === null || when >= newestAt) {
            newest = c;
            newestAt = when;
        }
    }
    return newest;
}

/** The page link on the comment's `- Design:` line, or null when it has none. */
export function designLink(body: string): string | null {
    for (const line of body.split(/\r?\n/)) {
        if (!/^\s*-\s*Design:/.test(line)) continue;
        return /https?:\/\/[^\s)\]>]+/.exec(line)?.[0] ?? null;
    }
    return null;
}

/** Where the command writes the page copy, in the epic's gitignored scratch folder (D6). */
export function pageCopyPath(epic: number): string {
    return `.nexus/tmp/epic-${epic}/hld-page.md`;
}

/** The record digest the comment says the page was rendered from, or null when it states none (D3). */
export function commentDigest(body: string): string | null {
    for (const line of body.split(/\r?\n/)) {
        if (!/^\s*Rendered\b/.test(line)) continue;
        return /\bat digest `([0-9a-f]+)`/.exec(line)?.[1] ?? null;
    }
    return null;
}

/** The text of the comment's `- Verdict:` line, or null when it has none. */
export function commentVerdict(body: string): string | null {
    for (const line of body.split(/\r?\n/)) {
        const m = /^\s*-\s*Verdict:(.*)$/.exec(line);
        if (m !== null) return m[1].trim();
    }
    return null;
}

/**
 * Whether `verdict` is the clean verdict (D3). Only an exact match counts; the emphasis the preview
 * prints it in and a closing full stop are the only differences allowed.
 */
export function isCleanVerdict(verdict: string | null): boolean {
    if (verdict === null) return false;
    const bare = verdict
        .trim()
        .replace(/^([*_]{1,2})(.*)\1$/, "$2")
        .trim()
        .replace(/\.$/, "");
    return bare === CLEAN_VERDICT;
}
