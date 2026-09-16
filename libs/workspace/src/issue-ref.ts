/**
 * The provenance reference grammar (`.nexus/concepts/provenance-reference.md`), as one shared
 * formatter, parser and comparator — the single place the two legal forms are defined, so an
 * epic, a decision record, an analyze receipt and a close record cannot each spell the rule
 * differently.
 *
 * A reference is either bare (`#141`, or `141` on input) or fully qualified (`owner/repo#141`).
 * The full link form is never produced or accepted here (concept invariant 4): a reference stays
 * plain-text searchable, and a URL is noise a reader has to parse instead of grep.
 */

/** A parsed reference. `repo` is null when the token carried no repository qualifier. */
export interface IssueRef {
    /** Lowercased `owner/repo`, or null for a bare reference. */
    repo: string | null;
    number: number;
}

/**
 * Where a reference is being written. `{ kind: "repo", repo }` is a GitHub surface — a comment,
 * a review, an issue body — or a local file whose own frontmatter declares `repo` as its home.
 * `{ kind: "none" }` is a terminal report, which has no ambient repository a reader resolves a
 * bare number against.
 */
export type PublicationContext = { kind: "repo"; repo: string } | { kind: "none" };

const BARE_RE = /^#?(\d+)$/;

/**
 * The qualified provenance form, `owner/repo#N` — the one grammar shared with the `--pr`
 * reference parser (`@nexus/pr-worktree/member-target`), so the two cannot silently diverge on
 * what counts as a repository name.
 */
export const QUALIFIED_ISSUE_REF_RE = /^([\w.-]+)\/([\w.-]+)#(\d+)$/;

/** Parse `#141`, `141`, or `owner/repo#141`. Null for anything else, including a URL. */
export function parseIssueRef(text: string): IssueRef | null {
    const trimmed = text.trim();
    const bare = BARE_RE.exec(trimmed);
    if (bare) {
        const number = Number(bare[1]);
        return number > 0 ? { repo: null, number } : null;
    }
    const qualified = QUALIFIED_ISSUE_REF_RE.exec(trimmed);
    if (qualified) {
        const number = Number(qualified[3]);
        if (number <= 0) return null;
        return { repo: `${qualified[1]}/${qualified[2]}`.toLowerCase(), number };
    }
    return null;
}

/** Repository identity is case-insensitive on GitHub. Two unknowns are treated as equal. */
export function sameRepo(a: string | null, b: string | null): boolean {
    if (a === null || b === null) return a === b;
    return a.toLowerCase() === b.toLowerCase();
}

/**
 * The form a reference takes when written into `into`: bare when `ref`'s repository is unknown
 * or matches `into`, fully qualified otherwise. This is the whole rule — every stage composes a
 * reference by calling this, rather than deciding case by case whether to qualify.
 */
export function formatIssueRef(ref: IssueRef, into: PublicationContext): string {
    if (ref.repo === null) return `#${ref.number}`;
    if (into.kind === "repo" && sameRepo(into.repo, ref.repo)) return `#${ref.number}`;
    return `${ref.repo}#${ref.number}`;
}

/**
 * Whether two written references name the same issue, whichever form each is written in. A
 * reader compares this way rather than by string equality, so a reference qualified by one
 * resolver's view of the issues repo still matches a bare or differently-qualified one a
 * writer or an older release produced (decision record #495's tolerate-absent pattern). The
 * repository qualifiers are never compared against each other: a caller that also needs to
 * know the reference's own repository reads `parseIssueRef(...).repo` directly.
 */
export function issueRefsMatch(a: string, b: string): boolean {
    const left = parseIssueRef(a);
    const right = parseIssueRef(b);
    if (left === null || right === null) return false;
    return left.number === right.number;
}
