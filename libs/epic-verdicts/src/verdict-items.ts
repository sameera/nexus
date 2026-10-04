/**
 * The ID step of the conformance gate (epic #829, decision record #871, D2–D4; G6–G17): story #858
 * numbered departures, story #860 adds findings and the answers on the pull request.
 *
 * Analyze judges which places the code departs from the decision record, and what else it finds
 * wrong. It does not number them: the engineer answers an item by its ID, so an ID must survive a
 * re-run, and a model asked to produce the same numbering twice will not. The numbering is done
 * here instead, against a registry — the items in the newest trusted verdict on the same pull
 * request.
 *
 * - An item found again keeps its ID. Two departures count as the same when they cite the same
 *   record element and share a file (or neither names a file); two findings, when they judge the
 *   same thing and share a file.
 * - A new departure takes the next unused number. Every number ever issued stays in the registry,
 *   so none is reused and one ID never names two items on a pull request.
 * - A departure a later run does not find again stays listed as no longer found, with its answer.
 *   If it is found again it gets its ID back.
 *
 * Severity is decided here too, from the one fact the judgment supplies: an unanswered departure
 * that breaks a guarantee or an invariant is critical, any other is high (G14).
 */

import {
    type Departure,
    type EpicLevel,
    type Finding,
    type ItemAnswer,
    type Judgments,
    type Result,
    parseJudgmentsBlock,
    readResults,
    splitItemId,
} from "@nexus/pr-acceptance/judgments-block";
import { verifyReceipt } from "@nexus/pr-acceptance/verify";
import { type AnswerVerb, type PrAnswer } from "@nexus/pr-acceptance/waiver";
import { type EpicVerdictsDiagnostic } from "./diagnostic.js";
import { type Runner } from "./run.js";

/** One departure as analyze judged it, before it has an ID. */
export interface DepartureDraft {
    departsFrom: string;
    summary: string;
    /** Whether it breaks a guarantee or an invariant — the one fact its severity follows from. */
    breaksGuarantee: boolean;
    files: string[];
    stub: { path: string; reason: string } | null;
    supersedes: { decision: string; instead: string } | null;
}

/** One finding as analyze judged it, before it has an ID. */
export interface FindingDraft {
    /** What it judges: an acceptance criterion, a success metric, or a named check. */
    about: string;
    severity: Finding["severity"];
    summary: string;
    files: string[];
}

export type ParsedDraft =
    | {
          ok: true;
          departures: DepartureDraft[];
          findings: FindingDraft[];
          /** Every criterion, guarantee and metric result with its files (story #861, D8); absent when the draft records none. */
          results?: Result[];
          epicLevel?: EpicLevel;
      }
    | { ok: false; message: string };

/**
 * Read the draft analyze wrote: `{ "departures": [ ... ], "findings": [ ... ], "results": [ ... ],
 * "epicLevel": ... }`. A draft with no findings list has none; one with no results list records
 * none, which makes the next answer-recording run a full one. Every refusal names the entry.
 */
export function parseItemDraft(text: string): ParsedDraft {
    let doc: unknown;
    try {
        doc = JSON.parse(text);
    } catch (e) {
        return { ok: false, message: `the draft is not valid JSON (${e instanceof Error ? e.message : String(e)})` };
    }
    if (!isRecord(doc) || !Array.isArray(doc["departures"])) return { ok: false, message: "the draft carries no departures list" };
    const rawFindings = doc["findings"] ?? [];
    if (!Array.isArray(rawFindings)) return { ok: false, message: "the draft's findings is not a list" };
    const departures: DepartureDraft[] = [];
    for (const [i, raw] of doc["departures"].entries()) {
        const d = readDraft(raw);
        if (typeof d === "string") return { ok: false, message: `departure ${i} ${d}` };
        departures.push(d);
    }
    const findings: FindingDraft[] = [];
    for (const [i, raw] of rawFindings.entries()) {
        const f = readFindingDraft(raw);
        if (typeof f === "string") return { ok: false, message: `finding ${i} ${f}` };
        findings.push(f);
    }
    const parsed: ParsedDraft = { ok: true, departures, findings };
    if (doc["results"] !== undefined) {
        const results = readResults(doc["results"]);
        if (typeof results === "string") return { ok: false, message: results };
        parsed.results = results;
    }
    if (doc["epicLevel"] !== undefined) {
        const level = doc["epicLevel"];
        if (level !== "judge" && level !== "not-run" && level !== "skip") return { ok: false, message: "the draft's epicLevel is not judge, not-run or skip" };
        parsed.epicLevel = level;
    }
    return parsed;
}

const SEVERITIES: readonly string[] = ["critical", "high", "medium", "low"];

function readFindingDraft(raw: unknown): FindingDraft | string {
    if (!isRecord(raw)) return "is not an object";
    const { about, severity, summary, files } = raw;
    if (!nonEmpty(about)) return "names nothing it judges (about)";
    if (typeof severity !== "string" || !SEVERITIES.includes(severity)) return "has no severity of critical, high, medium or low (severity)";
    if (!nonEmpty(summary)) return "says nothing about what is wrong (summary)";
    if (!Array.isArray(files) || !files.every((f) => typeof f === "string")) return "has no file list (files)";
    return { about, severity: severity as Finding["severity"], summary, files: files as string[] };
}

function readDraft(raw: unknown): DepartureDraft | string {
    if (!isRecord(raw)) return "is not an object";
    const { departsFrom, summary, breaksGuarantee, files } = raw;
    const stub = raw["stub"] ?? null;
    const supersedes = raw["supersedes"] ?? null;
    if (!nonEmpty(departsFrom)) return "names nothing it departs from (departsFrom)";
    if (!nonEmpty(summary)) return "says nothing about what the code does (summary)";
    if (typeof breaksGuarantee !== "boolean") return "does not say whether it breaks a guarantee or an invariant (breaksGuarantee)";
    if (!Array.isArray(files) || !files.every((f) => typeof f === "string")) return "has no file list (files)";
    if (stub !== null && !(isRecord(stub) && nonEmpty(stub["path"]) && nonEmpty(stub["reason"]))) {
        return "names a stub without its path and reason (stub)";
    }
    if (supersedes !== null && !(isRecord(supersedes) && nonEmpty(supersedes["decision"]) && nonEmpty(supersedes["instead"]))) {
        return "is marked superseding without naming the decision and what the code does instead (supersedes)";
    }
    return {
        departsFrom,
        summary,
        breaksGuarantee,
        files: files as string[],
        stub: stub === null ? null : { path: stub["path"] as string, reason: stub["reason"] as string },
        supersedes: supersedes === null ? null : { decision: supersedes["decision"] as string, instead: supersedes["instead"] as string },
    };
}

/**
 * Number the drafted departures and findings against `registry`, the judgments of the newest
 * trusted verdict on the same pull request, or null when it has none. Returns the complete
 * judgments the new verdict carries, before this run's answers are applied.
 *
 * `rejudge` scopes an answer-recording run on a moved head (story #861, D8): only the registry items
 * it names were judged again, so only they can be found again or go unfound; every other item is
 * carried forward unchanged, and a new item still takes a number above every one ever issued.
 */
export function assignItemIds(
    registry: Judgments | null,
    departures: readonly DepartureDraft[],
    findings: readonly FindingDraft[] = [],
    rejudge?: ReadonlySet<string>,
): Judgments {
    const judged = <T extends { id: string }>(xs: readonly T[]): T[] => (rejudge === undefined ? [...xs] : xs.filter((x) => rejudge.has(x.id)));
    const carried = <T extends { id: string }>(xs: readonly T[]): T[] => (rejudge === undefined ? [] : xs.filter((x) => !rejudge.has(x.id)));
    const items = numberAgainst(
        judged(registry?.items ?? []),
        carried(registry?.items ?? []),
        departures,
        "DV",
        (d) => d.departsFrom,
        (draft, id, match): Departure => ({
            id,
            kind: "departure",
            found: true,
            severity: draft.breaksGuarantee ? "critical" : "high",
            departsFrom: draft.departsFrom,
            summary: draft.summary,
            files: draft.files,
            stub: draft.stub,
            supersedes: draft.supersedes,
            answer: match?.answer ?? null,
        }),
    );
    const judgedFindings = numberAgainst(
        judged(registry?.findings ?? []),
        carried(registry?.findings ?? []),
        findings,
        "F",
        (f) => f.about,
        (draft, id, match): Finding => ({
            id,
            kind: "finding",
            found: true,
            severity: draft.severity,
            about: draft.about,
            summary: draft.summary,
            files: draft.files,
            // A waiver holds only while the finding can be waived (G13).
            answer: draft.severity === "critical" || draft.severity === "high" ? (match?.answer ?? null) : null,
        }),
    );
    return { items, findings: judgedFindings, other: registry?.other ?? [] };
}

/**
 * Give each draft the ID of the earlier item it is the same as, or the next unused number under
 * `prefix`, above every number `prior` and `carried` hold. Every earlier item not found again stays
 * listed with `found: false`; every `carried` item stays exactly as it was.
 */
function numberAgainst<T extends { id: string; files: string[]; found: boolean }, D extends { files: string[] }>(
    prior: readonly T[],
    carried: readonly T[],
    drafts: readonly D[],
    prefix: string,
    anchorOf: (x: T | D) => string,
    make: (draft: D, id: string, match: T | null) => T,
): T[] {
    let next = 1 + Math.max(0, ...[...prior, ...carried].map((d) => splitItemId(d.id)?.n ?? 0));
    const claimed = new Set<string>();
    const found: T[] = [];
    for (const draft of drafts) {
        const match = bestMatch(prior, claimed, anchorOf(draft), draft.files, anchorOf);
        const id = match?.id ?? `${prefix}${next++}`;
        claimed.add(id);
        found.push(make(draft, id, match));
    }
    const gone = prior.filter((d) => !claimed.has(d.id)).map((d) => ({ ...d, found: false }));
    return [...found, ...gone, ...carried].sort((a, b) => (splitItemId(a.id)?.n ?? 0) - (splitItemId(b.id)?.n ?? 0));
}

/**
 * The earlier item a draft is the same as: same anchor (the cited element, or what a finding
 * judges), and a shared file or no file on either side. An identical file set beats a larger
 * overlap, which beats a smaller one; a tie goes to the lower number, so the choice never depends on
 * the order the registry was written in.
 */
function bestMatch<T extends { id: string; files: string[] }>(
    prior: readonly T[],
    claimed: ReadonlySet<string>,
    draftAnchor: string,
    draftFiles: readonly string[],
    anchorOf: (x: T) => string,
): T | null {
    const anchor = normalizeAnchor(draftAnchor);
    const files = new Set(draftFiles.map(normalizePath));
    let best: { d: T; score: number } | null = null;
    for (const d of prior) {
        if (claimed.has(d.id) || normalizeAnchor(anchorOf(d)) !== anchor) continue;
        const theirs = new Set(d.files.map(normalizePath));
        const shared = [...files].filter((f) => theirs.has(f)).length;
        const same = shared === files.size && shared === theirs.size;
        if (shared === 0 && !same) continue;
        const score = same ? Number.MAX_SAFE_INTEGER : shared;
        const better =
            best === null || score > best.score || (score === best.score && (splitItemId(d.id)?.n ?? 0) < (splitItemId(best.d.id)?.n ?? 0));
        if (better) best = { d, score };
    }
    return best?.d ?? null;
}

/** The verb that answers each kind of item (D3). */
const VERB_FOR: Readonly<Record<string, AnswerVerb>> = { departure: "accepted", finding: "waived", "deferred-scope": "approved" };

/** Why an answer line on the pull request applied nothing. The verdict names each one (G10, G11, G13). */
export type UnappliedWhy = "untrusted" | "unknown-id" | "wrong-verb" | "no-reason" | "not-waivable";

export interface UnappliedAnswer {
    id: string;
    verb: AnswerVerb;
    author: string;
    url: string;
    why: UnappliedWhy;
}

export interface AppliedAnswer {
    id: string;
    verb: AnswerVerb;
    author: string;
    url: string;
    reason: string;
}

export interface AnsweredJudgments {
    judgments: Judgments;
    /** The answer each answered item now carries from a comment, one per ID: the newest trusted one. */
    applied: AppliedAnswer[];
    /** Every answer line that applied nothing, with why. */
    unapplied: UnappliedAnswer[];
}

/**
 * Apply the answers read from the pull request's comments to `judgments` (D3; G9–G11, G13). An
 * answer applies only when its author is trusted, its ID names an item, its verb fits the item's
 * kind, it gives a reason where one is required, and — for a waiver — the finding is critical or
 * high. Of the answers that apply to one ID, the newest wins. Every other answer is named, never
 * dropped, even when a trusted answer applies to the same ID. An item no comment answers keeps the
 * answer the registry carried.
 */
export function applyAnswers(judgments: Judgments, answers: readonly PrAnswer[]): AnsweredJudgments {
    const kinds = new Map<string, { kind: string; severity?: unknown }>();
    for (const d of judgments.items) kinds.set(d.id, d);
    for (const f of judgments.findings) kinds.set(f.id, f);
    for (const o of judgments.other) kinds.set(o.id, o);

    const newest = new Map<string, PrAnswer>();
    const unapplied: UnappliedAnswer[] = [];
    for (const a of answers) {
        const item = kinds.get(a.id);
        const why: UnappliedWhy | null = !a.trusted
            ? "untrusted"
            : item === undefined
              ? "unknown-id"
              : VERB_FOR[item.kind] !== a.verb
                ? "wrong-verb"
                : a.verb !== "approved" && a.reason.length === 0
                  ? "no-reason"
                  : item.kind === "finding" && item.severity !== "critical" && item.severity !== "high"
                    ? "not-waivable"
                    : null;
        if (why !== null) {
            unapplied.push({ id: a.id, verb: a.verb, author: a.author, url: a.url, why });
            continue;
        }
        const held = newest.get(a.id);
        // A later line in the same comment, or a later comment, wins.
        if (held === undefined || a.at.localeCompare(held.at) >= 0) newest.set(a.id, a);
    }

    const answerFor = (id: string, kept: ItemAnswer | null): ItemAnswer | null => {
        const a = newest.get(id);
        return a === undefined ? kept : { verb: a.verb, author: a.author, link: a.url, reason: a.reason };
    };
    const applied = [...newest.values()].map((a) => ({ id: a.id, verb: a.verb, author: a.author, url: a.url, reason: a.reason }));
    return {
        judgments: {
            ...judgments,
            items: judgments.items.map((d) => ({ ...d, answer: answerFor(d.id, d.answer) })),
            findings: judgments.findings.map((f) => ({ ...f, answer: answerFor(f.id, f.answer) })),
            other: judgments.other.map((o) => (newest.has(o.id) ? { ...o, answer: answerFor(o.id, null) } : o)),
        },
        applied,
        unapplied,
    };
}

export interface OpenCounts {
    critical: number;
    high: number;
    medium: number;
    low: number;
}

/**
 * The verdict block's severity counts (D4; G15): only items still open — found again and
 * unanswered. An accepted departure or a waived finding counts nothing, so the merge pre-check and
 * close, which block on these counts, stop blocking on it without changing how they read them.
 */
export function openCounts(judgments: Judgments): OpenCounts {
    const counts: OpenCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const item of [...judgments.items, ...judgments.findings]) {
        if (item.found && item.answer === null) counts[item.severity] += 1;
    }
    return counts;
}

const normalizeAnchor = (s: string): string => s.trim().replace(/\s+/g, " ").toLowerCase();
const normalizePath = (s: string): string => s.trim().replace(/^\.\//, "");

export type ReadItemRegistryResult =
    | { ok: true; source: "none" | "no-judgments" | "verdict"; registry: Judgments | null }
    | { ok: false; error: EpicVerdictsDiagnostic };

/**
 * The registry pull request `pr` in `repo` carries: the judgments of its newest trusted verdict,
 * picked by the same reader the close gate and the merge pre-check use. No verdict, or one
 * published before the judgments block existed, is an empty registry. A newest verdict whose
 * judgments cannot be read stops the run: numbering past it could reuse an ID it issued.
 */
export function readItemRegistry(run: Runner, cwd: string, pr: number, repo: string, issuesRepo: string): ReadItemRegistryResult {
    const r = verifyReceipt(run, cwd, pr, repo, issuesRepo);
    if (!r.ok) return { ok: false, error: { problem: "gh-failed", message: r.error.message } };
    if (!r.value.found) return { ok: true, source: "none", registry: null };
    const parsed = parseJudgmentsBlock(r.value.rawBody);
    if (!parsed.ok) {
        return {
            ok: false,
            error: {
                problem: "judgments-malformed",
                message: `the newest verdict on PR #${pr} in ${repo} carries a judgments block that cannot be read (${parsed.message}), so its IDs cannot be reused. Re-run the full analyze after correcting or removing that verdict.`,
            },
        };
    }
    return parsed.judgments === null ? { ok: true, source: "no-judgments", registry: null } : { ok: true, source: "verdict", registry: parsed.judgments };
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === "object" && !Array.isArray(v);
}

function nonEmpty(v: unknown): v is string {
    return typeof v === "string" && v.trim().length > 0;
}
