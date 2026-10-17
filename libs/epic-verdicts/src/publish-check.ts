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
    withoutResultFileLists,
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
/**
 * The remedy every refusal of a hand-reachable defect ends with. The model writes no byte of the
 * published verdict (epic #923, record #949, G3): `nexus verdict-items` writes all of it, so a body
 * that fails here was edited after that step or built from a wrong run fact, and the fix is the
 * draft or `facts.json`, never the body.
 */
const RERUN_ID_STEP = "Leave the body unedited: run `nexus verdict-items` again and check the body it writes.";

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
                message: `the drafted verdict carries no parseable ${RECEIPT_MARKER} block, so nothing states which repository its story numbers resolve against. ${RERUN_ID_STEP}`,
            },
        };
    }

    if (parsed.issuesRepo === null) {
        return {
            ok: false,
            error: {
                problem: "issues-repo-missing",
                message: `the drafted verdict names no issues repository; it must carry \`issues_repo: ${issuesRepo}\` — the repository its epic, record and story numbers resolve against (the analyzed pull request's code repository is ${repo}). Set \`issuesRepo\` in \`facts.json\` to ${issuesRepo}, then run \`nexus verdict-items\` again and check the body it writes.`,
            },
        };
    }

    if (!sameRepo(parsed.issuesRepo, issuesRepo)) {
        return {
            ok: false,
            error: {
                problem: "issues-repo-mismatch",
                message: `the drafted verdict names \`issues_repo: ${parsed.issuesRepo}\`, but this checkout's issues live in ${issuesRepo}. Set \`issuesRepo\` in \`facts.json\` to ${issuesRepo}, then run \`nexus verdict-items\` again and check the body it writes.`,
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
                message: `the drafted verdict records \`story_fingerprints:\`; a receipt no longer records the text of the stories it covers, and the ID step never writes that line. ${RERUN_ID_STEP}`,
            },
        };
    }

    const judged = checkJudgments(body, parsed);
    if (!judged.ok) return judged;
    return fitToPlatform(body, judged.judgments, resolved.repos);
}

/**
 * The size budget (D5; G29). A body within the platform's limit is approved as drafted. One over
 * it drops the results' file lists and says so in a line above the verdict block. Every item and
 * result keeps its verdict, and the block records `filesDropped`, which makes the next
 * answer-recording run on a moved head a full run. A departure's or a finding's file list is never
 * dropped: the next full run gives an item found again its ID by a shared file (D2), so dropping
 * those lists would re-number every item on the same head and lose its answer (G6). If the body is
 * still too large, nothing may be published, and the refusal names the size.
 */
function fitToPlatform(body: string, judgments: Judgments, repos: VerdictRepos): CheckVerdictPublishResult {
    const drafted = sizeOf(body);
    if (drafted <= VERDICT_SIZE_LIMIT) return { ok: true, repos, body, filesDropped: false, size: drafted };
    const replaced = replaceJudgmentsBlock(body, withoutResultFileLists(judgments)) ?? body;
    const at = replaced.indexOf(RECEIPT_MARKER);
    const notice = `File lists: dropped from the results to fit the platform's limit of ${VERDICT_SIZE_LIMIT} characters (the verdict was ${drafted}); the departures and findings keep theirs. The next answer-recording run on a moved head judges the whole pull request again.\n\n`;
    const fitted = `${replaced.slice(0, at)}${notice}${replaced.slice(at)}`;
    const size = sizeOf(fitted);
    if (size <= VERDICT_SIZE_LIMIT) return { ok: true, repos, body: fitted, filesDropped: true, size };
    return refuse(
        "verdict-too-large",
        `the drafted verdict is ${drafted} characters, and still ${size} with its results' file lists dropped — over the platform's limit of ${VERDICT_SIZE_LIMIT}. Nothing may be published. A departure's or a finding's file list is never dropped, because the next run reuses its ID by that list. Shorten the longest draft fields and run the ID step again: ${longestFields(judgments).join("; ")}.`,
    );
}

/**
 * The longest text the draft supplied, by item ID or by what a result judges (epic #923, D13). The
 * model no longer writes summary prose, so the draft's own fields are the only text of variable
 * length a verdict over the limit can shorten.
 */
export function longestFields(judgments: Judgments, count = 3): string[] {
    const fields: Array<{ name: string; length: number }> = [];
    const add = (owner: string, field: string, text: string | undefined | null): void => {
        if (typeof text === "string" && text.length > 0) fields.push({ name: `${owner} ${field}`, length: [...text].length });
    };
    for (const item of [...judgments.items, ...judgments.findings]) {
        add(item.id, "summary", item.summary);
        add(item.id, item.kind === "departure" ? "departsFrom" : "about", item.kind === "departure" ? item.departsFrom : item.about);
    }
    for (const ds of judgments.deferred) add(ds.id, "summary", ds.summary);
    for (const r of judgments.results ?? []) {
        add(r.about, "looked", r.looked);
        add(r.about, "confirmBy", r.confirmBy);
        add(r.about, "evidence", r.evidence);
    }
    (judgments.scopeDrift ?? []).forEach((t, i) => add(`scopeDrift ${i + 1}`, "text", t));
    (judgments.notes ?? []).forEach((t, i) => add(`notes ${i + 1}`, "text", t));
    // Longest first; a tie keeps the order above, so the refusal names the same fields every time.
    return fields
        .map((f, i) => ({ ...f, i }))
        .sort((a, b) => b.length - a.length || a.i - b.i)
        .slice(0, count)
        .map((f) => `${f.name} (${f.length} characters)`);
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
            `the drafted verdict carries no ${JUDGMENTS_MARKER} block. A verdict with no item still carries the block. ${RERUN_ID_STEP}`,
        );
    }
    if (at < body.indexOf(RECEIPT_MARKER)) {
        return refuse("judgments-malformed", `the drafted verdict puts its ${JUDGMENTS_MARKER} block before the verdict block; it must follow it. ${RERUN_ID_STEP}`);
    }
    for (const marker of [RECEIPT_MARKER, JUDGMENTS_MARKER]) {
        if (body.split(marker).length > 2) {
            return refuse(
                "marker-repeated",
                `the drafted verdict carries ${marker} more than once, so a reader could parse the wrong block. The ID step writes draft text with its \`<\` escaped, so the marker was added to the body after it. ${RERUN_ID_STEP}`,
            );
        }
    }
    const parsed = parseJudgmentsBlock(body);
    if (!parsed.ok) return refuse("judgments-malformed", `the drafted verdict's judgments block cannot be read: ${parsed.message}. ${RERUN_ID_STEP}`);
    const judgments = parsed.judgments as Judgments;

    const key = judgments.keyDecisions;
    if (key === undefined) {
        return refuse(
            "key-decisions-missing",
            "the drafted verdict's judgments block carries no key decisions. Run `nexus verdict-items` again with the record body and digest (`--record-body`, `--record-hash`) and the confirmed stubs in the draft, and check the body it writes; a verdict on an epic with no record still carries them, with no record.",
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
                `deferred-scope proposal ${ds.id} settles ${ds.settles} (${parent.about}), which is not a criterion of a story this verdict covers (${receipt.stories.map((n) => `#${n}`).join(", ") || "none"}). Scope is proposed for deferral only from an unmet or partial criterion of a covered story, or from record scope the delivered stories leave out (a departure); scope a sibling story will deliver is never proposed. Remove that \`deferred\` from the draft, then run \`nexus verdict-items\` again and check the body it writes.`,
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
                `the drafted verdict counts ${counted} ${severity} finding(s), but its open ${severity} items are ${atSeverity.length} (${listed}). The counts are the items still open: every unanswered departure and finding \`nexus verdict-items\` listed whose deferral no one approved, and no answered or unlisted one. The ID step stamps those counts itself. ${RERUN_ID_STEP}`,
            );
        }
    }
    return { ok: true, judgments };
}

function refuse(problem: EpicVerdictsDiagnostic["problem"], message: string): { ok: false; error: EpicVerdictsDiagnostic } {
    return { ok: false, error: { problem, message } };
}
