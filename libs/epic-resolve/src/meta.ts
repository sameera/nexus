/**
 * The epic-meta machine block — how the planning frontmatter survives onto the epic issue so the
 * resolver can reconstruct it (Story 2: "fully re-resolvable from its issue number alone").
 *
 * The filing skills strip an epic's frontmatter before creating the issue, so fields downstream
 * parsers need (`complexity`, `feature_path`, `slug`, `concepts`, …) are not otherwise on the
 * issue. `/nxs.epic` therefore embeds the raw frontmatter verbatim inside an HTML comment —
 * invisible in the rendered issue, precedented by the `<!-- nexus:analyze-receipt -->` block — and
 * the resolver lifts it back out. A hand-filed epic with no block simply resolves to the
 * recoverable-only frontmatter (epic title + link).
 *
 * The block content is the raw frontmatter yaml text carried through unchanged, so round-tripping
 * it reproduces the original frontmatter; only `link` is (re)set to the issue number at resolve
 * time (the sole join key).
 */

/** Opening marker of the embedded meta block. */
export const META_MARKER = "nexus:epic-meta";

const META_BLOCK = /<!--\s*nexus:epic-meta\b\s*\n([\s\S]*?)\n?-->/;

export interface ExtractedMeta {
    /** The raw frontmatter yaml carried in the block, or null when the issue has no meta block. */
    rawFrontmatter: string | null;
    /** The body with the meta block (and its surrounding blank lines) removed. */
    body: string;
}

/** Pull the meta block out of an epic issue body, returning the raw frontmatter and cleaned body. */
export function extractMeta(body: string): ExtractedMeta {
    const match = META_BLOCK.exec(body);
    if (match === null) {
        return { rawFrontmatter: null, body };
    }
    const rawFrontmatter = match[1].replace(/\s+$/, "");
    const cleaned = (body.slice(0, match.index) + body.slice(match.index + match[0].length)).replace(/\n{3,}/g, "\n\n");
    return { rawFrontmatter, body: cleaned };
}

/**
 * Return the raw frontmatter with its `link` set to `#<epicNumber>` — replacing an existing `link:`
 * line, or appending one. The epic number is authoritative (the join key); a stale/empty link that
 * rode in the block is overwritten.
 */
export function withLink(rawFrontmatter: string, epicNumber: number): string {
    const linkLine = `link: "#${epicNumber}"`;
    const lines = rawFrontmatter.split("\n");
    const idx = lines.findIndex((l) => /^link\s*:/.test(l));
    if (idx === -1) {
        return [...lines, linkLine].join("\n");
    }
    lines[idx] = linkLine;
    return lines.join("\n");
}
