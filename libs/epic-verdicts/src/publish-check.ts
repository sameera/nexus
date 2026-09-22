/**
 * The check the conformance gate hands its drafted verdict to immediately before publishing it
 * (epic #751, story #757, decision record #764).
 *
 * The rule this replaces lived in stage prose, and it was followed everywhere except the one case
 * it was written for. So it is a command instead: it resolves both repositories itself — never
 * from values the stage hands it — parses the drafted body with the same parser every reader uses,
 * and either approves those exact bytes or refuses and names the value the block should have
 * carried. The gate publishes only a body this approved, on the review path and on the
 * self-authored-comment fallback path alike.
 *
 * The key is required on every publish, not only when the two repositories differ. The
 * omit-when-equal conditional is the thing that failed; a check that verifies a conditional was
 * applied correctly still has the conditional in it. An absent key therefore means the verdict was
 * written before this change — which is exactly what a reader's fallback reads it as.
 */

import { parseReceiptBlock } from "@nexus/pr-acceptance/verify";
import { RECEIPT_MARKER } from "@nexus/pr-acceptance/receipt-blocks";
import { sameRepo } from "@nexus/workspace/issue-ref";
import { type EpicVerdictsDiagnostic } from "./diagnostic.js";
import { type Runner } from "./run.js";
import { resolveVerdictRepos, type VerdictRepos } from "./verdict-repos.js";

export type CheckVerdictPublishResult = { ok: true; repos: VerdictRepos } | { ok: false; error: EpicVerdictsDiagnostic };

/**
 * Judge `body` — the exact bytes that would be published from the checkout at `cwd`.
 *
 * A refusal is a failure of the publish step: the gate stops there and reports it, rather than
 * publishing a verdict whose story numbers name no repository.
 */
export function checkVerdictPublish(run: Runner, cwd: string, body: string): CheckVerdictPublishResult {
    const resolved = resolveVerdictRepos(run, cwd);
    if (!resolved.ok) return resolved;
    const { issuesRepo, repo } = resolved.repos;

    const parsed = parseReceiptBlock(body);
    if (parsed === null) {
        return {
            ok: false,
            error: {
                problem: "block-missing",
                message: `the drafted verdict carries no parseable ${RECEIPT_MARKER} block, so nothing states which repository its story numbers resolve against.`,
            },
        };
    }

    if (parsed.issuesRepo === null) {
        return {
            ok: false,
            error: {
                problem: "issues-repo-missing",
                message: `the drafted verdict names no issues repository; it must carry \`issues_repo: ${issuesRepo}\` — the repository its epic, record and story numbers resolve against (the analyzed pull request's code repository is ${repo}).`,
            },
        };
    }

    if (!sameRepo(parsed.issuesRepo, issuesRepo)) {
        return {
            ok: false,
            error: {
                problem: "issues-repo-mismatch",
                message: `the drafted verdict names \`issues_repo: ${parsed.issuesRepo}\`, but this checkout's issues live in ${issuesRepo}.`,
            },
        };
    }

    return { ok: true, repos: resolved.repos };
}
