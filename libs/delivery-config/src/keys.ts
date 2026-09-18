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

export interface GithubKey {
    /** The key as written in the `github:` block of `settings.yml`. */
    githubKey: string;
    /** The name the resolver carries the value under. */
    normalized: string;
    /**
     * The value the key takes when no layer declares one. Only the keys that carry a built-in the
     * generic precedence path does not know about have one — a stage hands these answers straight
     * to a filer's classification argument, where an empty string would file the batch
     * unclassified. Keys without one resolve to nothing, which is how an absent target stays "the
     * current repository" rather than being pinned to a concrete value.
     */
    builtin?: string;
    /** The normalized key this one falls back to before its built-in — the general for a specific. */
    fallbackTo?: string;
}

/** Every declared github-block key, in the order the block is conventionally written. */
export const GITHUB_KEYS: readonly GithubKey[] = [
    { githubKey: "issues-repo", normalized: "issuesRepo" },
    { githubKey: "project", normalized: "project" },
    { githubKey: "epic-type", normalized: "epicType" },
    { githubKey: "epic-label", normalized: "epicLabel", builtin: "epic" },
    { githubKey: "story-type", normalized: "storyType" },
    { githubKey: "story-label", normalized: "storyLabel", builtin: "story" },
    { githubKey: "classification", normalized: "classification" },
    // The specific epic-repo/story-repo win over the general issues-repo, which stays the fallback
    // for whichever is unspecified.
    { githubKey: "epic-repo", normalized: "epicRepo", fallbackTo: "issuesRepo" },
    { githubKey: "story-repo", normalized: "storyRepo", fallbackTo: "issuesRepo" },
    // Where the `--pr` flow creates its git worktrees. The value is a directory rather than a
    // publishing target; it lives here because the worktree exists only for the GitHub `--pr` flow,
    // and because membership in this block is what buys it the precedence chain and the hub layer.
    { githubKey: "worktree-path", normalized: "worktreePath" },
    // Decision-record and design-gate markers.
    { githubKey: "record-label", normalized: "recordLabel", builtin: "decision-record" },
    { githubKey: "record-type", normalized: "recordType", builtin: "Decision Record" },
    { githubKey: "needs-design-label", normalized: "needsDesignLabel", builtin: "needs-design" },
    { githubKey: "in-progress-label", normalized: "inProgressLabel", builtin: "in-progress" },
    // The unplanned-state marker on an epic stub. One key, one label, no family.
    { githubKey: "unplanned-label", normalized: "unplannedLabel", builtin: "needs-refinement" },
    // A story that legitimately ships with no pull request of its own (decision record #505,
    // epic #212). One concept shared by the epic-receipt coverage check and #213's close waiver —
    // never two labels for the same fact.
    { githubKey: "no-pr-label", normalized: "noPrLabel", builtin: "no-pull-request" },
    // The durable asset store the filing stages publish issue graphics into (epic #594). Declared
    // as `owner/repo` or `owner/repo@branch`. Deliberately without a built-in and without a
    // fallback to the issues repository: an absent store means assets are unsupported, because
    // writing files into a repository nobody nominated — one this design never prunes — is a side
    // effect the team never asked for. The shape check lives in one place, `asset-store.ts`.
    { githubKey: "asset-store", normalized: "assetStore" },
    // The per-file size cap the publish step checks a local file against before any request, in
    // bytes. A team property rather than an invocation flag, so one lead cannot push a large binary
    // into a store the team can never prune. The built-in is the stated 5 MB default.
    { githubKey: "asset-size-cap", normalized: "assetSizeCap", builtin: "5242880" },
    // The renderer an HTML asset's reference is built through (epic #613). One address template with
    // one slot for the asset's pinned address. Deliberately without a built-in: an absent template
    // means "no renderer", exactly as an absent store means assets are unsupported, and a built-in
    // would send every team's mockup addresses to a service nobody nominated. The shape check lives
    // beside the store's, in `asset-store.ts`.
    { githubKey: "asset-renderer", normalized: "assetRenderer" },
];

/** The catalogue row for a github-block key, or undefined when the catalogue declares none. */
export function keyEntry(githubKey: string): GithubKey | undefined {
    return GITHUB_KEYS.find((key) => key.githubKey === githubKey);
}

/** The normalized name for a github-block key, or the key itself when it is not declared. */
export function normalizedKey(githubKey: string): string {
    return GITHUB_KEYS.find((key) => key.githubKey === githubKey)?.normalized ?? githubKey;
}

/** The github-block spelling for either spelling of a key — the derived inverse, never a copy. */
export function githubKeyFor(key: string): string {
    return GITHUB_KEYS.find((entry) => entry.normalized === key)?.githubKey ?? key;
}
