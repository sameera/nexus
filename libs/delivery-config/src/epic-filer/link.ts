/**
 * The issue number, recorded on the draft (story #381).
 *
 * The number is recoverable from exactly one place — the draft — and `/nxs.epic` reads it back from
 * there to decide whether a re-run should file again. So it is written the moment the issue exists,
 * before any label, type or project step, and the edit touches nothing else in the file
 * (Invariant 7): an existing `link` is replaced in place rather than duplicated, and a draft with
 * none gets one inserted before the closing fence.
 */

export interface LinkWrite {
    /** The draft with its link field set, or null when the frontmatter has no boundaries to edit. */
    content: string | null;
}

export function withLink(content: string, issueNumber: string): LinkWrite {
    const lines: string[] = content.split("\n");
    let inFrontmatter = false;
    let closingAt = -1;
    let linkAt = -1;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === "---") {
            if (!inFrontmatter) inFrontmatter = true;
            else {
                closingAt = i;
                break;
            }
        } else if (inFrontmatter && lines[i].startsWith("link:")) {
            linkAt = i;
        }
    }

    if (closingAt === -1) return { content: null };

    const field = `link: "#${issueNumber}"`;
    if (linkAt !== -1) lines[linkAt] = field;
    else lines.splice(closingAt, 0, field);
    return { content: lines.join("\n") };
}
