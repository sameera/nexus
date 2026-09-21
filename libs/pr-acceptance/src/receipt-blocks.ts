/**
 * The step every reader of a published verdict shares: gather each marker-bearing body on a pull
 * request together with the platform's own timestamp on the review or comment carrying it, and
 * pick the latest (epic #747, decision record #750, key decision "The ordering step is shared; the
 * two readers are not merged").
 *
 * Only the ordering is shared. The single-pull-request reader wants one verdict and a currency
 * note; the epic-wide derivation keeps every surviving candidate, because an epic's combined change
 * set is the union of them. Each keeps its own filtering and its own result on top of this.
 *
 * Recency is the platform timestamp and nothing else (invariant 6). Not a date written in the block,
 * not the optional toolkit-version key, not how many keys a block carries, not the order the
 * payload returned them in, and not the prose above the block.
 */

/** The comment marker an analyze verdict is published under. */
export const RECEIPT_MARKER = "<!-- nexus:analyze-receipt -->";

export interface ReceiptBlock {
    body: string;
    /** GitHub's own `submittedAt` / `createdAt` on the review or comment carrying the block. */
    at: string;
    source: "review" | "comment";
    /**
     * The author association GitHub reported for the review or comment, or null when the payload
     * stated none — an unstated association is unknown, never a claim of maintainership.
     */
    authorAssociation: string | null;
}

/**
 * Every marker-bearing review and comment body in a `gh pr view --json reviews,comments` payload,
 * reviews first then comments, each in the order the payload returned them.
 */
export function collectReceiptBlocks(doc: Record<string, unknown>): ReceiptBlock[] {
    const out: ReceiptBlock[] = [];
    const push = (arr: unknown, source: "review" | "comment", timeKey: string): void => {
        if (!Array.isArray(arr)) return;
        for (const item of arr) {
            if (item === null || typeof item !== "object") continue;
            const rec = item as Record<string, unknown>;
            const body = typeof rec["body"] === "string" ? rec["body"] : "";
            if (!body.includes(RECEIPT_MARKER)) continue;
            out.push({
                body,
                at: typeof rec[timeKey] === "string" ? rec[timeKey] : "",
                source,
                authorAssociation: typeof rec["authorAssociation"] === "string" ? rec["authorAssociation"] : null,
            });
        }
    };
    push(doc["reviews"], "review", "submittedAt");
    push(doc["comments"], "comment", "createdAt");
    return out;
}

/**
 * The latest of `blocks` by platform timestamp, or null when there are none. Timestamps are
 * ISO-8601 and so order lexicographically; a tie keeps the one collected first, which makes the
 * choice deterministic rather than dependent on the payload's order.
 */
export function newestReceiptBlock<T extends { at: string }>(blocks: readonly T[]): T | null {
    let best: T | null = null;
    for (const block of blocks) {
        if (best === null || block.at.localeCompare(best.at) > 0) best = block;
    }
    return best;
}

/**
 * The author associations GitHub reports for someone who can speak for the repository. A verdict
 * is a maintainer's judgment; a pull request's reviews and comments are writable by anyone.
 */
export const MAINTAINER_ASSOCIATIONS: readonly string[] = ["OWNER", "MEMBER", "COLLABORATOR"];

/**
 * Whether a block's author may publish this repository's verdict. An association GitHub did not
 * state is unknown and is accepted, on the same terms as an unstated repository stamp: a payload
 * that never carried the field cannot be read as a claim either way. A stated association outside
 * the maintainer set is a positive "not a maintainer" and is rejected.
 */
export function maintainerAuthored(block: ReceiptBlock): boolean {
    return block.authorAssociation === null || MAINTAINER_ASSOCIATIONS.includes(block.authorAssociation.toUpperCase());
}
