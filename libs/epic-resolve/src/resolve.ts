/**
 * The single producer of the materialized epic (decision record: "one resolver … is the only
 * producer of the materialized epic"). Orchestrates the read layer and the serializer over the
 * injected Runner and returns the `epic.md` markdown as a string — it does not write (so idempotency
 * is testable by comparing two returned strings).
 *
 * Fail-closed (Invariant 2): the epic, its sub-issue list, every referenced story, and every
 * story's `blocked_by` edges must all fetch cleanly. The first failure returns a diagnostic and
 * nothing is serialized — never a partial or silently truncated epic.
 */

import { type EpicResolveDiagnostic } from "./diagnostic.js";
import { fetchBlockedBy, fetchIssue, fetchParentNumber, fetchSubIssueNumbers, resolveRepoSlug } from "./gh.js";
import { extractMeta } from "./meta.js";
import { type Runner } from "./run.js";
import { type EpicStory, serializeEpic } from "./serialize.js";

export type ResolveEpicResult =
    | { ok: true; markdown: string }
    | { ok: false; error: EpicResolveDiagnostic };

export interface ResolveEpicOptions {
    /**
     * Validate that the target is an epic before materializing (the `--from` security boundary,
     * Invariant 18): a non-existent number fails `epic-not-found`, and an issue that is itself a
     * sub-issue (a story) fails `not-an-epic`. Off for the internal stages, which resolve epics
     * they already know are epics.
     */
    requireEpic?: boolean;
}

/**
 * Resolve an epic issue number into materialized `epic.md` markdown.
 *
 * @param run  the process seam (`gh` calls run with `cwd` = `targetRoot`)
 * @param targetRoot  the repo root whose issues to query (single-repo root, or the workspace hub)
 * @param epicNumber  the epic issue number — the sole join key
 * @param opts  resolution options (see {@link ResolveEpicOptions})
 */
export function resolveEpic(
    run: Runner,
    targetRoot: string,
    epicNumber: number,
    opts: ResolveEpicOptions = {},
): ResolveEpicResult {
    const slug = resolveRepoSlug(run, targetRoot);
    if (!slug.ok) return slug;

    const epic = fetchIssue(run, targetRoot, epicNumber, "epic-not-found");
    if (!epic.ok) return epic;

    if (opts.requireEpic) {
        const parent = fetchParentNumber(run, targetRoot, slug.slug, epicNumber);
        if (!parent.ok) return parent;
        if (parent.parent !== null) {
            return {
                ok: false,
                error: {
                    problem: "not-an-epic",
                    message:
                        `#${epicNumber} is a story issue (sub-issue of #${parent.parent}), not an epic; ` +
                        `pass its parent epic number to --from.`,
                },
            };
        }
    }

    const subs = fetchSubIssueNumbers(run, targetRoot, slug.slug, epicNumber);
    if (!subs.ok) return subs;

    const stories: EpicStory[] = [];
    const blockedBy = new Map<number, number[]>();
    for (const subNumber of subs.numbers) {
        const story = fetchIssue(run, targetRoot, subNumber, "subissue-fetch-failed");
        if (!story.ok) return story;
        stories.push({ number: story.issue.number, title: story.issue.title, body: story.issue.body });

        const deps = fetchBlockedBy(run, targetRoot, subNumber);
        if (!deps.ok) return deps;
        blockedBy.set(subNumber, deps.numbers);
    }

    const { rawFrontmatter, body } = extractMeta(epic.issue.body);
    return {
        ok: true,
        markdown: serializeEpic({
            epic: { number: epic.issue.number, title: epic.issue.title, body, rawFrontmatter },
            stories,
            blockedBy,
        }),
    };
}
