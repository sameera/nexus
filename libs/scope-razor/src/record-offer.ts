/**
 * The record checkpoint's checklist (epic #722, story #723).
 *
 * The decision-record stage labels every invariant and every risk it drafts as the lead's own or as
 * its own addition, checks each quotation against the run's source text, and then strips the labels
 * before filing. Its checkpoint used to render the refuted alternatives and nothing else, so no
 * human ever saw those labels — which is the failure the razor names, a gate that does not show
 * what the model added leaves the labelling as decoration.
 *
 * So the selection moves here, beside the planning gate's, for the reason the planning gate's moved:
 * a list a drafting model assembles by hand can quietly omit one line and nothing downstream would
 * notice, while an omission from a checker is a test failure. The stage transcribes what this
 * returns and adds only the viability observation and the choice.
 *
 * Only the model's own additions are listed. A guarantee (an invariant, in an old-format record) or a
 * risk the lead asked for is the lead's own definition, and striking it is a revise rather than a
 * tick — the same treatment the planning gate gives an asked-for acceptance criterion.
 *
 * The sections are read by the record reader (epic #787, story #789), which knows both formats. A
 * renamed heading would otherwise empty the list silently, which is the one failure this gate exists
 * to prevent. A draft in neither format is read by the old headings, as it always was.
 */

import { normalize } from "./citations.js";
import { readClaim } from "./document.js";
import { stripLabels } from "./labels.js";
import { readRecordAs, recordFormat, type RecordDecision, type RecordField, type RecordGuarantee, type RecordLine, type RecordReading } from "./record.js";

/**
 * Which part of the record a checklist line came from. A new-format record lists guarantees, and an
 * old-format one lists invariants (epic #787, story #789).
 */
export type RecordChecklistKind = "alternative" | "invariant" | "guarantee" | "risk";

/** One line of the checkpoint's checklist. */
export interface RecordChecklistItem {
    /** Its number in the rendered list, from one, across every kind the list holds. */
    number: number;
    kind: RecordChecklistKind;
    /**
     * Ticked means a plain approval files it. Every line arrives ticked: this gate's convention is
     * removal, and there is no smaller usable record to default to.
     */
    filed: boolean;
    /** The item as the reviewer reads it: its marker, its label and any template comment gone. */
    text: string;
    /**
     * An alternative's decision, or a guarantee's group heading, so the reviewer reads what the line
     * belongs to. Nothing for an invariant or a risk.
     */
    parent: string | undefined;
    /**
     * Whether the approved record body already carries this line's content. A frozen line is still
     * rendered and still ticked; what it cannot be is flipped, because an approved body changes
     * only through the revision path's supersession trail.
     */
    frozen: boolean;
}

/**
 * An item as the reviewer reads it. The label goes because the reviewer is reading the item rather
 * than its provenance — the list holds only the model's own additions, so every line says the same
 * thing about provenance and saying it per line would be noise.
 */
function itemText(item: string): string {
    return stripLabels(item)
        .replace(/^[ \t]*(?:-[ \t]+|\d+\.[ \t]+)/, "")
        .replace(/<!--.*?-->/g, "")
        .trim();
}

/** The model's own additions among a section's items — an asked-for one is the lead's definition. */
function inferred<T extends RecordLine>(items: T[]): T[] {
    return items.filter((item: T) => readClaim(item.text).provenance === "inferred");
}

/**
 * Every refuted alternative the record states, under the decision it belongs to. A decision that
 * refutes nothing contributes no line: the razor offers the alternative rather than requiring it, so
 * an absent one is the ordinary case and not a gap to render. In the new format a decision states
 * that absence as `none`, and the reader already leaves that out.
 */
function alternatives(record: RecordReading): Array<Pick<RecordChecklistItem, "kind" | "text" | "parent">> {
    return record.decisions.flatMap((decision: RecordDecision) =>
        decision.alternatives.map((field: RecordField) => ({ kind: "alternative" as const, text: itemText(field.value), parent: decision.heading })),
    );
}

/**
 * The checkpoint's checklist: every refuted alternative, then every guarantee (or, in an old-format
 * record, every invariant) the model added, then every risk it added — one numbered sequence from
 * one, in the record's own section order.
 *
 * The numbering is one sequence across all three kinds because the reviewer's selection is one typed
 * list of numbers, and a number meaning a different thing depending on which group it sits in is the
 * second idiom this gate is being aligned away from. The order is the record's, so the list reads in
 * the same order as the document it describes, and no ranking is implied — ranking would have the
 * drafting model sorting its own additions by how persuasive it finds them.
 *
 * Every line arrives ticked. This gate's convention is removal: a refuted alternative is not scope,
 * and an invariant describes an epic whose scope the planning gate has already settled, so there is
 * no smaller usable record to default to and inverting here would invert nothing.
 *
 * `approvedBody` is the record body as it stands approved, and it is passed only when the epic's
 * record sub-issue is closed at the moment the checkpoint runs. A line whose label-stripped text
 * that body already carries is marked frozen — matched by the same normalized containment the
 * citation check uses, never fuzzily — because approved content changes through the revision path's
 * supersession trail and never by being unticked at a gate. An open record is edited in place by
 * design, so it is not compared against and nothing about it is refused.
 */
export function recordChecklist(draft: string, approvedBody?: string): RecordChecklistItem[] {
    const record: RecordReading = readRecordAs(draft, recordFormat(draft) === "new" ? "new" : "old");
    const lines: Array<Pick<RecordChecklistItem, "kind" | "text" | "parent">> = [
        ...alternatives(record),
        ...inferred(record.guarantees).map((item: RecordGuarantee) => ({ kind: "guarantee" as const, text: itemText(item.text), parent: item.group === "" ? undefined : item.group })),
        ...inferred(record.invariants).map((item: RecordLine) => ({ kind: "invariant" as const, text: itemText(item.text), parent: undefined })),
        ...inferred(record.risks).map((item: RecordLine) => ({ kind: "risk" as const, text: itemText(item.text), parent: undefined })),
    ];
    const approved: string | undefined = approvedBody === undefined ? undefined : normalize(approvedBody);
    return lines.map((line: Pick<RecordChecklistItem, "kind" | "text" | "parent">, index: number) => ({
        ...line,
        number: index + 1,
        filed: true,
        frozen: approved !== undefined && line.text !== "" && approved.includes(normalize(line.text)),
    }));
}
