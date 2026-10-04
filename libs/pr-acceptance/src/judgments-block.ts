/**
 * The judgments block: a verdict's second machine block, after the verdict block, under its own
 * marker (epic #829, decision record #871, D2; D5 sets its marker and its place).
 *
 * The verdict block stays a flat key-and-value block, because every deployed reader parses it that
 * way and a repeated key overwrites an earlier one. What a person can answer — a departure from the
 * decision record (ID prefix DV), a finding (F), and a deferred-scope proposal (DS) — goes here
 * instead, as JSON in a fence longer than any run of backticks in its content, so text it carries
 * cannot end it early. Story #858 writes departures, story #860 findings and story #862 deferred
 * scope; an item of an unknown kind is refused, since its ID is numbered under no known prefix.
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
 *
 * Story #862 finishes D5 on this block, so it carries what close writes into its record (D6, D7):
 * the key decisions — each record decision by its ID (by title in an old-format record) tied to
 * the record digest the verdict stamps, a record in neither format in full, and every confirmed
 * decision stub with its choice, reason and refuted alternative — and the deferred-scope
 * proposals (DS), each belonging to the finding or departure it would settle. {@link
 * parseJudgmentsBlock} is the one parser: the publish check runs it on the exact bytes to be
 * published, and close reads the block through it (#830).
 *
 * Text an answer carries is copied in verbatim, so it is rendered so that it cannot change how
 * either block parses (G28): the fence is longer than any run of backticks in the content, and
 * every `<` is written as its JSON escape, so no marker and no HTML comment appears inside the
 * block. JSON.parse reads both back unchanged.
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

/**
 * Scope the pull request leaves out, proposed for deferral (D7). It belongs to the item it would
 * settle: an unmet or partial criterion's finding, or a departure for record scope the delivered
 * stories leave out. A trusted approval marks it for filing by close (#830), names the approver,
 * and stops that item blocking.
 */
export interface DeferredScope {
    /** `DS<n>`, numbered per pull request and never reused. */
    id: string;
    kind: "deferred-scope";
    /** False when a later run did not propose it again; it is then listed as no longer found, never dropped. */
    found: boolean;
    /** The `F<n>` or `DV<n>` ID of the item it would settle. */
    settles: string;
    /** The scope left out, as close would file it. */
    summary: string;
    /** Only an approval answers a proposal; its reason may be "". */
    answer: ItemAnswer | null;
}

/** A record decision named the way close resolves its text: by ID, or by title in an old-format record. */
export type RecordDecisionRef = { id: string } | { title: string };

/**
 * The record's decisions, tied to the digest the verdict block stamps as `record_hash` (D5). Close
 * resolves their text from the record body that digest pins. A record in neither format has no
 * decisions to name, so its body is carried in full instead.
 */
export interface RecordKeyDecisions {
    digest: string;
    format: "new" | "old" | "neither";
    decisions: RecordDecisionRef[];
    /** The whole record body; set only for a record in neither format. */
    text?: string;
}

/** A decision stub whose choice the diff implements (D6). A stub the code contradicts is not one. */
export interface ConfirmedStub {
    path: string;
    choice: string;
    reason: string;
    /** The viable option not taken, or "none". */
    refuted: string;
}

/** What close writes into its record as the key decisions (D6): the record's, plus confirmed stubs. */
export interface KeyDecisions {
    /** Null when the epic has no record (degraded mode). */
    record: RecordKeyDecisions | null;
    stubs: ConfirmedStub[];
}

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
    /** The deferred-scope proposals (D7). */
    deferred: DeferredScope[];
    /** Every result the verdict judged; absent in a block written before results were recorded. */
    results?: Result[];
    /** The epic-level state the results were judged under; absent when not recorded. */
    epicLevel?: EpicLevel;
    /** True when the file lists were dropped to fit the platform's size limit (D5). */
    filesDropped?: boolean;
    /** The key decisions (D5, D6); absent in a block written before they were carried. */
    keyDecisions?: KeyDecisions;
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
    deferred?: readonly DeferredScope[];
    results?: readonly Result[];
    epicLevel?: EpicLevel;
    filesDropped?: boolean;
    keyDecisions?: KeyDecisions;
}): string {
    const doc: Record<string, unknown> = { schema: SCHEMA, items: [...judgments.items, ...(judgments.findings ?? []), ...(judgments.deferred ?? [])] };
    if (judgments.keyDecisions !== undefined) doc["keyDecisions"] = judgments.keyDecisions;
    if (judgments.results !== undefined) doc["results"] = judgments.results;
    if (judgments.epicLevel !== undefined) doc["epicLevel"] = judgments.epicLevel;
    if (judgments.filesDropped === true) doc["filesDropped"] = true;
    // `<` occurs only inside JSON strings, so escaping it changes no value; it keeps every marker
    // and HTML comment a copied answer carries out of the published bytes (G28).
    const json = JSON.stringify(doc, null, 2).replace(/</g, "\\u003c");
    const longest = Math.max(0, ...[...json.matchAll(/`+/g)].map((m) => m[0].length));
    const fence = "`".repeat(Math.max(3, longest + 1));
    return `${JUDGMENTS_MARKER}\n${fence}json\n${json}\n${fence}\n`;
}

/**
 * The judgments `body` carries. A body with no judgments marker — every verdict published before
 * this block existed — has none, which is not an error.
 */
export function parseJudgmentsBlock(body: string): ParsedJudgments {
    const located = locateJudgmentsBlock(body);
    if (located === null) return { ok: true, judgments: null };
    if (typeof located === "string") return fail(located);

    let doc: unknown;
    try {
        doc = JSON.parse(located.json);
    } catch (e) {
        return fail(`the judgments block is not valid JSON (${e instanceof Error ? e.message : String(e)})`);
    }
    if (!isRecord(doc) || !Array.isArray(doc["items"])) return fail("the judgments block carries no items list");

    const items: Departure[] = [];
    const findings: Finding[] = [];
    const deferred: DeferredScope[] = [];
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
        if (raw["kind"] === "deferred-scope") {
            const ds = readDeferred(raw);
            if (typeof ds === "string") return fail(`deferred-scope proposal ${id} ${ds}`);
            deferred.push(ds);
            continue;
        }
        const d = readDeparture(raw);
        if (typeof d === "string") return fail(`departure ${id} ${d}`);
        items.push(d);
    }
    const settled = new Set<string>();
    for (const ds of deferred) {
        const parent = seen.has(ds.settles) ? (splitItemId(ds.settles)?.prefix ?? "") : "";
        if (parent !== "DV" && parent !== "F") return fail(`deferred-scope proposal ${ds.id} settles ${ds.settles}, which is no departure or finding in this block`);
        if (ds.found && settled.has(ds.settles)) return fail(`two deferred-scope proposals settle ${ds.settles}`);
        if (ds.found) settled.add(ds.settles);
    }
    const judgments: Judgments = { items, findings, deferred };
    if (doc["keyDecisions"] !== undefined) {
        const key = readKeyDecisions(doc["keyDecisions"]);
        if (typeof key === "string") return fail(`the judgments block's key decisions ${key}`);
        judgments.keyDecisions = key;
    }
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

/**
 * Where the judgments block sits in `body`: from its marker to the end of its closing fence, and
 * the JSON between the fences. Null when the body has no marker; a string names what is wrong.
 */
function locateJudgmentsBlock(body: string): { start: number; end: number; json: string } | null | string {
    const at = body.indexOf(JUDGMENTS_MARKER);
    if (at < 0) return null;
    const restAt = at + JUDGMENTS_MARKER.length;
    const rest = body.slice(restAt);
    const open = /^\s*?\n(`{3,})json[ \t]*\n/.exec(rest);
    if (open === null) return "no fenced json block follows the judgments marker";
    const fence = open[1];
    const content = rest.slice(open[0].length);
    const close = new RegExp(`(?:^|\\n)${fence}[ \\t]*(?:\\n|$)`).exec(content);
    if (close === null) return "the judgments block's fence is never closed";
    return { start: at, end: restAt + open[0].length + close.index + close[0].length, json: content.slice(0, close.index) };
}

/**
 * `body` with its judgments block replaced by `judgments`, rendered. Null when the body carries
 * no readable block to replace.
 */
export function replaceJudgmentsBlock(body: string, judgments: Judgments): string | null {
    const located = locateJudgmentsBlock(body);
    if (located === null || typeof located === "string") return null;
    return `${body.slice(0, located.start)}${renderJudgmentsBlock(judgments)}${body.slice(located.end)}`;
}

/**
 * `judgments` with only the results' file lists emptied and `filesDropped` set (D5): what a verdict
 * too large for the platform drops, and the only thing it drops. The departures and findings keep their lists, because
 * the next full run matches an item found again by a shared file (D2); without them every item
 * would come back under a new ID and its answer would have to be given again. The next
 * answer-recording run on a moved head reads the flag and judges the whole pull request again (#861).
 */
export function withoutResultFileLists(judgments: Judgments): Judgments {
    const dropped: Judgments = { ...judgments, filesDropped: true };
    if (judgments.results !== undefined) dropped.results = judgments.results.map((r) => ({ ...r, files: [] }));
    return dropped;
}

/** The found proposal settling `id` that a trusted person approved, if any (D7). */
function approvedDeferral(judgments: Pick<Judgments, "deferred">, id: string): DeferredScope | undefined {
    return judgments.deferred.find((ds) => ds.found && ds.settles === id && ds.answer?.verb === "approved");
}

/**
 * Whether a departure or finding still blocks: found, unanswered, and with no approved deferral
 * settling it (D4, D7). The verdict block's severity counts count exactly these items, so the
 * merge pre-check and close stop blocking on an item once it is answered or its scope deferred.
 */
export function isOpen(judgments: Pick<Judgments, "deferred">, item: Departure | Finding): boolean {
    return item.found && item.answer === null && approvedDeferral(judgments, item.id) === undefined;
}

/** Every departure and finding still open, in ID order within each kind. */
export function openItems(judgments: Judgments): Array<Departure | Finding> {
    return [...judgments.items, ...judgments.findings].filter((x) => isOpen(judgments, x));
}

/**
 * What becomes of each deferred-scope proposal (D7; G26), as the verdict reports it and close
 * (#830) files it:
 *
 * - `to-file` — a trusted person approved it; close files it and names the approver.
 * - `not-filed` — its item was accepted or waived without approving it, so nothing is filed.
 * - `proposed` — no answer yet; its item still blocks.
 * - `no-longer-found` — a later run did not propose it again; listed with its answer, never dropped.
 */
export type DeferredScopeState = "to-file" | "not-filed" | "proposed" | "no-longer-found";

export interface DeferredScopeStatus {
    id: string;
    settles: string;
    state: DeferredScopeState;
    summary: string;
    /** The approver and the link to the approving comment, when approved. */
    approvedBy: { author: string; link: string } | null;
    /** The answer its item carries when that item was answered without approving the proposal. */
    settledBy: { verb: string; author: string; link: string } | null;
}

export function deferredScopeStatus(judgments: Judgments): DeferredScopeStatus[] {
    const parents = new Map<string, Departure | Finding>([...judgments.items, ...judgments.findings].map((x) => [x.id, x]));
    return judgments.deferred.map((ds) => {
        const parentAnswer = parents.get(ds.settles)?.answer ?? null;
        const approved = ds.answer?.verb === "approved" ? ds.answer : null;
        const state: DeferredScopeState = !ds.found ? "no-longer-found" : approved !== null ? "to-file" : parentAnswer !== null ? "not-filed" : "proposed";
        return {
            id: ds.id,
            settles: ds.settles,
            state,
            summary: ds.summary,
            approvedBy: approved === null ? null : { author: approved.author, link: approved.link },
            settledBy: state === "not-filed" && parentAnswer !== null ? { verb: parentAnswer.verb, author: parentAnswer.author, link: parentAnswer.link } : null,
        };
    });
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

function readDeferred(raw: Record<string, unknown>): DeferredScope | string {
    const { found, settles, summary } = raw;
    const answer = raw["answer"] ?? null;
    if (typeof found !== "boolean") return "has no found flag";
    if (typeof settles !== "string" || splitItemId(settles) === null) return "names no finding or departure it would settle (settles)";
    if (!nonEmpty(summary)) return "says nothing about the scope it defers";
    if (answer !== null && !(isAnswer(answer) && (answer as Record<string, string>)["verb"] === "approved")) return "carries an answer other than an approval";
    return { id: raw["id"] as string, kind: "deferred-scope", found, settles, summary, answer: answer === null ? null : (answer as unknown as ItemAnswer) };
}

function readKeyDecisions(raw: unknown): KeyDecisions | string {
    if (!isRecord(raw)) return "are not an object";
    const { record, stubs } = raw;
    if (!Array.isArray(stubs)) return "carry no list of confirmed stubs";
    const read: ConfirmedStub[] = [];
    for (const [i, s] of stubs.entries()) {
        if (!isRecord(s) || !["path", "choice", "reason", "refuted"].every((k) => nonEmpty(s[k]))) {
            return `name stub ${i} without its path, choice, reason and refuted alternative`;
        }
        read.push({ path: s["path"] as string, choice: s["choice"] as string, reason: s["reason"] as string, refuted: s["refuted"] as string });
    }
    if (record === null || record === undefined) return { record: null, stubs: read };
    if (!isRecord(record) || !nonEmpty(record["digest"])) return "name no record digest";
    const format = record["format"];
    if (format !== "new" && format !== "old" && format !== "neither") return "name no record format of new, old or neither";
    if (!Array.isArray(record["decisions"])) return "carry no list of record decisions";
    const decisions: RecordDecisionRef[] = [];
    for (const [i, d] of record["decisions"].entries()) {
        if (isRecord(d) && nonEmpty(d["id"])) decisions.push({ id: d["id"] });
        else if (isRecord(d) && nonEmpty(d["title"])) decisions.push({ title: d["title"] });
        else return `name record decision ${i} by neither ID nor title`;
    }
    const out: RecordKeyDecisions = { digest: record["digest"], format, decisions };
    if (format === "neither") {
        if (!nonEmpty(record["text"])) return "carry a record in neither format without its text";
        out.text = record["text"];
    }
    return { record: out, stubs: read };
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
