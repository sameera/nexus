/**
 * The renderer of the published analyze verdict (epic #923, decision record #949, D1, D2, D5, D6;
 * G1–G4, G23).
 *
 * The model judges every departure, finding and criterion. It writes none of the verdict: the ID
 * step hands this renderer the judgments it numbered and answered, plus the run facts, and the
 * renderer writes every byte — the visible text, the receipt block and the judgments block. So the
 * counts the reader sees, the counts the receipt states and the open items the judgments block
 * holds come from one computation and cannot disagree.
 *
 * The renderer reads only its input: no clock, no environment, no network. Sections, items and
 * fields come in one fixed order, and items sort by kind and then by ID number, so the same input
 * gives the same bytes (D5). Text from the draft or from an answer is written as inline text, so it
 * cannot close a section, add a heading or repeat a verdict marker (D6).
 */

import {
    type Departure,
    type EpicLevel,
    type Finding,
    type Judgments,
    type Result,
    deferredScopeStatus,
    isOpen,
    renderJudgmentsBlock,
    splitItemId,
} from "@nexus/pr-acceptance/judgments-block";
import { RECEIPT_MARKER } from "@nexus/pr-acceptance/receipt-blocks";
import { type OpenCounts, type UnappliedAnswer, openCounts } from "./verdict-items.js";

/** A story the verdict covers: its number in the issues repository, how the verdict writes it, and its title. */
export interface VerdictStory {
    number: number;
    ref: string;
    title: string;
}

/** What the run knows that is not a judgment. The date is a fact, so the renderer never reads a clock. */
export interface VerdictFacts {
    epic: { ref: string; title: string };
    pr: number;
    /** The code repository the pull request lives in, as `nexus pr-worktree open` printed it. */
    repo: string;
    /** The repository the epic, record and story numbers resolve against. */
    issuesRepo: string;
    stories: VerdictStory[];
    /** The full 40-hex commit analyzed. */
    head: string;
    /** `YYYY-MM-DD`. */
    date: string;
    /** The release that wrote the verdict; null when unresolved. */
    nexusVersion: string | null;
    /** Null in downgraded mode: the epic has no record. */
    record: { ref: string; hash: string } | null;
    /** The completion check's lines (Phase 0.7). */
    epicLevel: { state: EpicLevel; lines: string[] };
    /** The concept pages the epic lists, how many of their invariants were checked, and any listed page not found. */
    concepts: { pages: string[]; checked: number; notFound: string[] };
    /** An answer-recording run's scope lines; empty on a full run. */
    recorded: string[];
}

export interface VerdictInput {
    judgments: Judgments;
    facts: VerdictFacts;
    /** Every answer line that applied nothing, with why. */
    unapplied: readonly UnappliedAnswer[];
}

export interface RenderedVerdict {
    body: string;
    open: OpenCounts;
    /** True exactly when a critical or high item is open. */
    blocked: boolean;
}

export type ParsedFacts = { ok: true; facts: VerdictFacts } | { ok: false; message: string };

/** Read the run facts the stage wrote. Every refusal names the field. */
export function parseVerdictFacts(text: string): ParsedFacts {
    let doc: unknown;
    try {
        doc = JSON.parse(text);
    } catch (e) {
        return { ok: false, message: `the facts are not valid JSON (${e instanceof Error ? e.message : String(e)})` };
    }
    if (!isRecord(doc)) return { ok: false, message: "the facts are not an object" };
    const epic = doc["epic"];
    if (!isRecord(epic) || !nonEmpty(epic["ref"]) || !nonEmpty(epic["title"])) return { ok: false, message: "the facts name no epic ref and title (epic)" };
    const pr = doc["pr"];
    if (typeof pr !== "number" || !Number.isInteger(pr) || pr <= 0) return { ok: false, message: "the facts name no pull request number (pr)" };
    for (const key of ["repo", "issuesRepo", "date"] as const) {
        if (!nonEmpty(doc[key])) return { ok: false, message: `the facts carry no ${key}` };
    }
    if (typeof doc["head"] !== "string" || !/^[0-9a-f]{40}$/i.test(doc["head"])) return { ok: false, message: "the facts carry no full 40-hex head" };
    const stories: VerdictStory[] = [];
    if (!Array.isArray(doc["stories"]) || doc["stories"].length === 0) return { ok: false, message: "the facts list no stories" };
    for (const [i, s] of doc["stories"].entries()) {
        if (!isRecord(s) || typeof s["number"] !== "number" || !nonEmpty(s["ref"]) || !nonEmpty(s["title"])) {
            return { ok: false, message: `story ${i} lacks its number, ref or title (stories)` };
        }
        stories.push({ number: s["number"], ref: s["ref"], title: s["title"] });
    }
    const record = doc["record"] ?? null;
    if (record !== null && !(isRecord(record) && nonEmpty(record["ref"]) && nonEmpty(record["hash"]))) {
        return { ok: false, message: "the facts name a record without its ref and hash (record); write null in downgraded mode" };
    }
    const level = doc["epicLevel"];
    if (!isRecord(level) || (level["state"] !== "judge" && level["state"] !== "not-run" && level["state"] !== "skip") || !stringList(level["lines"])) {
        return { ok: false, message: "the facts carry no epicLevel { state: judge|not-run|skip, lines }" };
    }
    const concepts = doc["concepts"];
    if (!isRecord(concepts) || !stringList(concepts["pages"]) || typeof concepts["checked"] !== "number" || !stringList(concepts["notFound"] ?? [])) {
        return { ok: false, message: "the facts carry no concepts { pages, checked, notFound }" };
    }
    const version = doc["nexusVersion"] ?? null;
    if (version !== null && !nonEmpty(version)) return { ok: false, message: "the facts' nexusVersion is neither a version nor null" };
    return {
        ok: true,
        facts: {
            epic: { ref: epic["ref"] as string, title: epic["title"] as string },
            pr,
            repo: (doc["repo"] as string).trim(),
            issuesRepo: (doc["issuesRepo"] as string).trim(),
            stories: [...stories].sort((a, b) => a.number - b.number),
            head: doc["head"],
            date: doc["date"] as string,
            nexusVersion: version,
            record: record === null ? null : { ref: record["ref"] as string, hash: (record["hash"] as string).trim() },
            epicLevel: { state: level["state"], lines: level["lines"] as string[] },
            concepts: { pages: concepts["pages"] as string[], checked: concepts["checked"], notFound: (concepts["notFound"] ?? []) as string[] },
            recorded: stringList(doc["recorded"]) ? doc["recorded"] : [],
        },
    };
}

/** A required field an open item judged in this run lacks (D4). */
export interface MissingField {
    id: string;
    subject: string;
    field: string;
}

/**
 * The open items judged in this run that lack a field the layout needs (D4; G7). An item carried
 * unchanged from an earlier verdict is never refused: it is shown without the fields it never had.
 */
export function missingFields(judgments: Judgments, judged: ReadonlySet<string>): MissingField[] {
    const missing: MissingField[] = [];
    for (const item of [...judgments.items, ...judgments.findings]) {
        if (!judged.has(item.id) || !isOpen(judgments, item)) continue;
        const subject = subjectOf(item);
        if (subject.trim().length === 0) missing.push({ id: item.id, subject, field: item.kind === "departure" ? "departsFrom" : "about" });
        if (item.summary.trim().length === 0) missing.push({ id: item.id, subject, field: "summary" });
        if ((item.fix ?? "").trim().length === 0) missing.push({ id: item.id, subject, field: "fix" });
        if (item.files.length > 0 && item.location === undefined) missing.push({ id: item.id, subject, field: "location" });
    }
    return missing;
}

/** Write `text` as one line of inline text that cannot change the verdict's structure (D6). */
export function inlineText(text: string): string {
    return text
        .replace(/\r\n?|\n/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\|/g, "\\|");
}

/** A link target the verdict writes: spaces, brackets and quotes percent-encoded, so it cannot end the link early. */
export function safeUrl(url: string): string {
    return url.trim().replace(/[\s()<>"'`|\\]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`);
}

/** Render the whole verdict body from one input (D1, D2). */
export function renderVerdict(input: VerdictInput): RenderedVerdict {
    const { judgments, facts } = input;
    const open = openCounts(judgments);
    const blocked = open.critical + open.high > 0;
    const sections: Array<string | null> = [
        headline(facts, open, judgments),
        needsActionSection(input),
        worthALookSection(input),
        alreadyAnsweredSection(input),
        noLongerFoundSection(input),
        storiesSection(facts, judgments.results ?? []),
        evidenceSection(judgments),
        epicLevelSection(facts, judgments.results ?? []),
        runDetailsSection(input, open),
    ];
    // A section with nothing to report is left out (D11; G19).
    const body = `${sections.filter((x): x is string => x !== null).join("\n\n")}\n`;
    return { body, open, blocked };
}

/**
 * The first line (D7; G9): "Blocked" exactly when a critical or high item is open, else "Clear to
 * merge", then the open count per severity — the receipt's counts — then the checks to make by hand,
 * which never block.
 */
function headline(facts: VerdictFacts, open: OpenCounts, judgments: Judgments): string {
    const state = open.critical + open.high > 0 ? "Blocked" : "Clear to merge";
    return [
        `## ${state} · critical ${open.critical} · high ${open.high} · medium ${open.medium} · low ${open.low} · checks by hand ${unconfirmed(judgments.results ?? []).length}`,
        "",
        `Conformance of epic ${inlineText(facts.epic.ref)} ${inlineText(facts.epic.title)}, on pull request #${facts.pr}.`,
    ].join("\n");
}

/** Needs action (D8; G10, G15): the blocking items, then the answers that applied nothing and name no blocking item. */
function needsActionSection(input: VerdictInput): string | null {
    const { judgments } = input;
    const blocking = sortedItems(judgments).filter((x) => isOpen(judgments, x) && (x.severity === "critical" || x.severity === "high"));
    const shown = new Set(blocking.map((x) => x.id));
    const lines: string[] = ["### Needs action", ""];
    for (const item of blocking) lines.push(...openItemLines(item, input, true), "");
    for (const a of input.unapplied.filter((u) => !shown.has(u.id))) lines.push(`- ${unappliedText(a)}`);
    if (lines.length === 2) return null;
    return trimBlank(lines).join("\n");
}

/** Worth a look (D8): open medium and low findings, the checks to make by hand, scope drift and notes. */
function worthALookSection(input: VerdictInput): string | null {
    const { judgments } = input;
    const lines: string[] = ["### Worth a look", ""];
    for (const item of sortedItems(judgments).filter((x) => isOpen(judgments, x) && (x.severity === "medium" || x.severity === "low"))) {
        lines.push(...openItemLines(item, input, false), "");
    }
    for (const r of unconfirmed(judgments.results ?? [])) {
        lines.push(`- Check by hand: ${inlineText(r.about)} · looked: ${inlineText(r.looked ?? "")} · confirm by: ${inlineText(r.confirmBy ?? "")}`);
    }
    for (const s of judgments.scopeDrift ?? []) lines.push(`- Scope drift: ${inlineText(s)}`);
    for (const n of judgments.notes ?? []) lines.push(`- Note: ${inlineText(n)}`);
    if (lines.length === 2) return null;
    return trimBlank(lines).join("\n");
}

/**
 * An open item (G11, G12): its ID, severity and subject; then what is wrong, a link to the location,
 * and how to resolve it — the fix, and for an answerable item the paste line in its own code block,
 * the deferral approval line when a proposal settles it, and the command to run afterwards (D9).
 * An item carried from before this release shows only the fields it has.
 */
function openItemLines(item: Departure | Finding, input: VerdictInput, answerable: boolean): string[] {
    const { judgments, facts } = input;
    const lines = [`**${item.id}** · ${item.severity} · ${inlineText(subjectOf(item))}`, ""];
    let wrong = `- What is wrong: ${inlineText(item.summary)}`;
    if (item.kind === "departure" && item.stub !== null) wrong += ` Stub \`${inlineText(item.stub.path)}\` says: ${inlineText(item.stub.reason)}`;
    if (item.kind === "departure" && item.supersedes !== null) wrong += ` Supersedes ${inlineText(item.supersedes.decision)}: ${inlineText(item.supersedes.instead)}`;
    lines.push(wrong);
    if (item.location !== undefined) lines.push(`- Location: ${locationLink(facts, item.location)}`);
    if (item.fix !== undefined) lines.push(`- Fix: ${inlineText(item.fix)}`);
    if (answerable) {
        const verb = item.kind === "departure" ? "accepted" : "waived";
        lines.push("- Or answer it on the pull request. Write your reason after the colon; the line applies nothing without one:", "", ...pasteLine(`${item.id} — ${verb}:`));
        const proposal = judgments.deferred.find((ds) => ds.found && ds.settles === item.id && ds.answer === null);
        if (proposal !== undefined) {
            lines.push(`- Or approve deferring ${proposal.id}, the scope it leaves out: ${inlineText(proposal.summary)}`, "", ...pasteLine(`${proposal.id} — approved:`));
        }
        lines.push(`- Then run \`/nxs.analyze --pr ${facts.pr} --resolve\`.`);
    }
    for (const a of input.unapplied.filter((u) => u.id === item.id)) lines.push(`- ${unappliedText(a)}`);
    return lines;
}

/** A paste line in its own code block, inside the item's list (R2). */
function pasteLine(line: string): string[] {
    return ["  ```text", `  ${line}`, "  ```", ""];
}

function unappliedText(a: UnappliedAnswer): string {
    return `Answer not applied: @${inlineText(a.author)} on ${inlineText(a.id)} ([comment](${safeUrl(a.url)})): ${a.why}`;
}

/** Already answered (D8; G13): the subject first, then the answer, who gave it with a link, the reason, and the ID. */
function alreadyAnsweredSection(input: VerdictInput): string | null {
    const { judgments } = input;
    const lines: string[] = ["### Already answered", ""];
    for (const item of sortedItems(judgments).filter((x) => x.found && !isOpen(judgments, x))) {
        if (item.answer !== null) {
            lines.push(`- ${inlineText(subjectOf(item))} — ${answerText(item.answer)} · ${item.id}`);
            continue;
        }
        const approval = judgments.deferred.find((ds) => ds.found && ds.settles === item.id && ds.answer?.verb === "approved");
        if (approval?.answer) lines.push(`- ${inlineText(subjectOf(item))} — deferral ${approval.id} ${answerText(approval.answer)} · ${item.id}`);
    }
    for (const ds of deferredScopeStatus(judgments)) {
        if (ds.state === "to-file" && ds.approvedBy !== null) {
            lines.push(`- Deferred scope ${ds.id}: ${inlineText(ds.summary)} — to file, approved by @${inlineText(ds.approvedBy.author)} ([comment](${safeUrl(ds.approvedBy.link)})) · settles ${ds.settles}`);
        } else if (ds.state === "not-filed" && ds.settledBy !== null) {
            lines.push(`- Deferred scope ${ds.id}: ${inlineText(ds.summary)} — not filed: ${ds.settles} was ${inlineText(ds.settledBy.verb)} by @${inlineText(ds.settledBy.author)} without approving it`);
        }
    }
    if (lines.length === 2) return null;
    return lines.join("\n");
}

/** No longer found (D8; G14): each item the run did not find again, with its answer, never dropped. */
function noLongerFoundSection(input: VerdictInput): string | null {
    const { judgments } = input;
    const lines: string[] = ["### No longer found", ""];
    for (const item of sortedItems(judgments).filter((x) => !x.found)) {
        lines.push(`- ${inlineText(subjectOf(item))} · ${item.id} · ${item.answer === null ? "unanswered" : answerText(item.answer)}`);
    }
    for (const ds of judgments.deferred.filter((d) => !d.found)) {
        lines.push(`- Deferred scope: ${inlineText(ds.summary)} · ${ds.id} · ${ds.answer === null ? "unanswered" : answerText(ds.answer)}`);
    }
    if (lines.length === 2) return null;
    return lines.join("\n");
}

function answerText(answer: { verb: string; author: string; link: string; reason: string }): string {
    const reason = answer.reason.trim().length === 0 ? "" : `: ${inlineText(answer.reason)}`;
    return `${inlineText(answer.verb)} by @${inlineText(answer.author)} ([comment](${safeUrl(answer.link)}))${reason}`;
}

/**
 * A link to the file and line at the analyzed head, in the pull request's code repository, built
 * from the repository identity the receipt stamps, host included (D10; G16).
 */
export function locationLink(facts: Pick<VerdictFacts, "repo" | "head">, location: { file: string; line: number }): string {
    const parts = facts.repo.replace(/^https?:\/\//, "").replace(/\.git$/, "").split("/").filter((p) => p.length > 0);
    const base = parts.length >= 3 ? parts.join("/") : `github.com/${parts.join("/")}`;
    const file = location.file.replace(/^\.\//, "");
    const url = `https://${base}/blob/${facts.head}/${file.split("/").map(encodeURIComponent).join("/")}#L${location.line}`;
    return `[${inlineText(file)}:${location.line}](${safeUrl(url)})`;
}

function trimBlank(lines: string[]): string[] {
    while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    return lines;
}

/** The stories table: counts only (D11; G17). */
function storiesSection(facts: VerdictFacts, results: readonly Result[]): string {
    const lines = ["### Stories", "", "| Story | Met | Partial | Unmet | Contradicted | Unconfirmed |", "|---|---|---|---|---|---|"];
    for (const story of facts.stories) {
        const c = storyCounts(story.number, results);
        lines.push(`| ${inlineText(story.ref)} ${inlineText(story.title)} | ${c.met}/${c.total} | ${c.partial} | ${c.unmet} | ${c.contradicted} | ${c.unconfirmed} |`);
    }
    return lines.join("\n");
}

function storyCounts(story: number, results: readonly Result[]): Record<"met" | "partial" | "unmet" | "contradicted" | "unconfirmed" | "total", number> {
    const c = { met: 0, partial: 0, unmet: 0, contradicted: 0, unconfirmed: 0, total: 0 };
    for (const r of results) {
        if (r.kind !== "criterion" || storyOf(r.about) !== story) continue;
        c.total += 1;
        const v = r.verdict === "unverifiable" ? "unconfirmed" : r.verdict;
        if (v in c) c[v as keyof typeof c] += 1;
    }
    return c;
}

/** A section GitHub shows folded until the reader opens it. */
function collapsed(summary: string, content: string[]): string {
    return ["<details>", `<summary>${summary}</summary>`, "", ...content, "", "</details>"].join("\n");
}

/**
 * The evidence for each criterion and guarantee, collapsed (D11; G17): where each judgment rests,
 * or the files it was judged on when the result was recorded before evidence was carried.
 */
function evidenceSection(judgments: Judgments): string | null {
    const rows = (judgments.results ?? []).filter((r) => r.kind !== "metric");
    if (rows.length === 0) return null;
    const table = ["| Check | Result | Evidence |", "|---|---|---|"];
    for (const r of rows) table.push(`| ${inlineText(r.about)} | ${r.verdict} | ${inlineText(r.evidence ?? r.files.join(", "))} |`);
    return collapsed("Evidence", table);
}

/**
 * The epic-level results: one table, one row per check (D11; G18). A run that did not judge the
 * epic level shows one row saying so; a pull request that does not complete the epic shows none.
 */
function epicLevelSection(facts: VerdictFacts, results: readonly Result[]): string | null {
    if (facts.epicLevel.state === "skip") return null;
    const lines = ["### Epic level", "", "| Check | Result |", "|---|---|"];
    if (facts.epicLevel.state === "not-run") {
        lines.push(`| Epic-level check | not run: ${inlineText(facts.epicLevel.lines.join(" ")) || "the head does not contain every merged sibling"} |`);
        return lines.join("\n");
    }
    const checks = results.filter((r) => r.kind === "metric" || r.kind === "guarantee");
    for (const r of checks) lines.push(`| ${inlineText(r.about)} | ${r.verdict} |`);
    if (checks.length === 0) lines.push("| Epic-level checks | none recorded |");
    return lines.join("\n");
}

/** The concept-invariant sentence: how many were checked and from which pages, or that none were (G22). */
export function conceptSentence(facts: VerdictFacts): string {
    const { pages, checked, notFound } = facts.concepts;
    const head =
        pages.length === 0
            ? "No concept invariants were checked: the epic lists no concept pages."
            : `${checked} concept invariant${checked === 1 ? "" : "s"} checked, from ${pages.map(inlineText).join(", ")}.`;
    return notFound.length === 0 ? head : `${head} Listed but not found: ${notFound.map(inlineText).join(", ")}.`;
}

/**
 * Run details, collapsed (D11; G20, G21, G24): the mode, the record and its full hash, the head, the
 * key decisions, the concept-invariant sentence and the recorded scope, then the receipt block —
 * its marker directly followed by its fence — and the judgments block after it.
 */
function runDetailsSection(input: VerdictInput, open: OpenCounts): string {
    const { facts, judgments } = input;
    const lines: string[] = [];
    lines.push(`- Mode: ${facts.record === null ? "downgraded (the epic has no decision record)" : "full"}`);
    if (facts.record !== null) lines.push(`- Record: ${inlineText(facts.record.ref)} @ ${inlineText(facts.record.hash)}`);
    lines.push(`- Head: ${inlineText(facts.head)}`);
    lines.push(`- Key decisions: ${keyDecisionsText(judgments)}`);
    for (const s of judgments.keyDecisions?.stubs ?? []) {
        lines.push(`- Stub \`${inlineText(s.path)}\`: ${inlineText(s.choice)} — ${inlineText(s.reason)} (refuted: ${inlineText(s.refuted)})`);
    }
    lines.push(`- Concept invariants: ${conceptSentence(facts)}`);
    for (const r of facts.recorded) lines.push(`- Recorded: ${inlineText(r)}`);
    return collapsed("Run details", [...lines, "", receiptBlock(facts, open), renderJudgmentsBlock(judgments).trimEnd()]);
}

function keyDecisionsText(judgments: Judgments): string {
    const record = judgments.keyDecisions?.record ?? null;
    if (record === null) return "none from a record";
    if (record.format === "neither") return `the whole record @ ${inlineText(record.digest)}`;
    const names = record.decisions.map((d) => ("id" in d ? d.id : d.title)).map(inlineText);
    return `${names.length === 0 ? "none" : names.join(", ")} @ ${inlineText(record.digest)}`;
}

/** The receipt block `nexus close` and the merge pre-check read: its marker directly followed by its fence (G24). */
function receiptBlock(facts: VerdictFacts, open: OpenCounts): string {
    const lines = [RECEIPT_MARKER, "```yaml", `epic: "${yamlText(facts.epic.ref)}"`];
    if (facts.nexusVersion !== null) lines.push(`nexus_version: ${yamlText(facts.nexusVersion)}`);
    lines.push(
        `issues_repo: ${yamlText(facts.issuesRepo)}`,
        `repo: ${yamlText(facts.repo)}`,
        `stories: [${facts.stories.map((s) => s.number).join(", ")}]`,
        `pr: ${facts.pr}`,
        `date: ${yamlText(facts.date)}`,
        `head: ${facts.head}`,
        `mode: ${facts.record === null ? "downgraded" : "full"}`,
    );
    if (facts.record !== null) lines.push(`record: "${yamlText(facts.record.ref)}"`, `record_hash: ${yamlText(facts.record.hash)}`);
    lines.push(`findings: { critical: ${open.critical}, high: ${open.high}, medium: ${open.medium}, low: ${open.low} }`, "```");
    return lines.join("\n");
}

/** A receipt value: one line, with nothing that could end the fence or the quoted value. */
function yamlText(s: string): string {
    return s.replace(/[\r\n`"]/g, "").trim();
}

/** Departures, then findings, each in ID order (D5). */
function sortedItems(judgments: Judgments): Array<Departure | Finding> {
    const byId = (a: { id: string }, b: { id: string }): number => (splitItemId(a.id)?.n ?? 0) - (splitItemId(b.id)?.n ?? 0);
    return [...[...judgments.items].sort(byId), ...[...judgments.findings].sort(byId)];
}

/** What an item is about: the element a departure departs from, or what a finding judges. */
export function subjectOf(item: Departure | Finding): string {
    return item.kind === "departure" ? item.departsFrom : item.about;
}

function unconfirmed(results: readonly Result[]): Result[] {
    return results.filter((r) => r.kind !== "metric" && (r.verdict === "unconfirmed" || r.verdict === "unverifiable"));
}

/** The story number a criterion's `about` names (`#<n> AC<k>`), or null. */
function storyOf(about: string): number | null {
    const m = /#(\d+)/.exec(about);
    return m === null ? null : Number(m[1]);
}


function isRecord(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === "object" && !Array.isArray(v);
}

function nonEmpty(v: unknown): v is string {
    return typeof v === "string" && v.trim().length > 0;
}

function stringList(v: unknown): v is string[] {
    return Array.isArray(v) && v.every((x) => typeof x === "string");
}
