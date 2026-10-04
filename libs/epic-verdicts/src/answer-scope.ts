/**
 * The answer-recording run (epic #829, story #861, decision record #871, D8; G18–G24).
 *
 * Answering a departure on a pull request should cost a short run, not a full review. So when
 * analyze runs to record answers, it first asks this module what it may skip:
 *
 * - **Stop** when the pull request carries no earlier trusted verdict, or one published before the
 *   judgments block existed: there is nothing to carry forward, and a full run is named (G23).
 * - **Full** — judge the whole pull request again, and say why — when the record digest changed
 *   (G21), the story set changed, the epic-level state changed, the earlier verdict recorded no
 *   results, or, on a moved head, it dropped its file lists or its head cannot be read (G22).
 * - **Unchanged** — the head, the record and the story set are all as the earlier verdict stamped
 *   them: read no code, copy the answers in, publish a complete new verdict (G18).
 * - **Moved** — compute the changed files: those whose own change differs between the two heads,
 *   by #849 D4's comparison, so a trunk merge or a rebase changes nothing by itself (G20). Judge
 *   again every answered departure and every item or result a changed file touches; an empty file
 *   list counts as touched by any change, and a changed file no list names is checked for new
 *   departures and against every guarantee (R5). Everything else is carried forward unchanged
 *   (G19).
 *
 * The new verdict is complete either way (G24): {@link mergeAnswerRun} puts what was judged again
 * and what was carried into one set of judgments, and it supersedes the earlier verdict through the
 * existing newest-trusted rule — no reader needs the earlier one.
 *
 * A deferred-scope proposal (story #862) travels with the item it would settle: carried when that
 * item is carried, judged again when it is. The key decisions are carried forward as they were,
 * unless the run hands in the confirmed stubs again.
 */

import {
    type ConfirmedStub,
    type EpicLevel,
    type Judgments,
    type Result,
    type ResultKind,
    parseJudgmentsBlock,
    resultKey,
} from "@nexus/pr-acceptance/judgments-block";
import { verifyReceipt } from "@nexus/pr-acceptance/verify";
import { compareOwnChange } from "@nexus/pr-worktree/landed-change";
import { type EpicVerdictsDiagnostic } from "./diagnostic.js";
import { type Runner } from "./run.js";
import { type DepartureDraft, type FindingDraft, assignItemIds } from "./verdict-items.js";

/** What the earlier verdict stamped, and the judgments it carries (null when it carries none). */
export interface EarlierVerdict {
    head: string;
    /** The platform timestamp of the verdict, which identifies it among the pull request's verdicts. */
    at: string;
    stories: number[];
    recordHash: string | null;
    judgments: Judgments | null;
}

/** What this run resolved, before reading any code. */
export interface CurrentRun {
    /** The pull request's head now: the analyzed head the worktree was opened at. */
    head: string;
    stories: number[];
    /** The record digest now, or null in degraded mode. */
    recordHash: string | null;
    epicLevel: EpicLevel;
}

export type AnswerMode = "stop" | "full" | "unchanged" | "moved";

export type AnswerReason =
    | "no-verdict"
    | "no-judgments"
    | "record-revised"
    | "stories-changed"
    | "epic-level-changed"
    | "results-unrecorded"
    | "file-lists-dropped"
    | "earlier-head-unreadable";

export interface ResultRef {
    kind: ResultKind;
    about: string;
}

export interface Rejudge {
    /** The IDs of the departures and findings to judge again. */
    items: string[];
    /** The results to judge again. */
    results: ResultRef[];
    /** Changed files no item or result lists: checked for new departures and against every guarantee. */
    unlisted: string[];
}

/** The scope an answer-recording run works in. Written to a file, and handed back to the ID step. */
export interface AnswerScope {
    mode: AnswerMode;
    reason: AnswerReason | null;
    /** The verdict the run carries forward from, by its head and timestamp; null when there is none. */
    earlier: { head: string; at: string } | null;
    changedFiles: string[];
    rejudge: { items: string[]; results: ResultRef[] };
    unlisted: string[];
    /** The run's report, as the stage repeats it. */
    lines: string[];
}

const sameSet = (a: readonly number[], b: readonly number[]): boolean => {
    const x = [...new Set(a)].sort((m, n) => m - n);
    const y = [...new Set(b)].sort((m, n) => m - n);
    return x.length === y.length && x.every((v, i) => v === y[i]);
};

/**
 * Decide, from the stamps alone, whether the run stops, judges in full, or records answers — and on
 * a moved head, whether the earlier verdict can say what a change affects. Whether the earlier head
 * can still be read is decided later, by trying.
 */
export function decideAnswerMode(earlier: EarlierVerdict | null, current: CurrentRun): { mode: AnswerMode; reason: AnswerReason | null } {
    if (earlier === null) return { mode: "stop", reason: "no-verdict" };
    const j = earlier.judgments;
    if (j === null) return { mode: "stop", reason: "no-judgments" };
    if ((earlier.recordHash ?? null) !== (current.recordHash ?? null)) return { mode: "full", reason: "record-revised" };
    if (!sameSet(earlier.stories, current.stories)) return { mode: "full", reason: "stories-changed" };
    if (j.epicLevel !== current.epicLevel) return { mode: "full", reason: "epic-level-changed" };
    if (j.results === undefined) return { mode: "full", reason: "results-unrecorded" };
    if (earlier.head === current.head) return { mode: "unchanged", reason: null };
    if (j.filesDropped === true) return { mode: "full", reason: "file-lists-dropped" };
    return { mode: "moved", reason: null };
}

const normalizePath = (s: string): string => s.trim().replace(/^\.\//, "");

/**
 * What a moved head's changed files affect (G19, R5). Every answered departure is judged again,
 * whatever changed — one whose deferral was approved (D7) included. An item or result is judged again when its file list holds a changed file, or
 * when its list is empty and anything changed. A changed file that no list names is returned as
 * unlisted, and puts every guarantee result in scope.
 */
export function selectRejudge(judgments: Judgments, changedFiles: readonly string[]): Rejudge {
    const changed = new Set(changedFiles.map(normalizePath));
    const affected = (files: readonly string[]): boolean => (files.length === 0 ? changed.size > 0 : files.some((p) => changed.has(normalizePath(p))));
    const deferralApproved = (id: string): boolean => judgments.deferred.some((ds) => ds.settles === id && ds.answer !== null);

    const items = [
        ...judgments.items.filter((d) => d.answer !== null || deferralApproved(d.id) || affected(d.files)).map((d) => d.id),
        ...judgments.findings.filter((x) => affected(x.files)).map((x) => x.id),
    ];

    const listed = new Set<string>();
    const lists: Array<readonly unknown[]> = [
        ...judgments.items.map((d) => d.files),
        ...judgments.findings.map((x) => x.files),
        ...(judgments.results ?? []).map((r) => r.files),
    ];
    for (const list of lists) for (const p of list) if (typeof p === "string") listed.add(normalizePath(p));
    const unlisted = [...changed].filter((p) => !listed.has(p)).sort();

    const results = (judgments.results ?? [])
        .filter((r) => affected(r.files) || (unlisted.length > 0 && r.kind === "guarantee"))
        .map((r) => ({ kind: r.kind, about: r.about }));
    return { items, results, unlisted };
}

export type ReadEarlierResult = { ok: true; earlier: EarlierVerdict | null } | { ok: false; error: EpicVerdictsDiagnostic };

/**
 * The newest trusted verdict on pull request `pr` in `repo`, picked by the same reader close and the
 * merge pre-check use, with its stamps and its judgments. Null when the pull request carries none. A
 * newest verdict whose judgments cannot be read stops the run: what it would carry is unknown.
 */
export function readEarlierVerdict(run: Runner, cwd: string, pr: number, repo: string, issuesRepo: string): ReadEarlierResult {
    const r = verifyReceipt(run, cwd, pr, repo, issuesRepo, { ghRepo: repo });
    if (!r.ok) return { ok: false, error: { problem: "gh-failed", message: r.error.message } };
    if (!r.value.found || r.value.receipt === null) return { ok: true, earlier: null };
    const parsed = parseJudgmentsBlock(r.value.rawBody);
    if (!parsed.ok) {
        return {
            ok: false,
            error: {
                problem: "judgments-malformed",
                message: `the newest verdict on PR #${pr} in ${repo} carries a judgments block that cannot be read (${parsed.message}), so nothing can be carried forward from it. Run the full analyze after correcting or removing that verdict.`,
            },
        };
    }
    const receipt = r.value.receipt;
    return {
        ok: true,
        earlier: { head: receipt.head, at: r.value.at, stories: receipt.stories, recordHash: receipt.recordHash, judgments: parsed.judgments },
    };
}

/** The reads a plan is built from, injected so a spec can stand in for the platform and for git. */
export interface AnswerScopeDeps {
    readEarlier(): ReadEarlierResult;
    /** The files whose own change differs between the two heads, or why that cannot be read. */
    ownChange(earlierHead: string, head: string): { ok: true; changed: string[] } | { ok: false; message: string };
}

/**
 * The platform- and git-backed reads: the newest trusted verdict through the reader close uses, and
 * the own-change comparison close's landed check makes, run in the pull request's worktree `cwd`
 * from the pull request's base `base`, leaving out `excludes` (the pipeline stores).
 */
export function answerScopeDeps(
    run: Runner,
    cwd: string,
    input: { pr: number; repo: string; issuesRepo: string; base: string; excludes: readonly string[] },
): AnswerScopeDeps {
    return {
        readEarlier: () => readEarlierVerdict(run, cwd, input.pr, input.repo, input.issuesRepo),
        ownChange: (earlierHead, head) => {
            const r = compareOwnChange(run, cwd, { base: input.base, earlierHead, head, excludes: input.excludes });
            if (!r.ok) return { ok: false, message: r.error.message };
            return { ok: true, changed: r.files.filter((f) => f.status === "changed").map((f) => f.path) };
        },
    };
}

/**
 * Read back a scope `nexus verdict-scope` wrote, for the ID step. Only an unchanged or moved scope
 * records answers; anything else is refused, naming why.
 */
export function parseAnswerScope(text: string): { ok: true; scope: AnswerScope } | { ok: false; message: string } {
    let doc: unknown;
    try {
        doc = JSON.parse(text);
    } catch (e) {
        return { ok: false, message: `the scope is not valid JSON (${e instanceof Error ? e.message : String(e)})` };
    }
    if (doc === null || typeof doc !== "object" || Array.isArray(doc)) return { ok: false, message: "the scope is not an object" };
    const s = doc as Record<string, unknown>;
    if (s["mode"] !== "unchanged" && s["mode"] !== "moved") {
        return { ok: false, message: `the scope's mode is ${JSON.stringify(s["mode"])}, which records no answers: only an unchanged or a moved head does` };
    }
    const earlier = s["earlier"] as Record<string, unknown> | null | undefined;
    if (earlier === null || typeof earlier !== "object" || typeof earlier["head"] !== "string" || typeof earlier["at"] !== "string") {
        return { ok: false, message: "the scope names no earlier verdict to carry forward from" };
    }
    const rejudge = s["rejudge"] as Record<string, unknown> | undefined;
    const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
    const refs = (v: unknown): v is ResultRef[] =>
        Array.isArray(v) && v.every((x) => x !== null && typeof x === "object" && typeof (x as ResultRef).kind === "string" && typeof (x as ResultRef).about === "string");
    if (rejudge === undefined || !strings(rejudge["items"]) || !refs(rejudge["results"]) || !strings(s["changedFiles"]) || !strings(s["unlisted"])) {
        return { ok: false, message: "the scope does not say what to judge again (rejudge, changedFiles, unlisted)" };
    }
    return {
        ok: true,
        scope: {
            mode: s["mode"],
            reason: null,
            earlier: { head: earlier["head"], at: earlier["at"] },
            changedFiles: s["changedFiles"],
            rejudge: { items: rejudge["items"], results: rejudge["results"] },
            unlisted: s["unlisted"],
            lines: strings(s["lines"]) ? s["lines"] : [],
        },
    };
}

export type PlanAnswerRunResult = { ok: true; scope: AnswerScope } | { ok: false; error: EpicVerdictsDiagnostic };

const FULL_WHY: Readonly<Record<string, string>> = {
    "record-revised": "the decision record was revised since the last verdict",
    "stories-changed": "the pull request's story set changed since the last verdict",
    "epic-level-changed": "whether this pull request gets the epic-level judgment changed since the last verdict",
    "results-unrecorded": "the last verdict records no criterion or guarantee results, so it cannot say what a change affects",
    "file-lists-dropped": "the last verdict dropped its file lists, so it cannot say what a change affects",
    "earlier-head-unreadable": "the head the last verdict analyzed cannot be read here, so what changed since cannot be computed",
};

/** Decide the run's scope, computing the changed files only when the head moved. */
export function planAnswerRun(deps: AnswerScopeDeps, input: { pr: number; current: CurrentRun }): PlanAnswerRunResult {
    const read = deps.readEarlier();
    if (!read.ok) return read;
    const earlier = read.earlier;
    const decided = decideAnswerMode(earlier, input.current);
    const base = { earlier: earlier === null ? null : { head: earlier.head, at: earlier.at }, changedFiles: [], rejudge: { items: [], results: [] }, unlisted: [] };
    const full = `/nxs.analyze --pr ${input.pr}`;

    if (decided.mode === "stop") {
        const why =
            decided.reason === "no-verdict"
                ? `PR #${input.pr} carries no trusted analyze verdict`
                : `the newest verdict on PR #${input.pr} was published before verdicts carried their judgments`;
        return { ok: true, scope: { ...base, ...decided, lines: [`Answers not recorded: ${why}, so there is nothing to record them against. Run ${full} (a full analyze run) first.`] } };
    }
    if (decided.mode === "full") return { ok: true, scope: fullScope(base, decided.reason as AnswerReason, null) };
    if (decided.mode === "unchanged") {
        return {
            ok: true,
            scope: { ...base, ...decided, lines: [`Recording answers only: the head, the decision record and the story set are unchanged since the last verdict, so no code is read.`] },
        };
    }

    // earlier is non-null and carries judgments with results here, or decideAnswerMode would have stopped.
    const prior = earlier as EarlierVerdict & { judgments: Judgments };
    const own = deps.ownChange(prior.head, input.current.head);
    if (!own.ok) return { ok: true, scope: fullScope(base, "earlier-head-unreadable", own.message) };
    const sel = selectRejudge(prior.judgments, own.changed);
    const lines = [
        `Recording answers on a moved head: ${own.changed.length} file(s) changed in the pull request's own change since ${prior.head.slice(0, 12)}` +
            (own.changed.length === 0 ? " (a trunk merge or rebase changes nothing by itself)." : `: ${own.changed.join(", ")}.`),
        `Judging again: ${sel.items.length === 0 ? "no item" : sel.items.join(", ")}; ${sel.results.length === 0 ? "no result" : sel.results.map((r) => r.about).join(", ")}.`,
    ];
    if (sel.unlisted.length > 0) lines.push(`Checking for new departures and against every guarantee: ${sel.unlisted.join(", ")} (named by no file list).`);
    lines.push("Everything else is carried forward unchanged.");
    return {
        ok: true,
        scope: { ...base, mode: "moved", reason: null, changedFiles: [...own.changed].sort(), rejudge: { items: sel.items, results: sel.results }, unlisted: sel.unlisted, lines },
    };
}

function fullScope(base: Omit<AnswerScope, "mode" | "reason" | "lines">, reason: AnswerReason, detail: string | null): AnswerScope {
    const why = FULL_WHY[reason] ?? reason;
    return { ...base, mode: "full", reason, lines: [`Judging the whole pull request again: ${why}${detail === null ? "" : ` (${detail})`}.`] };
}

/** The draft an answer-recording run on a moved head hands in: what it judged again. */
export interface RejudgeDraft {
    departures: DepartureDraft[];
    findings: FindingDraft[];
    results?: Result[];
    /** The confirmed stubs, handed in again when a changed file bears on one; otherwise carried. */
    stubs?: ConfirmedStub[];
}

export type MergeResult = { ok: true; judgments: Judgments } | { ok: false; message: string };

/**
 * The complete judgments the new verdict carries (G24), before this run's answers are applied.
 *
 * On an unchanged head they are the earlier verdict's judgments, unchanged: no code was read, so
 * there is no draft. On a moved head the drafted departures and findings are numbered against the
 * items in scope only — those not found again are listed as no longer found, with their answers —
 * and every item out of scope is carried as it was. Every result in scope must be judged again,
 * and no result out of scope may be: it is carried forward unchanged, in its place.
 */
export function mergeAnswerRun(earlier: Judgments, scope: AnswerScope, draft: RejudgeDraft | null): MergeResult {
    if (scope.mode === "unchanged") {
        if (draft !== null) return { ok: false, message: "the head has not moved, so no code is read and no draft is taken; drop --draft" };
        return { ok: true, judgments: earlier };
    }
    if (scope.mode !== "moved") return { ok: false, message: `a ${scope.mode} scope records no answers; ${scope.mode === "full" ? "run the full analyze" : "run the full analyze first"}` };
    if (draft === null) return { ok: false, message: "the head moved, so the items and results in scope must be judged again; pass them as --draft" };

    const inScope = new Set(scope.rejudge.results.map(resultKey));
    const known = new Set((earlier.results ?? []).map(resultKey));
    const judged = new Map<string, Result>();
    for (const r of draft.results ?? []) {
        const key = resultKey(r);
        if (known.has(key) && !inScope.has(key)) {
            return { ok: false, message: `the draft judges ${r.kind} ${r.about} again, but the scope carries it forward unchanged; leave it out` };
        }
        judged.set(key, r);
    }
    const missing = scope.rejudge.results.filter((r) => !judged.has(resultKey(r)));
    if (missing.length > 0) {
        return { ok: false, message: `the draft does not judge again ${missing.map((r) => `${r.kind} ${r.about}`).join(", ")}, which the changed files affect` };
    }

    const numbered = assignItemIds(earlier, draft.departures, draft.findings, new Set(scope.rejudge.items));
    const results = (earlier.results ?? []).map((r) => judged.get(resultKey(r)) ?? r);
    for (const [key, r] of judged) if (!known.has(key)) results.push(r);
    const merged: Judgments = { ...numbered, results };
    if (earlier.epicLevel !== undefined) merged.epicLevel = earlier.epicLevel;
    if (earlier.keyDecisions !== undefined || draft.stubs !== undefined) {
        merged.keyDecisions = { record: earlier.keyDecisions?.record ?? null, stubs: draft.stubs ?? earlier.keyDecisions?.stubs ?? [] };
    }
    return { ok: true, judgments: merged };
}
