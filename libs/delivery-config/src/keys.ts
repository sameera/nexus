/**
 * The github-block key catalogue — the single schema declaration (decision record #362, D4).
 *
 * Every key is declared once, with the name it is written under in `settings.yml`, the normalized
 * name the resolver carries it under, and the built-in it falls back to. The settings reader, the
 * hub-defaults normalizer, the `resolve <key>` argument and the settings writer all derive from
 * this one table, so adding a key here makes it readable, layerable, resolvable and writable with
 * no second edit anywhere. The predecessor kept a hand-written inverse of the read map beside it
 * and that inverse had already drifted — it was missing every key added since it was written.
 */

/** How a key's built-in default is produced when no layer declares a value. */
export interface GithubKey {
    /** The key as written in the `github:` block of `settings.yml`. */
    githubKey: string;
    /** The name the resolver carries the value under. */
    normalized: string;
}

/** Every declared github-block key, in the order the block is conventionally written. */
export const GITHUB_KEYS: readonly GithubKey[] = [
    { githubKey: "issues-repo", normalized: "issuesRepo" },
    { githubKey: "project", normalized: "project" },
    { githubKey: "epic-type", normalized: "epicType" },
    { githubKey: "epic-label", normalized: "epicLabel" },
    { githubKey: "story-type", normalized: "storyType" },
    { githubKey: "story-label", normalized: "storyLabel" },
    { githubKey: "classification", normalized: "classification" },
    // The specific epic-repo/story-repo win over the general issues-repo, which stays the fallback
    // for whichever is unspecified.
    { githubKey: "epic-repo", normalized: "epicRepo" },
    { githubKey: "story-repo", normalized: "storyRepo" },
    // Where the `--pr` flow creates its git worktrees. The value is a directory rather than a
    // publishing target; it lives here because the worktree exists only for the GitHub `--pr` flow,
    // and because membership in this block is what buys it the precedence chain and the hub layer.
    { githubKey: "worktree-path", normalized: "worktreePath" },
    // Decision-record and design-gate markers.
    { githubKey: "record-label", normalized: "recordLabel" },
    { githubKey: "record-type", normalized: "recordType" },
    { githubKey: "needs-design-label", normalized: "needsDesignLabel" },
    { githubKey: "in-progress-label", normalized: "inProgressLabel" },
    // The unplanned-state marker on a backlog stub. One key, one label, no family.
    { githubKey: "unplanned-label", normalized: "unplannedLabel" },
];

/** The normalized name for a github-block key, or the key itself when it is not declared. */
export function normalizedKey(githubKey: string): string {
    return GITHUB_KEYS.find((key) => key.githubKey === githubKey)?.normalized ?? githubKey;
}

/** The github-block spelling for either spelling of a key — the derived inverse, never a copy. */
export function githubKeyFor(key: string): string {
    return GITHUB_KEYS.find((entry) => entry.normalized === key)?.githubKey ?? key;
}
