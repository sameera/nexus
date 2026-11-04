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
