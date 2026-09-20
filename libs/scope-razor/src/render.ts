/**
 * How the razor's findings are printed. One line per finding, each naming a location and the thing
 * to change, so a stage that stops on a non-zero exit can hand the reader something actionable
 * rather than "the check failed".
 */

import type { Finding, TokenKind } from "./labels.js";
import type { RazorFinding } from "./check.js";
import type { ChecklistItem, ChecklistKind } from "./offer.js";
import type { RecordChecklistItem, RecordChecklistKind } from "./record-offer.js";

/** What each surviving token asks of the reader — a label goes, a placeholder and a marker do not. */
const REMEDY: Record<TokenKind, string> = {
    label: "provenance label — strip it",
    placeholder: "template placeholder — replace it",
    observation: "observation marker — an observation belongs in the gate's render, not in the body",
    ordering: "draft-time ordering — the native dependency edges own the graph once the issues exist",
    "asset-path": "local asset path — publish it and rewrite the reference; no local path reaches an issue",
};

/**
 * The assertion-mode diagnostic: the tokens that survived into a body that was about to be filed.
 * Callers render this only on failure — a clean assertion says nothing.
 */
export function renderSurvivingTokens(draft: string, findings: Finding[]): string {
    return [
        `razor-check: ${findings.length} drafting-time token(s) survived into ${draft} — file nothing until they are removed:`,
        ...findings.map((f: Finding) => `  ${draft}:${f.line} ${f.token} — ${REMEDY[f.kind]}`),
    ].join("\n");
}

/**
 * The check-mode report: one line per finding, blocking first, each naming the story or section it
 * belongs to. The gate reports this and the caller fixes the draft — the checker edits nothing.
 */
export function renderRazorFindings(draft: string, findings: RazorFinding[]): string {
    if (findings.length === 0) return `razor-check: ${draft} breaks no razor rule`;
    const order = (f: RazorFinding): number => (f.severity === "blocking" ? 0 : 1);
    return [
        `razor-check: ${draft} — ${findings.length} finding(s):`,
        ...[...findings]
            .sort((a: RazorFinding, b: RazorFinding) => order(a) - order(b))
            .map((f: RazorFinding) => `  ${f.severity}: [${f.rule}] ${f.where} — ${f.message}`),
    ].join("\n");
}

/** The heading each run of one kind is printed under, so the reviewer reads what a tick governs. */
const GROUP: Record<ChecklistKind, string> = {
    story: "Stories",
    criterion: "Acceptance criteria — model-added, on stories above",
    assumption: "Assumptions",
    "out-of-scope": "Out of scope",
};

/** The provenance the reviewer reads off the line: a claim on their own words, or the model's. */
function claim(item: ChecklistItem): string {
    return item.fragment === undefined ? "inferred" : `you asked: "${item.fragment}"`;
}

/** A story's trailing detail — its size and what taking it also takes. */
function storyDetail(item: ChecklistItem): string {
    const size: string = item.size === undefined ? "" : ` · ${item.size}`;
    return `${size} · waits on: ${item.blockedBy.length === 0 ? "none" : item.blockedBy.join("; ")}`;
}

/**
 * The checklist as the gate renders it (epic #576, story #579): one numbered list, every line
 * carrying the tick it arrives with, so the reviewer reads the filed set directly instead of
 * assembling it out of groups that each mean something different.
 *
 * A ticked line is what a plain approval files. The reviewer names only the numbers they want
 * flipped, which is why the tick and the number are the first two things on every line, and why the
 * sequence is decided here rather than transcribed and re-derived by the gate's prose.
 *
 * No line carries a markdown list marker. The gate hands this text to a reviewer whose client
 * renders markdown, and a renderer given `- [x] 1.` consumes the tick as a task-list control and
 * renumbers the line — which deletes exactly the two things the reviewer's selection names. The
 * gate delivers the block verbatim inside a fence (nxs-razor §8); this keeps the text readable even
 * where it does not.
 */
export function renderChecklist(draft: string, items: ChecklistItem[]): string {
    if (items.length === 0) return `razor-offer: ${draft} — the draft declares no story, no boundary and nothing to tick`;
    const lines: string[] = [`razor-offer: ${draft} — the filed set, pre-ticked; ${items.length} numbered item(s):`];
    let group: ChecklistKind | undefined;
    let parent: string | undefined;
    const width: number = String(items[items.length - 1].number).length;
    for (const item of items) {
        if (item.kind !== group) {
            lines.push("", GROUP[item.kind]);
            group = item.kind;
            parent = undefined;
        }
        if (item.kind === "criterion" && item.parent !== parent) {
            lines.push(`  ${item.parent}`);
            parent = item.parent;
        }
        const number: string = String(item.number).padStart(width, " ");
        const detail: string = item.kind === "story" ? storyDetail(item) : "";
        lines.push(`  [${item.filed ? "x" : " "}] ${number}. ${item.text}${detail} · ${claim(item)}`);
    }
    return lines.join("\n");
}

/** The heading each run of one record kind is printed under, so the reviewer reads what it holds. */
const RECORD_GROUP: Record<RecordChecklistKind, string> = {
    alternative: "Refuted alternatives",
    invariant: "Invariants — model-added",
    risk: "Risks — model-added",
};

/**
 * The record checkpoint's checklist as the gate renders it (epic #722, story #723): one numbered
 * list holding every refuted alternative, every invariant the model added and every risk it added,
 * grouped by kind in the record's own section order and numbered as one sequence.
 *
 * The number is the first thing on every line, because the number is what the reviewer's selection
 * names. No line carries a markdown list marker, for the reason the planning gate's list carries
 * none: a renderer handed `- 1.` re-sequences the line from its own position, so the number the
 * reviewer reads is no longer the number the gate computed. The gate delivers this verbatim inside
 * a fence (nxs-razor §8); this keeps it legible where a block escapes one.
 */
export function renderRecordChecklist(draft: string, items: RecordChecklistItem[]): string {
    if (items.length === 0) return `razor-offer: ${draft} — the record states no refuted alternative and nothing the model added, so there is nothing to cut`;
    const lines: string[] = [`razor-offer: ${draft} — what the model added to the record; ${items.length} numbered item(s):`];
    let group: RecordChecklistKind | undefined;
    let parent: string | undefined;
    const width: number = String(items[items.length - 1].number).length;
    for (const item of items) {
        if (item.kind !== group) {
            lines.push("", RECORD_GROUP[item.kind]);
            group = item.kind;
            parent = undefined;
        }
        if (item.kind === "alternative" && item.parent !== parent) {
            lines.push(`  ${item.parent}`);
            parent = item.parent;
        }
        lines.push(`  ${String(item.number).padStart(width, " ")}. ${item.text}`);
    }
    return lines.join("\n");
}
