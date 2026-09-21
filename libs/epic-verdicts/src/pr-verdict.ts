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
 */

import { type AnalyzeReceipt } from "@nexus/pr-acceptance/verify";
import { verifyReceipt } from "@nexus/pr-acceptance/verify";
import { type EpicVerdictsDiagnostic } from "./diagnostic.js";
import { type Runner } from "./run.js";

export interface PrVerdict {
    pr: number;
    /** The repository the trust check was run against, as the caller named it. */
    repo: string;
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

/** Read the verdict `pr` carries in `repo`, from the checkout at `cwd`. */
export function readPrVerdict(run: Runner, cwd: string, pr: number, repo: string): ReadPrVerdictResult {
    const r = verifyReceipt(run, cwd, pr, repo);
    if (!r.ok) {
        // A pull request carrying no verdict is not a failure — it is reported as found: false
        // below. Only a broken tool or a block that cannot be parsed reaches here.
        return { ok: false, error: { problem: "gh-failed", message: r.error.message } };
    }
    const v = r.value;
    return {
        ok: true,
        verdict: {
            pr,
            repo,
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
