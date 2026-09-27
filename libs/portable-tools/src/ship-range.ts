/**
 * The solo lane's range resolver (epic #799, decision record #806 D6): one toolkit program turns
 * `--since <ref>`, or its absence, into a range with full commit identifiers at both ends, or into
 * a named refusal that names `--since`. The checked range, the drafted range and the stamped range
 * are then the same commits.
 *
 * Node builtins and the workspace runner only; bundled into the `nexus` entrypoint.
 */

import { defaultRunner, git, type Runner } from "@nexus/workspace/run";

/** The range resolver's refusals. Every one names `--since` (D6). */
export type RangeProblem = "range-empty" | "range-no-upstream" | "range-since-unresolved" | "range-since-not-ancestor";

export interface ShipRange {
    /** The exclusive base: the commit the range starts after. */
    base: string;
    /** The inclusive head: the current commit. */
    head: string;
    /** Where the base came from. */
    source: "since" | "upstream";
    /** The ref the base was read from. */
    ref: string;
    /** The commits in the range. */
    commits: number;
}

export type ShipRangeResult = { ok: true; range: ShipRange } | { ok: false; error: { problem: RangeProblem; message: string } };

/**
 * Fix the range once, as two full commit identifiers. With `since`, the commits after it up to
 * HEAD, and it must be an ancestor of HEAD. Without it, the commits the trunk's local tracking
 * ref does not have — read as it is, with no fetch. A range with no change outside the pipeline
 * stores is refused.
 */
export function resolveShipRange(
    repoRoot: string,
    opts: { since?: string; trunkRef: string; excludePathspecs: readonly string[] },
    run: Runner = defaultRunner,
): ShipRangeResult {
    const head: string | null = git(run, repoRoot, "rev-parse", "--verify", "HEAD^{commit}");
    if (head === null) {
        return { ok: false, error: { problem: "range-since-unresolved", message: "the current commit cannot be read; name the range start with --since <ref>" } };
    }
    let base: string;
    let source: "since" | "upstream";
    let ref: string;
    if (opts.since !== undefined) {
        const resolved: string | null = git(run, repoRoot, "rev-parse", "--verify", `${opts.since}^{commit}`);
        if (resolved === null) {
            return { ok: false, error: { problem: "range-since-unresolved", message: `--since ${opts.since} does not name a commit; pass --since <ref> with a commit this checkout has` } };
        }
        if (run("git", ["merge-base", "--is-ancestor", resolved, head], { cwd: repoRoot }).status !== 0) {
            return {
                ok: false,
                error: { problem: "range-since-not-ancestor", message: `--since ${opts.since} is not an ancestor of the current commit; pass --since <ref> with a commit this branch contains` },
            };
        }
        base = resolved;
        source = "since";
        ref = opts.since;
    } else {
        const tracking: string | null = git(run, repoRoot, "rev-parse", "--verify", "--quiet", `${opts.trunkRef}^{commit}`);
        if (tracking === null) {
            return {
                ok: false,
                error: { problem: "range-no-upstream", message: `there is no upstream trunk (${opts.trunkRef}) to measure the range against; name the range start with --since <ref>` },
            };
        }
        const mergeBase: string | null = git(run, repoRoot, "merge-base", tracking, head);
        if (mergeBase === null) {
            return { ok: false, error: { problem: "range-no-upstream", message: `the current commit shares no history with ${opts.trunkRef}; name the range start with --since <ref>` } };
        }
        base = mergeBase;
        source = "upstream";
        ref = opts.trunkRef;
    }
    const changed = run("git", ["diff", "--quiet", base, head, "--", ".", ...opts.excludePathspecs], { cwd: repoRoot });
    if (changed.status === 0) {
        return {
            ok: false,
            error: {
                problem: "range-empty",
                message: `the range ${base.slice(0, 12)}..${head.slice(0, 12)} has no change outside the pipeline stores, so there is nothing to check; name the range start with --since <ref>`,
            },
        };
    }
    const count: string | null = git(run, repoRoot, "rev-list", "--count", `${base}..${head}`);
    return { ok: true, range: { base, head, source, ref, commits: Number(count ?? "0") } };
}
