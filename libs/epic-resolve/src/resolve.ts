/**
 * The single producer of the materialized epic (decision record: "one resolver … is the only
 * producer of the materialized epic"). Orchestrates the read layer and the serializer over the
 * injected Runner and returns the `epic.md` markdown as a string — it does not write (so idempotency
 * is testable by comparing two returned strings).
 *
 * Fail-closed (Invariant 2): the epic, its sub-issue list, every referenced story, and every
 * story's `blocked_by` edges must all fetch cleanly. The first failure returns a diagnostic and
 * nothing is serialized — never a partial or silently truncated epic.
 *
 * The sub-issue set is not homogeneous (epic #139): one sub-issue may be the epic's **decision
 * record**. It is identified record-positively (see classify.ts), kept out of the story set, and
 * surfaced as its own recoverable field — so no downstream stage that iterates stories ever acts on
 * a phantom story, and an epic with no record sub-issue resolves byte-identically to before.
 */

import { classifySubIssue, resolveRecordClassification, type RecordClassification } from "./classify.js";
import { type EpicResolveDiagnostic } from "./diagnostic.js";
import {
    fetchBlockedBy,
    fetchIssue,
    fetchParentNumber,
    fetchSubIssueNumbers,
    fetchSubIssueTypes,
    resolveRepoSlug,
} from "./gh.js";
import { extractMeta } from "./meta.js";
import { type Runner } from "./run.js";
import { type EpicRecord, type EpicStory, serializeEpic } from "./serialize.js";

export type ResolveEpicResult =
    | { ok: true; markdown: string; record: EpicRecord | null }
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

    // Classification is resolved once per run, and only when there is something to classify — an
    // epic with no sub-issues never invokes the resolver, so it cannot fail on a checkout that
    // carries no publishing resolver at all.
    let classification: RecordClassification | null = null;
    let issueTypes = new Map<number, string>();
    if (subs.numbers.length > 0) {
        const resolved = resolveRecordClassification(run, targetRoot);
        if (!resolved.ok) return resolved;
        classification = resolved.classification;
        if (classification.mode !== "labels") {
            const types = fetchSubIssueTypes(run, targetRoot, slug.slug, epicNumber);
            // Under `types` the answer decides classification, so a failure is fatal. Under
            // `legacy-auto` the label is the primary marker and a repo without the issue-types
            // feature must keep resolving exactly as before.
            if (!types.ok && classification.mode === "types") return types;
            if (types.ok) issueTypes = types.types;
        }
    }

    const stories: EpicStory[] = [];
    const blockedBy = new Map<number, number[]>();
    let record: EpicRecord | null = null;
    for (const subNumber of subs.numbers) {
        const sub = fetchIssue(run, targetRoot, subNumber, "subissue-fetch-failed");
        if (!sub.ok) return sub;

        const kind =
            classification === null
                ? "story"
                : classifySubIssue(classification, {
                      labels: sub.issue.labels,
                      issueType: issueTypes.get(subNumber) ?? null,
                  });

        if (kind === "record") {
            if (record !== null) {
                return {
                    ok: false,
                    error: {
                        problem: "multiple-record-subissues",
                        message:
                            `epic #${epicNumber} has more than one decision-record sub-issue ` +
                            `(#${record.number} and #${subNumber}); an epic has at most one — ` +
                            `detach or reclassify the extra one and re-run.`,
                    },
                };
            }
            record = { number: subNumber, state: sub.issue.state.toLowerCase() === "closed" ? "closed" : "open" };
            continue;
        }

        stories.push({ number: sub.issue.number, title: sub.issue.title, body: sub.issue.body });

        const deps = fetchBlockedBy(run, targetRoot, subNumber);
        if (!deps.ok) return deps;
        blockedBy.set(subNumber, deps.numbers);
    }

    const { rawFrontmatter, body } = extractMeta(epic.issue.body);
    return {
        ok: true,
        record,
        markdown: serializeEpic({
            epic: { number: epic.issue.number, title: epic.issue.title, body, rawFrontmatter },
            stories,
            blockedBy,
            record,
        }),
    };
}
