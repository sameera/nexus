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
    return writeFrontmatterField(content, "link:", `link: "#${issueNumber}"`);
}

/**
 * Record the repository the epic was filed into, so the draft's otherwise-bare issue references
 * (`link`, and every `#N` a re-run of `/nxs.epic` copies from it) have a declared home once they
 * leave this file (concept "Provenance Reference"). A null `epicRepo` — the single-repo case, or
 * a workspace member with no separately declared epic-repo — is a no-op: there is no ambiguity to
 * record, and an absent key already means "the current repo" everywhere else in the toolkit.
 */
export function withIssuesRepo(content: string, epicRepo: string | null): LinkWrite {
    if (epicRepo === null) return { content };
    return writeFrontmatterField(content, "issues_repo:", `issues_repo: ${JSON.stringify(epicRepo)}`);
}

/**
 * Set one frontmatter field to `field` (already rendered as `key: value`), replacing an existing
 * line starting with `prefix` in place, or inserting one before the closing fence. Shared by
 * `withLink` and `withIssuesRepo` so the two fields cannot drift on how they locate the boundary
 * or how they touch nothing else (Invariant 7).
 */
function writeFrontmatterField(content: string, prefix: string, field: string): LinkWrite {
    const lines: string[] = content.split("\n");
    let inFrontmatter = false;
    let closingAt = -1;
    let fieldAt = -1;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === "---") {
            if (!inFrontmatter) inFrontmatter = true;
            else {
                closingAt = i;
                break;
            }
        } else if (inFrontmatter && lines[i].startsWith(prefix)) {
            fieldAt = i;
        }
    }

    if (closingAt === -1) return { content: null };

    if (fieldAt !== -1) lines[fieldAt] = field;
    else lines.splice(closingAt, 0, field);
    return { content: lines.join("\n") };
}
