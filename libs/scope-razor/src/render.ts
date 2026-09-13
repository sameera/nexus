/**
 * How the razor's findings are printed. One line per finding, each naming a location and the thing
 * to change, so a stage that stops on a non-zero exit can hand the reader something actionable
 * rather than "the check failed".
 */

import type { Finding, TokenKind } from "./labels.js";
import type { RazorFinding } from "./check.js";
import type { OfferItem } from "./offer.js";

/** What each surviving token asks of the reader — a label goes, a placeholder and a marker do not. */
const REMEDY: Record<TokenKind, string> = {
    label: "provenance label — strip it",
    placeholder: "template placeholder — replace it",
    observation: "observation marker — an observation belongs in the gate's render, not in the body",
    ordering: "draft-time ordering — the native dependency edges own the graph once the issues exist",
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

/**
 * The offer list as the gate reads it (epic #576, story #579): the stories the smallest usable
 * version excludes, in the two labelled groups, each carrying its stable number, its blockers and —
 * for an asked-for story — the fragment that claims the lead's own authority for it.
 *
 * The numbering starts at one and is the sequence the reviewer types against; the gate's own
 * removals continue it. The order is the graph's and nothing else, so this render is the one place
 * the sequence is decided and the gate's prose transcribes rather than re-derives it.
 */
export function renderOfferList(draft: string, items: OfferItem[]): string {
    if (items.length === 0) return `razor-offer: ${draft} — the smallest usable version needs every story; there is nothing to offer`;
    const group = (label: string, of: "asked" | "inferred"): string[] => {
        const rows: OfferItem[] = items.filter((item: OfferItem) => item.provenance === of);
        if (rows.length === 0) return [];
        return [
            `  ${label}`,
            ...rows.map((item: OfferItem) => {
                const waits: string = item.blockedBy.length === 0 ? "none" : item.blockedBy.join("; ");
                const claim: string = item.fragment === undefined ? "" : ` · you asked: "${item.fragment}"`;
                return `    ${item.number}. ${item.title} · waits on: ${waits}${claim}`;
            }),
        ];
    };
    return [
        `razor-offer: ${draft} — ${items.length} story/stories the smallest usable version excludes:`,
        ...group("Asked for", "asked"),
        ...group("Added by the drafting model", "inferred"),
    ].join("\n");
}
