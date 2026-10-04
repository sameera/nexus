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

import { type AnalyzeReceipt, parseReceiptBlock } from "@nexus/pr-acceptance/verify";
import { RECEIPT_MARKER } from "@nexus/pr-acceptance/receipt-blocks";
import {
    JUDGMENTS_MARKER,
    type Judgments,
    openItems,
    parseJudgmentsBlock,
    replaceJudgmentsBlock,
    withoutFileLists,
} from "@nexus/pr-acceptance/judgments-block";
import { sameRepo } from "@nexus/workspace/issue-ref";
import { type EpicVerdictsDiagnostic } from "./diagnostic.js";
import { type Runner } from "./run.js";
import { resolveVerdictRepos, type VerdictRepos } from "./verdict-repos.js";

/**
 * The platform's limit on a review or comment body, in characters (epic #829, decision record
 * #871, D5). A verdict over it cannot be published at all.
 */
export const VERDICT_SIZE_LIMIT = 65_536;

export type CheckVerdictPublishResult =
    | {
          ok: true;
          repos: VerdictRepos;
          /** The exact bytes approved: the drafted body, or that body with its file lists dropped to fit (D5). */
          body: string;
          /** True when the file lists were dropped so the body fits the platform's limit. */
          filesDropped: boolean;
          /** The approved body's size in characters. */
          size: number;
      }
    | { ok: false; error: EpicVerdictsDiagnostic };

/** The size the platform counts: characters, not UTF-16 code units. */
const sizeOf = (body: string): number => [...body].length;

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

    const judged = checkJudgments(body, parsed);
    if (!judged.ok) return judged;
    return fitToPlatform(body, judged.judgments, resolved.repos);
}

/**
 * The size budget (D5; G29). A body within the platform's limit is approved as drafted. One over
 * it drops its file lists first — every item and result keeps its verdict, and the block records
 * `filesDropped`, which makes the next answer-recording run on a moved head a full run — and says
 * so in a line above the verdict block. If it is still too large, nothing may be published, and the
 * refusal names the size.
 */
function fitToPlatform(body: string, judgments: Judgments, repos: VerdictRepos): CheckVerdictPublishResult {
    const drafted = sizeOf(body);
    if (drafted <= VERDICT_SIZE_LIMIT) return { ok: true, repos, body, filesDropped: false, size: drafted };
    const replaced = replaceJudgmentsBlock(body, withoutFileLists(judgments)) ?? body;
    const at = replaced.indexOf(RECEIPT_MARKER);
    const notice = `File lists: dropped to fit the platform's limit of ${VERDICT_SIZE_LIMIT} characters (the verdict was ${drafted}). The next answer-recording run on a moved head judges the whole pull request again.\n\n`;
    const fitted = `${replaced.slice(0, at)}${notice}${replaced.slice(at)}`;
    const size = sizeOf(fitted);
    if (size <= VERDICT_SIZE_LIMIT) return { ok: true, repos, body: fitted, filesDropped: true, size };
    return refuse(
        "verdict-too-large",
        `the drafted verdict is ${drafted} characters, and still ${size} with its file lists dropped — over the platform's limit of ${VERDICT_SIZE_LIMIT}. Nothing may be published. Shorten the summary prose above the verdict block (the judgments block carries every item in full) and check again.`,
    );
}

/**
 * The judgments block (epic #829, stories #858, #860 and #862; decision record #871, D2, D4, D5,
 * D7; G7, G14, G15, G25–G28). Every verdict carries one, even with no item in it, because it is the
 * next run's ID registry: a verdict published without it would reset the numbering, and an ID
 * could then name two items on one pull request. It must follow the verdict block, so the deployed
 * readers' first-fence parse still finds the verdict block, and each marker must appear once, so
 * text copied from an answer into the prose cannot hand either parser a block of its own. The
 * severity counts are the counts of the items still open, because the merge pre-check and close
 * block on those counts and must stop blocking on an item once it is answered or deferred. The key
 * decisions are tied to the record digest the verdict block stamps, and no deferred-scope proposal
 * settles a criterion of a story this pull request does not cover.
 */
function checkJudgments(body: string, receipt: AnalyzeReceipt): { ok: true; judgments: Judgments } | { ok: false; error: EpicVerdictsDiagnostic } {
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
    for (const marker of [RECEIPT_MARKER, JUDGMENTS_MARKER]) {
        if (body.split(marker).length > 2) {
            return refuse(
                "marker-repeated",
                `the drafted verdict carries ${marker} more than once, so a reader could parse the wrong block. Text copied into the summary — an answer's reason, most often — carries the marker: write its \`<!--\` as \`&lt;!--\` in the summary (the judgments block already carries it safely) and check again.`,
            );
        }
    }
    const parsed = parseJudgmentsBlock(body);
    if (!parsed.ok) return refuse("judgments-malformed", `the drafted verdict's judgments block cannot be read: ${parsed.message}.`);
    const judgments = parsed.judgments as Judgments;

    const key = judgments.keyDecisions;
    if (key === undefined) {
        return refuse(
            "key-decisions-missing",
            "the drafted verdict's judgments block carries no key decisions. Pass the record body and digest (`--record-body`, `--record-hash`) and the confirmed stubs to `nexus verdict-items`, append the block it writes, and check again; a verdict on an epic with no record still carries them, with no record.",
        );
    }
    if ((key.record?.digest ?? null) !== (receipt.recordHash ?? null)) {
        return refuse(
            "key-decisions-stale",
            `the drafted verdict's key decisions name record digest ${key.record?.digest ?? "none"}, but its verdict block stamps \`record_hash: ${receipt.recordHash ?? "none"}\`. Close resolves the decisions' text from the record that digest pins, so the two must be the same: run \`nexus verdict-items\` again with the digest the verdict stamps and check again.`,
        );
    }

    const covered = new Set(receipt.stories);
    const findings = new Map(judgments.findings.map((f) => [f.id, f]));
    for (const ds of judgments.deferred.filter((d) => d.found)) {
        const parent = findings.get(ds.settles);
        if (parent === undefined) continue;
        const story = /#(\d+)/.exec(parent.about);
        if (story === null || !covered.has(Number(story[1]))) {
            return refuse(
                "deferred-scope-sibling",
                `deferred-scope proposal ${ds.id} settles ${ds.settles} (${parent.about}), which is not a criterion of a story this verdict covers (${receipt.stories.map((n) => `#${n}`).join(", ") || "none"}). Scope is proposed for deferral only from an unmet or partial criterion of a covered story, or from record scope the delivered stories leave out (a departure); scope a sibling story will deliver is never proposed. Drop the proposal and check again.`,
            );
        }
    }

    const open = openItems(judgments);
    for (const severity of ["critical", "high", "medium", "low"] as const) {
        const atSeverity = open.filter((d) => d.severity === severity);
        const counted = receipt.findings[severity] ?? 0;
        if (atSeverity.length !== counted) {
            const listed = atSeverity.length === 0 ? "none" : atSeverity.map((d) => d.id).join(", ");
            return refuse(
                "counts-not-open",
                `the drafted verdict counts ${counted} ${severity} finding(s), but its open ${severity} items are ${atSeverity.length} (${listed}). The counts are the items still open: every unanswered departure and finding \`nexus verdict-items\` listed whose deferral no one approved, and no answered or unlisted one. Write the counts it printed as \`open\` and check again.`,
            );
        }
    }
    return { ok: true, judgments };
}

function refuse(problem: EpicVerdictsDiagnostic["problem"], message: string): { ok: false; error: EpicVerdictsDiagnostic } {
    return { ok: false, error: { problem, message } };
}
