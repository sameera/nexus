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

/**
 * A parsed repository identity. `host` is null for the bare `owner/repo` form — an unknown host,
 * never an assumed one.
 */
export interface RepoIdentity {
    host: string | null;
    owner: string;
    name: string;
}

const REPO_SEGMENT_RE = /^[\w.-]+$/;

/**
 * Parse the two written forms of a repository: bare `owner/repo`, or host-qualified
 * `host/owner/repo` — the form the conformance gate stamps into a published verdict. Null for
 * anything else, including a URL.
 */
export function parseRepoIdentity(text: string): RepoIdentity | null {
    const parts = text.trim().toLowerCase().split("/");
    if (!parts.every((p) => REPO_SEGMENT_RE.test(p))) return null;
    if (parts.length === 2) return { host: null, owner: parts[0], name: parts[1] };
    if (parts.length === 3) return { host: parts[0], owner: parts[1], name: parts[2] };
    return null;
}

/**
 * Whether two written repository identities name the same repository — the one comparison rule
 * every reader of a published verdict calls, so two readers of the same block cannot disagree
 * about which repository it stamps (epic #747, decision record #750, invariant 4).
 *
 * Identity is case-insensitive, as it is on GitHub, and it spans both written forms: the owner and
 * the repository name must agree, and a host is compared only when **both** sides state one. A
 * host stated on one side only is unknown, and an unknown never matches — nor does it reject
 * (invariant 2), which is what lets a verdict stamped `github.com/acme/widget` be read by a caller
 * that knows only `acme/widget`. Two hosts that are both stated and differ are a conflict: the host
 * is what separates two forges hosting the same owner and repository name.
 *
 * Two unknown repositories (`null`) are treated as equal, and an unknown never matches a known one.
 * A token that is not a repository identity at all falls back to case-folded equality.
 */
export function sameRepo(a: string | null, b: string | null): boolean {
    if (a === null || b === null) return a === b;
    const left = parseRepoIdentity(a);
    const right = parseRepoIdentity(b);
    if (left === null || right === null) return a.toLowerCase() === b.toLowerCase();
    if (left.owner !== right.owner || left.name !== right.name) return false;
    return left.host === null || right.host === null || left.host === right.host;
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
