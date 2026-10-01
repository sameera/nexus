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
import { storyFingerprint } from "./fingerprint.js";
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

    // Story fingerprints (epic #827, decision record #837, D7). Analyze took them when it first
    // read the stories; checking them again here catches a story edited while the run was in
    // progress and a fingerprint copied wrongly into the block. Exactly one per named story, each
    // equal to the digest of that story's current body in the issues repository.
    const named = [...new Set(parsed.stories)].sort((a, b) => a - b);
    const extra = Object.keys(parsed.storyFingerprints)
        .map(Number)
        .filter((n) => !named.includes(n));
    if (extra.length > 0) {
        return {
            ok: false,
            error: {
                problem: "story-fingerprint-extra",
                message: `the drafted verdict fingerprints ${extra.map((n) => `#${n}`).join(", ")}, which its \`stories:\` list does not name; record a fingerprint for exactly the stories it covers.`,
            },
        };
    }
    for (const story of named) {
        const recorded = parsed.storyFingerprints[story];
        if (recorded === undefined) {
            return {
                ok: false,
                error: {
                    problem: "story-fingerprint-missing",
                    message: `the drafted verdict names story #${story} in ${issuesRepo} but records no fingerprint for it; add it from \`nexus story-fingerprints\` taken at the start of the run.`,
                },
            };
        }
        const current = storyFingerprint(run, cwd, issuesRepo, story);
        if (!current.ok) {
            return {
                ok: false,
                error: {
                    problem: "story-unreadable",
                    message: `the current text of story #${story} in ${issuesRepo} could not be fetched, so its fingerprint cannot be checked: ${current.cause}. Run analyze again once it can be read.`,
                },
            };
        }
        if (recorded !== current.digest) {
            return {
                ok: false,
                error: {
                    problem: "story-fingerprint-mismatch",
                    message: `story #${story} in ${issuesRepo} does not match the fingerprint the drafted verdict records (recorded ${recorded}, current ${current.digest}). The story was edited during the run or the fingerprint was copied wrongly; run analyze again.`,
                },
            };
        }
    }

    return { ok: true, repos: resolved.repos };
}
