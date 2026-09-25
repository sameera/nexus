/**
 * The one reader of a decision record's sections (epic #787, stories #789 and #790).
 *
 * A record now comes in two formats. The approval-first format states its contract under
 * `## Guarantees` and its decisions in the appendix, under `### Decisions and reasons`. The old
 * format states it under `## Constraints & Invariants` and its decisions under `## Key Decisions`.
 * Every reader of a record needs to know which one it holds and where its parts are: the checkpoint
 * builds its cut list from them, and the later stages check and distill against them. A list the
 * model assembles by hand can drop a line and nothing notices, so the reading lives here once.
 *
 * The format is told apart by headings alone (D3). The filed body is the hashed artifact and
 * carries no marker. A body with neither section reads as `neither`, and the caller decides what
 * that means for it.
 */

import { stripLabels } from "./labels.js";

/** Which format a record body is in, told apart by its headings. */
export type RecordFormat = "new" | "old" | "neither";

/** One list item of a record, as written. */
export interface RecordLine {
    /** 1-indexed line of the body the item is written on. */
    line: number;
    /** The item's record ID, `G3` or `R2`. The old format numbers invariants and names risks, so it has none. */
    id: string | undefined;
    /** The line exactly as written, marker and provenance label included. */
    text: string;
}

/** A guarantee, with the group heading it sits under. */
export interface RecordGuarantee extends RecordLine {
    /** The `###` heading it sits under, such as "Existing behaviour to preserve"; empty before any. */
    group: string;
}

/** One `- **Name:** value` field of a decision entry. */
export interface RecordField {
    line: number;
    name: string;
    /** The value as written after the field name, `none` included. */
    value: string;
}

/** One decision entry. */
export interface RecordDecision {
    /** 1-indexed line of the decision's heading. */
    line: number;
    /** `D4` in the new format; the old format's decisions carry no ID. */
    id: string | undefined;
    /** The heading as written, minus any trailing template comment. */
    heading: string;
    /** Every field of the entry, in order, `none` fields included. */
    fields: RecordField[];
    /** The refuted alternatives it states. In the new format one written as `none` is not an alternative. */
    alternatives: RecordField[];
}

/** A record's parts. The guarantees are the new format's; the invariants are the old format's. */
export interface RecordReading {
    format: RecordFormat;
    decisions: RecordDecision[];
    guarantees: RecordGuarantee[];
    invariants: RecordLine[];
    risks: RecordLine[];
    conceptChanges: RecordLine[];
}

const GUARANTEES: RegExp = /^Guarantees$/i;
const INVARIANTS: RegExp = /^Constraints & Invariants$/i;
const RISKS: RegExp = /^Risks\b/i;
const CONCEPTS: RegExp = /^Concept-store changes$/i;
const APPENDIX: RegExp = /^Design rationale and mechanism$/i;
const DECISIONS_AND_REASONS: RegExp = /^Decisions and reasons$/i;
const KEY_DECISIONS: RegExp = /^Key Decisions$/i;

const ITEM: RegExp = /^(?:- |\d+\. )/;
const FIELD: RegExp = /^-[ \t]+\*\*(.+?):\*\*[ \t]*(.*)$/;
const NONE: RegExp = /^none\.?$/i;

/** One line of the body, with the headings it sits under at each depth. */
interface Located {
    line: number;
    text: string;
    /** The open heading at depths 2, 3 and 4, or "" where none is open. */
    h2: string;
    h3: string;
    h4: string;
    /** The line number of the open `###` and `####` headings, for a decision's own line. */
    h3Line: number;
    h4Line: number;
    /** Whether this line is itself a heading. */
    heading: boolean;
}

/** A heading's text with any trailing template comment removed, the form the headings match in. */
function headingText(raw: string): string {
    return raw.replace(/\s*<!--.*$/, "").trim();
}

/** Every line of the body, with the headings open above it. */
function locate(body: string): Located[] {
    const open: { h2: string; h3: string; h4: string; h3Line: number; h4Line: number } = { h2: "", h3: "", h4: "", h3Line: 0, h4Line: 0 };
    return body.split("\n").map((text: string, index: number) => {
        const match: RegExpMatchArray | null = text.match(/^(#+) (.*)$/);
        if (match !== null) {
            const depth: number = match[1].length;
            const name: string = headingText(match[2]);
            if (depth <= 2) Object.assign(open, { h2: depth === 2 ? name : "", h3: "", h4: "", h3Line: 0, h4Line: 0 });
            else if (depth === 3) Object.assign(open, { h3: name, h4: "", h3Line: index + 1, h4Line: 0 });
            else if (depth === 4) Object.assign(open, { h4: name, h4Line: index + 1 });
        }
        return { line: index + 1, text, ...open, heading: match !== null };
    });
}

/** Which format a body is in. A body with both sections reads as the new format. */
export function recordFormat(body: string): RecordFormat {
    const headings: string[] = locate(body)
        .filter((l: Located) => l.heading && /^## /.test(l.text))
        .map((l: Located) => l.h2);
    if (headings.some((h: string) => GUARANTEES.test(h))) return "new";
    if (headings.some((h: string) => INVARIANTS.test(h))) return "old";
    return "neither";
}

/** The ID an item or a heading starts with, when it starts with one of these letters. */
function idOf(text: string, letter: "G" | "R" | "D"): string | undefined {
    return text.match(new RegExp(`^(?:- )?(${letter}\\d+)\\b`))?.[1];
}

/** The top-level list items under one `##` section. */
function itemsUnder(lines: Located[], section: RegExp): Located[] {
    return lines.filter((l: Located) => !l.heading && section.test(l.h2) && ITEM.test(l.text));
}

/** Decision entries: the headings at one depth under the given parents, with their fields. */
function decisionsOf(lines: Located[], inEntry: (l: Located) => boolean, depth: "h3" | "h4", isNew: boolean): RecordDecision[] {
    const entries: RecordDecision[] = [];
    for (const l of lines) {
        if (!inEntry(l) || l[depth] === "") continue;
        const start: number = depth === "h3" ? l.h3Line : l.h4Line;
        let entry: RecordDecision | undefined = entries[entries.length - 1];
        if (entry === undefined || entry.line !== start) {
            entry = { line: start, id: isNew ? idOf(l[depth], "D") : undefined, heading: l[depth], fields: [], alternatives: [] };
            entries.push(entry);
        }
        const field: RegExpMatchArray | null = l.heading ? null : l.text.match(FIELD);
        if (field === null) continue;
        const read: RecordField = { line: l.line, name: field[1].trim(), value: field[2].trim() };
        entry.fields.push(read);
        const alternative: RegExp = isNew ? /^Refuted viable alternative$/i : /^Refuted alternative$/i;
        if (alternative.test(read.name) && !(isNew && NONE.test(stripLabels(read.value).trim()))) entry.alternatives.push(read);
    }
    return entries;
}

function asLine(l: Located, letter: "G" | "R" | undefined): RecordLine {
    return { line: l.line, id: letter === undefined ? undefined : idOf(l.text, letter), text: l.text };
}

/**
 * A body's sections, read by the headings of the format given. The checkpoint reads a draft in
 * neither format as the old format, as it always has, so this is exported beside `readRecord`.
 */
export function readRecordAs(body: string, format: "new" | "old"): RecordReading {
    const lines: Located[] = locate(body);
    if (format === "new") {
        return {
            format,
            decisions: decisionsOf(lines, (l: Located) => APPENDIX.test(l.h2) && DECISIONS_AND_REASONS.test(l.h3), "h4", true),
            guarantees: itemsUnder(lines, GUARANTEES).map((l: Located) => ({ ...asLine(l, "G"), group: l.h3 })),
            invariants: [],
            risks: itemsUnder(lines, RISKS).map((l: Located) => asLine(l, "R")),
            conceptChanges: itemsUnder(lines, CONCEPTS).map((l: Located) => asLine(l, undefined)),
        };
    }
    return {
        format,
        decisions: decisionsOf(lines, (l: Located) => KEY_DECISIONS.test(l.h2), "h3", false),
        guarantees: [],
        invariants: itemsUnder(lines, INVARIANTS).map((l: Located) => asLine(l, undefined)),
        risks: itemsUnder(lines, RISKS).map((l: Located) => asLine(l, undefined)),
        conceptChanges: [],
    };
}

/**
 * A record's format and its parts. A body in neither format has no parts to read: after approval
 * the caller reads it whole, as before the approval-first format existed.
 */
export function readRecord(body: string): RecordReading {
    const format: RecordFormat = recordFormat(body);
    if (format === "neither") return { format, decisions: [], guarantees: [], invariants: [], risks: [], conceptChanges: [] };
    return readRecordAs(body, format);
}

/** A decision as a later stage reads it: its parts by name, with every field written as `none` absent. */
export interface SectionDecision {
    /** 1-indexed line of the decision's heading. */
    line: number;
    /** `D4` in the new format; the old format's decisions carry no ID. */
    id: string | undefined;
    /** The heading without its ID. */
    title: string;
    decision: string | undefined;
    why: string | undefined;
    /** Every refuted alternative the decision states, in order. */
    refutedAlternatives: string[];
    tradeOff: string | undefined;
    /** The epic or story change it makes, old and new wording and status, as written. */
    commitmentAffected: string | undefined;
    deliveredBy: string | undefined;
    /** The guarantee IDs it supports. */
    guarantees: string[];
}

/** A guarantee: its group, its text without the list marker and the ID, and the decisions it cites. */
export interface SectionGuarantee {
    line: number;
    id: string | undefined;
    group: string;
    text: string;
    decisions: string[];
}

/** An old-format invariant, with the number it is written under. */
export interface SectionInvariant {
    line: number;
    number: number | undefined;
    text: string;
}

/** A risk, with its severity. The new format gives it an ID; the old format names it in bold. */
export interface SectionRisk {
    line: number;
    id: string | undefined;
    severity: "BLOCKER" | "ADDRESS" | undefined;
    text: string;
}

/**
 * One statement the design changes in the concept store. `old` and `new` are set when the whole
 * line reads `<page> page: "<old>" becomes "<new>".`; otherwise read the line whole, in `text`.
 */
export interface SectionConceptChange {
    line: number;
    page: string | undefined;
    old: string | undefined;
    new: string | undefined;
    text: string;
}

/** What `nexus record-sections` prints: a record's format and the parts the later stages read. */
export interface RecordSections {
    format: RecordFormat;
    decisions: SectionDecision[];
    guarantees: SectionGuarantee[];
    invariants: SectionInvariant[];
    risks: SectionRisk[];
    conceptChanges: SectionConceptChange[];
}

/** A value with its provenance labels removed, or undefined when it is written as `none`. */
function valueOf(raw: string): string | undefined {
    const value: string = stripLabels(raw).trim();
    return NONE.test(value) ? undefined : value;
}

/** A list item's text with its marker, its ID and its provenance labels removed. */
function itemText(text: string, id: string | undefined): string {
    const bare: string = stripLabels(text).trim().replace(ITEM, "");
    return id === undefined ? bare : bare.replace(new RegExp(`^${id}\\.?\\s*`), "");
}

function idsIn(text: string, letter: "G" | "D"): string[] {
    return [...text.matchAll(new RegExp(`\\b${letter}\\d+\\b`, "g"))].map((m: RegExpMatchArray) => m[0]);
}

function sectionDecision(d: RecordDecision): SectionDecision {
    const field = (name: RegExp): string | undefined => {
        const found: RecordField | undefined = d.fields.find((f: RecordField) => name.test(f.name));
        return found === undefined ? undefined : valueOf(found.value);
    };
    const guarantees: string | undefined = field(/^Guarantees$/i);
    return {
        line: d.line,
        id: d.id,
        title: d.id === undefined ? d.heading : d.heading.replace(new RegExp(`^${d.id}\\s*[—–-]\\s*`), ""),
        decision: field(/^Decision$/i),
        why: field(/^Why$/i),
        refutedAlternatives: d.alternatives.map((a: RecordField) => valueOf(a.value)).filter((v: string | undefined): v is string => v !== undefined),
        tradeOff: field(/^Trade-off$/i),
        commitmentAffected: field(/^Epic commitment affected$/i),
        deliveredBy: field(/^Delivered by$/i),
        guarantees: guarantees === undefined ? [] : idsIn(guarantees, "G"),
    };
}

function sectionRisk(r: RecordLine): SectionRisk {
    const bare: string = itemText(r.text, r.id);
    const severity: RegExpMatchArray | null = bare.match(/^(?:\*\*)?(BLOCKER|ADDRESS)\b/);
    const text: string = r.id === undefined ? bare : bare.replace(/^(BLOCKER|ADDRESS)\s*[—–:-]\s*/, "");
    return { line: r.line, id: r.id, severity: severity === null ? undefined : (severity[1] as "BLOCKER" | "ADDRESS"), text };
}

function sectionConceptChange(c: RecordLine): SectionConceptChange {
    const text: string = itemText(c.text, undefined);
    const page: string | undefined = text.match(/^([^:"]+?)(?: page)?:\s/)?.[1].trim();
    // Split only a line that ends at the new wording: anything after it is part of the rewrite, and
    // a split would drop it. Such a line is given whole in `text`.
    const rewrite: RegExpMatchArray | null = text.match(/:\s*"([^"]+)"\s+becomes\s+"([^"]+)"\.?$/);
    return { line: c.line, page, old: rewrite?.[1], new: rewrite?.[2], text };
}

/**
 * A record's parts as the stages after approval read them (story #790, D4): `/nxs.analyze` takes its
 * conditions from the guarantees or the invariants, and `/nxs.close` and `/nxs.distill` take their
 * decisions, reasons and stated concept-store rewrites from here rather than finding them by hand.
 * Values are given without provenance labels, and a field written as `none` is absent. A body in
 * neither format has no parts; the stage reads it whole.
 */
export function recordSections(body: string): RecordSections {
    const read: RecordReading = readRecord(body);
    return {
        format: read.format,
        decisions: read.decisions.map(sectionDecision),
        guarantees: read.guarantees.map((g: RecordGuarantee) => {
            const text: string = itemText(g.text, g.id);
            const cited: RegExpMatchArray | null = text.match(/\(((?:D\d+)(?:\s*,\s*D\d+)*)\)\.?$/);
            return { line: g.line, id: g.id, group: g.group, text, decisions: cited === null ? [] : idsIn(cited[1], "D") };
        }),
        invariants: read.invariants.map((i: RecordLine) => {
            const number: RegExpMatchArray | null = i.text.match(/^(\d+)\./);
            return { line: i.line, number: number === null ? undefined : Number(number[1]), text: itemText(i.text, undefined) };
        }),
        risks: read.risks.map(sectionRisk),
        conceptChanges: read.conceptChanges.map(sectionConceptChange),
    };
}

/** One surviving line that still cites a guarantee or a risk the reviewer cut. */
export interface CutCitation {
    /** 1-indexed line of the draft. */
    line: number;
    /** The cut ID it cites. */
    id: string;
    /** The line as written. */
    text: string;
}

/** A cut ID as a whole token: `G3` must not match `G31`, and `R2` must not match `SR2`. */
function wholeId(id: string): RegExp {
    return new RegExp(`(?<![A-Za-z0-9_])${id}(?![A-Za-z0-9_])`);
}

/**
 * Every line of a draft that still cites a cut guarantee or risk (D5). A cut in the new format
 * leaves the other numbers unchanged, so a citation to the cut ID would name something the record
 * no longer holds. Removing it automatically would change what a decision says it supports, so each
 * one is reported for the lead to fix. A provenance label's quoted fragment is the lead's words, not
 * a citation, so labels are stripped before matching; stripping keeps the line numbers.
 */
export function cutCitations(draft: string, cut: readonly string[]): CutCitation[] {
    const original: string[] = draft.split("\n");
    const found: CutCitation[] = [];
    stripLabels(draft)
        .split("\n")
        .forEach((line: string, index: number) => {
            for (const id of cut) {
                if (wholeId(id).test(line)) found.push({ line: index + 1, id, text: original[index] });
            }
        });
    return found;
}
