/**
 * Derive the close record's `range:` from a merged PR — squash-, merge-, and
 * rebase-safe.
 *
 * The distiller recomputes the diff later from the stamped range, so the range
 * MUST anchor on commits that live permanently on the trunk. The PR branch tip
 * (headRefOid) is GC'd after a squash + branch delete and the distiller never
 * fetches, so we anchor `head` on the merge commit and pick `base` from its
 * ancestry:
 *
 *   - true merge commit (≥2 parents)  → base = mergeCommit^1   (mainline parent)
 *   - single-commit PR (1 parent)     → base = mergeCommit^1
 *   - multi-commit PR, 1 parent        → squash (base = mergeCommit^1) OR
 *                                        rebase (base = mergeCommit~N) — ambiguous
 *                                        by topology alone.
 *
 * For the ambiguous case we disambiguate by VERIFICATION: given the PR head
 * (fetched by the caller so it is reachable even post-squash), the authoritative
 * changed-file set is `baseRefOid...prHead`; we pick the candidate base whose
 * `base...mergeCommit` file set equals it. With no PR head to verify against we
 * refuse rather than guess — a wrong range would distill the wrong pages weeks
 * later. Two final gates always run: base must be an ancestor of head, and the
 * exact three-dot diff the distiller runs (queue excluded) must be non-empty.
 */

import { type PrInfo } from "./pr.js";
import { type PrWorktreeDiagnostic } from "./diagnostic.js";
import { type Runner, git } from "./run.js";

export interface Range {
    base: string;
    head: string;
}

export type DeriveRangeResult =
    | { ok: true; range: Range }
    | { ok: false; error: PrWorktreeDiagnostic };

/** Sorted, unique, non-empty changed paths for `base...head`, queue excluded; null on git error. */
function diffNameSet(run: Runner, cwd: string, base: string, head: string): string[] | null {
    const out = git(run, cwd, "diff", "--name-only", `${base}...${head}`, "--", ".", ":(exclude).nexus/queue");
    if (out === null) return null;
    return [...new Set(out.split("\n").map((l) => l.trim()).filter((l) => l.length > 0))].sort();
}

function sameSet(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function deriveRange(
    run: Runner,
    cwd: string,
    pr: PrInfo,
    opts: { verifyAgainstPrHead?: string } = {},
): DeriveRangeResult {
    const merge = pr.mergeCommitOid;
    if (merge === null) {
        return {
            ok: false,
            error: {
                problem: "pr-no-merge-commit",
                message: `PR #${pr.number} has no merge commit; cannot derive a permanent-on-trunk range. Merge the PR and retry.`,
            },
        };
    }

    const head = git(run, cwd, "rev-parse", "--verify", `${merge}^{commit}`);
    if (head === null) {
        return {
            ok: false,
            error: {
                problem: "git-failed",
                message: `merge commit ${merge} is not reachable in ${cwd}; fetch the trunk and retry (the drain never fetches).`,
            },
        };
    }

    const parentsLine = git(run, cwd, "rev-list", "--parents", "-n", "1", merge);
    const parentCount = parentsLine ? parentsLine.trim().split(/\s+/).length - 1 : 0;

    const resolve = (rev: string): string | null => git(run, cwd, "rev-parse", "--verify", `${rev}^{commit}`);

    let base: string | null;
    if (parentCount >= 2 || pr.commitCount <= 1) {
        // Unambiguous: merge commit (mainline parent) or a single landed commit.
        base = resolve(`${merge}^1`);
    } else {
        // Ambiguous — squash-of-N vs rebase-of-N. Disambiguate by verification only.
        const prHead = opts.verifyAgainstPrHead;
        if (prHead === undefined || pr.base === "") {
            return {
                ok: false,
                error: {
                    problem: "range-ambiguous",
                    message: `PR #${pr.number} landed as 1 commit-parent from ${pr.commitCount} commits (squash or rebase — indistinguishable by topology); supply the PR head to verify, or use a squash/merge-commit merge and retry.`,
                },
            };
        }
        const authoritative = diffNameSet(run, cwd, pr.base, prHead);
        if (authoritative === null) {
            return {
                ok: false,
                error: {
                    problem: "git-failed",
                    message: `could not compute the authoritative PR diff ${pr.base}...${prHead} in ${cwd} (is the PR head fetched?).`,
                },
            };
        }
        const candidates = [`${merge}^1`, `${merge}~${pr.commitCount}`];
        base = null;
        for (const rev of candidates) {
            const c = resolve(rev);
            if (c === null) continue;
            const set = diffNameSet(run, cwd, c, head);
            if (set !== null && sameSet(set, authoritative)) {
                base = c;
                break;
            }
        }
        if (base === null) {
            return {
                ok: false,
                error: {
                    problem: "range-unrecognized",
                    message: `no candidate base (${candidates.join(", ")}) reproduces PR #${pr.number}'s changed-file set; the merge strategy is unrecognized. Use a squash or merge-commit merge, or stamp the range manually.`,
                },
            };
        }
    }

    if (base === null) {
        return {
            ok: false,
            error: {
                problem: "git-failed",
                message: `cannot resolve the range base from merge commit ${merge} in ${cwd}.`,
            },
        };
    }

    const anc = run("git", ["merge-base", "--is-ancestor", base, head], { cwd });
    if (anc.status !== 0) {
        return {
            ok: false,
            error: {
                problem: "range-not-ancestor",
                message: `derived base ${base} is not an ancestor of head ${head}; refusing to stamp an invalid range.`,
            },
        };
    }

    const diff = git(run, cwd, "diff", `${base}...${head}`, "--", ".", ":(exclude).nexus/queue");
    if (diff === null) {
        return {
            ok: false,
            error: { problem: "git-failed", message: `git diff ${base}...${head} failed in ${cwd}.` },
        };
    }
    if (diff.trim() === "") {
        return {
            ok: false,
            error: {
                problem: "range-empty-diff",
                message: `derived range ${base}...${head} has an empty diff (excluding .nexus/queue); refusing to stamp a range that would distill nothing.`,
            },
        };
    }

    return { ok: true, range: { base, head } };
}
