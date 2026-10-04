/**
 * The judgments block: a verdict's second machine block, after the verdict block, under its own
 * marker (epic #829, decision record #871, D2; D5 sets its marker and its place).
 *
 * The verdict block stays a flat key-and-value block, because every deployed reader parses it that
 * way and a repeated key overwrites an earlier one. What a person can answer — a departure from the
 * decision record (ID prefix DV), a finding (F), and later a deferred-scope proposal (DS) — goes
 * here instead, as JSON in a fence longer than any run of backticks in its content, so text it
 * carries cannot end it early. Story #858 writes departures and story #860 findings; an item of
 * another kind is kept as it was read, so a run never drops what a later release wrote.
 *
 * The block is also the ID registry: the next run on the same pull request reads it back from the
 * newest trusted verdict and reuses each ID (D2). That is why a block that cannot serve as one —
 * unparseable, or one ID naming two items — is refused rather than read in part.
 *
 * Story #861 adds what an answer-recording run needs to judge only what a change affects (D8):
 * every criterion, guarantee and success-metric result with the files it was judged on, the
 * epic-level state the run judged under, and whether the file lists were dropped to fit the
 * platform's size limit. A block written before that records no results, which reads as "cannot
 * say what a change affects", never as "no results".
 */

/** The marker the judgments block is published under. It never contains the verdict block's marker. */
export const JUDGMENTS_MARKER = "<!-- nexus:analyze-judgments -->";

const SCHEMA = 1;

/** The ID prefix each kind of item is numbered under, per pull request. */
const PREFIX: Readonly<Record<string, string>> = { departure: "DV", finding: "F", "deferred-scope": "DS" };

/**
 * An answer recorded against an item: who gave it, where, and why. Applied from the answer reader's
 * lines (#860); `reason` is "" only for an approval, which needs none.
 */
export interface ItemAnswer {
    verb: string;
    author: string;
    link: string;
    reason: string;
}

/** A place where the code differs from the approved decision record, or from the epic when it has none. */
export interface Departure {
    /** `DV<n>`, numbered per pull request and never reused. */
    id: string;
    kind: "departure";
    /** False when a later run did not find it again; it is then listed as no longer found, never dropped. */
    found: boolean;
    /** Unanswered, a departure that breaks a guarantee or an invariant is critical, and any other is high. */
    severity: "critical" | "high";
    /** What it departs from: a decision or guarantee ID, an old-format decision's title, or a named section. */
    departsFrom: string;
    /** What the code does that the baseline does not say. */
    summary: string;
    /** The files it was judged on. */
    files: string[];
    /** A decision stub whose reason explains it. A stub explains; it never answers. */
    stub: { path: string; reason: string } | null;
    /** Set only when the code does the opposite of what a record decision chose. */
    supersedes: { decision: string; instead: string } | null;
    answer: ItemAnswer | null;
}

/** Something analyze found wrong that is not a departure: an unmet criterion, a metric not moved. */
export interface Finding {
    /** `F<n>`, numbered per pull request and never reused. */
    id: string;
    kind: "finding";
    /** False when a later run did not find it again; it is then listed as no longer found, never dropped. */
    found: boolean;
    severity: "critical" | "high" | "medium" | "low";
    /** What it judges: an acceptance criterion, a success metric, or a named check. */
    about: string;
    /** What is wrong. */
    summary: string;
    /** The files it was judged on. */
    files: string[];
    /** Only a critical or high finding can carry a waiver (G13). */
    answer: ItemAnswer | null;
}

/** An item of a kind this release does not judge, kept exactly as it was read. */
export type OtherItem = { id: string; kind: string } & Record<string, unknown>;

/** What a result judges: an acceptance criterion, a guarantee or invariant, or a success metric. */
export type ResultKind = "criterion" | "guarantee" | "metric";

/** The verdicts each kind of result takes. A broken guarantee is also a departure (D1). */
const RESULT_VERDICTS: Readonly<Record<ResultKind, readonly string[]>> = {
    criterion: ["met", "partial", "unmet", "contradicted", "unverifiable"],
    guarantee: ["held", "broken"],
    metric: ["met", "not-moved", "unverifiable"],
};

/**
 * One criterion, guarantee or metric result, with the files it was judged on (D8). An empty file
 * list counts as affected by any change (R5).
 */
export interface Result {
    kind: ResultKind;
    /** What it judges: `#<story> AC<k>`, `G<n>` (an invariant by its text), or the metric. */
    about: string;
    verdict: string;
    files: string[];
}

/** Phase 0.7's answer for the pull request: judge the epic level, report it not run, or skip it. */
export type EpicLevel = "judge" | "not-run" | "skip";

export interface Judgments {
    /** The departures. */
    items: Departure[];
    findings: Finding[];
    other: OtherItem[];
    /** Every result the verdict judged; absent in a block written before results were recorded. */
    results?: Result[];
    /** The epic-level state the results were judged under; absent when not recorded. */
    epicLevel?: EpicLevel;
    /** True when the file lists were dropped to fit the platform's size limit (D5). */
    filesDropped?: boolean;
}

export type ParsedJudgments = { ok: true; judgments: Judgments | null } | { ok: false; message: string };

/** The ID's prefix and number, or null when it is not `<prefix><n>` with n from 1. */
export function splitItemId(id: string): { prefix: string; n: number } | null {
    const m = /^(DV|DS|F)([1-9]\d*)$/.exec(id);
    return m === null ? null : { prefix: m[1], n: Number(m[2]) };
}

/** The published form of `judgments`: the marker, then the JSON in a fence nothing inside can close. */
export function renderJudgmentsBlock(judgments: {
    items: readonly Departure[];
    findings?: readonly Finding[];
    other?: readonly OtherItem[];
    results?: readonly Result[];
    epicLevel?: EpicLevel;
    filesDropped?: boolean;
}): string {
    const doc: Record<string, unknown> = { schema: SCHEMA, items: [...judgments.items, ...(judgments.findings ?? []), ...(judgments.other ?? [])] };
    if (judgments.results !== undefined) doc["results"] = judgments.results;
    if (judgments.epicLevel !== undefined) doc["epicLevel"] = judgments.epicLevel;
    if (judgments.filesDropped === true) doc["filesDropped"] = true;
    const json = JSON.stringify(doc, null, 2);
    const longest = Math.max(0, ...[...json.matchAll(/`+/g)].map((m) => m[0].length));
    const fence = "`".repeat(Math.max(3, longest + 1));
    return `${JUDGMENTS_MARKER}\n${fence}json\n${json}\n${fence}\n`;
}

/**
 * The judgments `body` carries. A body with no judgments marker — every verdict published before
 * this block existed — has none, which is not an error.
 */
export function parseJudgmentsBlock(body: string): ParsedJudgments {
    const at = body.indexOf(JUDGMENTS_MARKER);
    if (at < 0) return { ok: true, judgments: null };
    const rest = body.slice(at + JUDGMENTS_MARKER.length);
    const open = /^\s*?\n(`{3,})json[ \t]*\n/.exec(rest);
    if (open === null) return fail("no fenced json block follows the judgments marker");
    const fence = open[1];
    const content = rest.slice(open[0].length);
    const close = new RegExp(`(?:^|\\n)${fence}[ \\t]*(?:\\n|$)`).exec(content);
    if (close === null) return fail("the judgments block's fence is never closed");

    let doc: unknown;
    try {
        doc = JSON.parse(content.slice(0, close.index));
    } catch (e) {
        return fail(`the judgments block is not valid JSON (${e instanceof Error ? e.message : String(e)})`);
    }
    if (!isRecord(doc) || !Array.isArray(doc["items"])) return fail("the judgments block carries no items list");

    const items: Departure[] = [];
    const findings: Finding[] = [];
    const other: OtherItem[] = [];
    const seen = new Set<string>();
    for (const [i, raw] of doc["items"].entries()) {
        if (!isRecord(raw) || typeof raw["id"] !== "string" || typeof raw["kind"] !== "string") {
            return fail(`item ${i} has no id or kind`);
        }
        const id = raw["id"];
        const split = splitItemId(id);
        if (split === null || PREFIX[raw["kind"]] !== split.prefix) {
            return fail(`item ${i} has ID ${id}, which is not numbered under its kind's prefix (${raw["kind"]})`);
        }
        if (seen.has(id)) return fail(`ID ${id} names more than one item`);
        seen.add(id);
        if (raw["kind"] === "finding") {
            const f = readFinding(raw);
            if (typeof f === "string") return fail(`finding ${id} ${f}`);
            findings.push(f);
            continue;
        }
        if (raw["kind"] !== "departure") {
            other.push(raw as OtherItem);
            continue;
        }
        const d = readDeparture(raw);
        if (typeof d === "string") return fail(`departure ${id} ${d}`);
        items.push(d);
    }
    const judgments: Judgments = { items, findings, other };
    if (doc["results"] !== undefined) {
        const results = readResults(doc["results"]);
        if (typeof results === "string") return fail(results);
        judgments.results = results;
    }
    if (doc["epicLevel"] !== undefined) {
        const level = doc["epicLevel"];
        if (level !== "judge" && level !== "not-run" && level !== "skip") return fail("the judgments block's epicLevel is not judge, not-run or skip");
        judgments.epicLevel = level;
    }
    if (doc["filesDropped"] !== undefined) {
        if (typeof doc["filesDropped"] !== "boolean") return fail("the judgments block's filesDropped is not true or false");
        judgments.filesDropped = doc["filesDropped"];
    }
    return { ok: true, judgments };
}

/** The key two results are the same under: their kind and what they judge. */
export function resultKey(r: { kind: string; about: string }): string {
    return `${r.kind}:${r.about.trim().replace(/\s+/g, " ").toLowerCase()}`;
}

/** Read one result as a draft or a block writes it; a string names what is wrong with it. */
export function readResult(raw: unknown): Result | string {
    if (!isRecord(raw)) return "is not an object";
    const { kind, about, verdict, files } = raw;
    if (kind !== "criterion" && kind !== "guarantee" && kind !== "metric") return "has no kind of criterion, guarantee or metric (kind)";
    if (!nonEmpty(about)) return "names nothing it judges (about)";
    if (typeof verdict !== "string" || !RESULT_VERDICTS[kind].includes(verdict)) {
        return `has no ${kind} verdict of ${RESULT_VERDICTS[kind].join(", ")} (verdict)`;
    }
    if (!Array.isArray(files) || !files.every((f) => typeof f === "string")) return "has no file list (files)";
    return { kind, about, verdict, files: files as string[] };
}

/** Read a results list, refusing an unreadable entry or two results judging the same thing. */
export function readResults(raw: unknown): Result[] | string {
    if (!Array.isArray(raw)) return "the results are not a list";
    const results: Result[] = [];
    const seen = new Set<string>();
    for (const [i, entry] of raw.entries()) {
        const r = readResult(entry);
        if (typeof r === "string") return `result ${i} ${r}`;
        if (seen.has(resultKey(r))) return `result ${i} judges ${r.kind} ${r.about}, which an earlier result already judges`;
        seen.add(resultKey(r));
        results.push(r);
    }
    return results;
}

const SEVERITIES: readonly string[] = ["critical", "high", "medium", "low"];

function readFinding(raw: Record<string, unknown>): Finding | string {
    const { found, severity, about, summary, files } = raw;
    const answer = raw["answer"] ?? null;
    if (typeof found !== "boolean") return "has no found flag";
    if (typeof severity !== "string" || !SEVERITIES.includes(severity)) return "has no severity of critical, high, medium or low";
    if (!nonEmpty(about)) return "names nothing it judges";
    if (!nonEmpty(summary)) return "says nothing about what is wrong";
    if (!Array.isArray(files) || !files.every((f) => typeof f === "string")) return "has no file list";
    if (answer !== null && !isAnswer(answer)) return "carries an unreadable answer";
    if (answer !== null && severity !== "critical" && severity !== "high") return "is waived, but only a critical or high finding can be";
    return {
        id: raw["id"] as string,
        kind: "finding",
        found,
        severity: severity as Finding["severity"],
        about,
        summary,
        files: files as string[],
        answer: answer === null ? null : (answer as unknown as ItemAnswer),
    };
}

function isAnswer(v: unknown): boolean {
    return isRecord(v) && ["verb", "author", "link", "reason"].every((k) => typeof v[k] === "string");
}

function readDeparture(raw: Record<string, unknown>): Departure | string {
    const { found, severity, departsFrom, summary, files } = raw;
    // An absent optional part reads as none, the same as an explicit null.
    const stub = raw["stub"] ?? null;
    const supersedes = raw["supersedes"] ?? null;
    const answer = raw["answer"] ?? null;
    if (typeof found !== "boolean") return "has no found flag";
    if (severity !== "critical" && severity !== "high") return "has a severity other than critical or high";
    if (!nonEmpty(departsFrom)) return "names nothing it departs from";
    if (!nonEmpty(summary)) return "says nothing about what the code does";
    if (!Array.isArray(files) || !files.every((f) => typeof f === "string")) return "has no file list";
    if (stub !== null && !(isRecord(stub) && typeof stub["path"] === "string" && nonEmpty(stub["reason"]))) {
        return "carries a stub with no reason";
    }
    if (supersedes !== null && !(isRecord(supersedes) && nonEmpty(supersedes["decision"]) && nonEmpty(supersedes["instead"]))) {
        return "is marked superseding without naming the decision and what the code does instead";
    }
    if (answer !== null && !isAnswer(answer)) return "carries an unreadable answer";
    return {
        id: raw["id"] as string,
        kind: "departure",
        found,
        severity,
        departsFrom,
        summary,
        files: files as string[],
        stub: stub === null ? null : { path: (stub as Record<string, string>)["path"], reason: (stub as Record<string, string>)["reason"] },
        supersedes:
            supersedes === null
                ? null
                : { decision: (supersedes as Record<string, string>)["decision"], instead: (supersedes as Record<string, string>)["instead"] },
        answer: answer === null ? null : (answer as unknown as ItemAnswer),
    };
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === "object" && !Array.isArray(v);
}

function nonEmpty(v: unknown): v is string {
    return typeof v === "string" && v.trim().length > 0;
}

function fail(message: string): ParsedJudgments {
    return { ok: false, message };
}
