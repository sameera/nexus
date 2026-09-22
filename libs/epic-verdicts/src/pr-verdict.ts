/**
 * The verdict one pull request carries — the callable form of a rule the close gate used to state
 * as prose and a model used to carry out (epic #747, decision record #750, key decision "A rule the
 * gate's verdict depends on moves behind a callable command").
 *
 * A live close reported the older of two verdicts published sixteen minutes apart, while every
 * compiled reader ranks them correctly. The rule had a non-deterministic executor and no test that
 * could ever fail it. This is the way the gate reaches the compiled reader instead: it applies
 * maintainer authorship, repository trust, the pull-request match and newest-wins itself, and the
 * stage reports what it returns.
 *
 * `repo` is not optional. A caller that did not say which repository it is reading would leave the
 * trust check inert in a real run (invariant 9).
 *
 * `issuesRepo` is required on the same terms (epic #751, decision record #764): it is the
 * repository the verdict's bare story numbers are being resolved against, and the caller that
 * forgets it is precisely the caller the comparison exists for. Unlike the epic-wide derivation,
 * which drops a candidate belonging to another repository's issues and moves on to the next one,
 * this reader has no other candidate to fall back to — so it surfaces the mismatch as a named
 * condition and the stage stops. Folding it into `found: false` would send the lead to wait for an
 * analyze run that already happened, because a missing verdict has exactly one meaning here.
 */

import { type AnalyzeReceipt } from "@nexus/pr-acceptance/verify";
import { verifyReceipt } from "@nexus/pr-acceptance/verify";
import { type EpicVerdictsDiagnostic } from "./diagnostic.js";
import { type Runner } from "./run.js";

export interface PrVerdict {
    pr: number;
    /** The repository the trust check was run against, as the caller named it. */
    repo: string;
    /** The repository the verdict's story numbers were resolved against, as the caller named it. */
    issuesRepo: string;
    found: boolean;
    source: "review" | "comment" | null;
    receipt: AnalyzeReceipt | null;
    /** The platform timestamp of the review or comment carrying the selected verdict. */
    at: string;
    /** The pull request's head at read time. */
    prHead: string;
    /** The analyzed commit still equals the pull request's head. */
    current: boolean;
    staleNote: string | null;
}

export type ReadPrVerdictResult = { ok: true; verdict: PrVerdict } | { ok: false; error: EpicVerdictsDiagnostic };

/**
 * Read the verdict `pr` carries in `repo`, from the checkout at `cwd`, resolving its story numbers
 * against `issuesRepo`.
 */
export function readPrVerdict(run: Runner, cwd: string, pr: number, repo: string, issuesRepo: string): ReadPrVerdictResult {
    const r = verifyReceipt(run, cwd, pr, repo, issuesRepo);
    if (!r.ok) {
        // A pull request carrying no verdict is not a failure — it is reported as found: false
        // below. Only a broken tool or a block that cannot be parsed reaches here.
        return { ok: false, error: { problem: "gh-failed", message: r.error.message } };
    }
    const v = r.value;
    if (!v.found && v.issuesRepoRejected.length > 0) {
        return {
            ok: false,
            error: {
                problem: "issues-repo-mismatch",
                message:
                    `PR #${pr} in ${repo} carries no verdict whose story numbers resolve against ${issuesRepo}: ` +
                    `${v.issuesRepoRejected.length} published verdict(s) name ${[...new Set(v.issuesRepoRejected)].join(", ")} instead. ` +
                    "This is a verdict belonging to another repository's issues, not a pull request that was never analyzed — re-run the conformance gate on it.",
            },
        };
    }
    return {
        ok: true,
        verdict: {
            pr,
            repo,
            issuesRepo,
            found: v.found,
            source: v.source,
            receipt: v.receipt,
            at: v.at,
            prHead: v.prHead,
            current: v.current,
            staleNote: v.staleNote,
        },
    };
}
