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
import { JUDGMENTS_MARKER, parseJudgmentsBlock } from "@nexus/pr-acceptance/judgments-block";
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

    // A receipt records no story text (epic #828, decision record #849, D12, G38). Story text no
    // longer decides anything at close, so a drafted block that still records it is refused here,
    // where the publish gate already stands, rather than published as a value a later gate could
    // creep back onto. Readers keep accepting the key on receipts written by 0.82.0 to 0.86.0.
    if (/^\s*story_fingerprints\s*:/m.test(body.slice(body.indexOf(RECEIPT_MARKER)))) {
        return {
            ok: false,
            error: {
                problem: "story-text-recorded",
                message: "the drafted verdict records `story_fingerprints:`; a receipt no longer records the text of the stories it covers. Drop that line and check again.",
            },
        };
    }

    return checkJudgments(body, parsed.findings) ?? { ok: true, repos: resolved.repos };
}

/**
 * The judgments block (epic #829, stories #858 and #860; decision record #871, D2, D4, G7, G14,
 * G15). Every verdict carries one, even with no item in it, because it is the next run's ID
 * registry: a verdict published without it would reset the numbering, and an ID could then name two
 * items on one pull request. It must follow the verdict block, so the deployed readers' first-fence
 * parse still finds the verdict block. The severity counts are the counts of the items still open —
 * every unanswered departure and finding found, and nothing else — because the merge pre-check and
 * close block on those counts and must stop blocking on an item once it is answered.
 */
function checkJudgments(body: string, findings: Record<string, number>): CheckVerdictPublishResult | null {
    const at = body.indexOf(JUDGMENTS_MARKER);
    if (at < 0) {
        return refuse(
            "judgments-missing",
            `the drafted verdict carries no ${JUDGMENTS_MARKER} block. Write its departures and findings through \`nexus verdict-items\`, append the block it writes after the verdict block, and check again; a verdict with no item still carries the block.`,
        );
    }
    if (at < body.indexOf(RECEIPT_MARKER)) {
        return refuse("judgments-malformed", `the drafted verdict puts its ${JUDGMENTS_MARKER} block before the verdict block; it must follow it.`);
    }
    const judgments = parseJudgmentsBlock(body);
    if (!judgments.ok) return refuse("judgments-malformed", `the drafted verdict's judgments block cannot be read: ${judgments.message}.`);

    const items = [...(judgments.judgments?.items ?? []), ...(judgments.judgments?.findings ?? [])];
    for (const severity of ["critical", "high", "medium", "low"] as const) {
        const open = items.filter((d) => d.found && d.answer === null && d.severity === severity);
        const counted = findings[severity] ?? 0;
        if (open.length !== counted) {
            const listed = open.length === 0 ? "none" : open.map((d) => d.id).join(", ");
            return refuse(
                "counts-not-open",
                `the drafted verdict counts ${counted} ${severity} finding(s), but its open ${severity} items are ${open.length} (${listed}). The counts are the items still open: every unanswered departure and finding \`nexus verdict-items\` listed, and no answered or unlisted one. Write the counts it printed as \`open\` and check again.`,
            );
        }
    }
    return null;
}

function refuse(problem: EpicVerdictsDiagnostic["problem"], message: string): CheckVerdictPublishResult {
    return { ok: false, error: { problem, message } };
}
