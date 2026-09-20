/**
 * How the razor reads a draft's shape (epic #576, story #579): its sections, the list items inside
 * them, and the provenance claim each item carries.
 *
 * Three readers need exactly this parse — the checker counts items and tests each for a label, the
 * gate's checklist is built out of the same items, and both have to agree about which lines are
 * items at all. A `- ` one reader counts and the other misses would let the gate render a draft the
 * check passed as though it held different scope, so the parse lives here once rather than beside
 * each reader.
 */

import { stripLabels } from "./labels.js";

/** A heading and everything under it, up to the next heading at the same or a shallower depth. */
export interface Section {
    heading: string;
    lines: string[];
}

/**
 * Every `##`- (or `###`-) level section of the draft. A deeper heading is content of the open
 * section rather than a boundary, so a story's `#### Acceptance Criteria` stays inside the story.
 */
export function sections(draft: string, depth: string): Section[] {
    const found: Section[] = [];
    let open: Section | undefined;
    for (const line of draft.split("\n")) {
        const heading: RegExpMatchArray | null = line.match(/^(#+) /);
        if (heading === null) {
            open?.lines.push(line);
        } else if (heading[1] === depth) {
            open = { heading: line.slice(depth.length + 1).trim(), lines: [] };
            found.push(open);
        } else if (heading[1].length > depth.length) {
            open?.lines.push(line);
        } else {
            open = undefined;
        }
    }
    return found;
}

/** Top-level list items — a nested continuation line is part of its item, not a second one. */
export function bullets(lines: string[]): string[] {
    return lines.filter((line: string) => /^- /.test(line));
}

/** An acceptance criterion: the checkbox form the epic template writes them in. */
export function criteria(lines: string[]): string[] {
    return lines.filter((line: string) => /^- \[[ x]\] /.test(line));
}

/** The two-valued vocabulary, as a presence test: an item carries one of them or it carries none. */
const LABELLED: RegExp = /`?\[(?:inferred|asked:[ \t]*"[^"]*")\]`?/;

/** Whether an item carries a provenance label at all. Unlabelled is the third state §1 denies. */
export function isLabelled(item: string): boolean {
    return LABELLED.test(item);
}

/** One item's provenance claim, and the quoted fragment an `asked` claim rests on. */
export interface Claim {
    provenance: "asked" | "inferred";
    /** Present only on an `asked` claim — the fragment rendered verbatim beside the item. */
    fragment: string | undefined;
}

const LABEL_VALUE: RegExp = /`?\[(?:(inferred)|asked:[ \t]*"([^"]*)")\]`?/;

/**
 * The claim one item makes. An unlabelled item reads as `inferred` rather than as a third value:
 * the checker blocks such a draft before any gate renders it, and of the two readings this is the
 * one that never files something on the lead's authority because a label was missing.
 */
export function readClaim(item: string): Claim {
    const label: RegExpMatchArray | null = item.match(LABEL_VALUE);
    return {
        provenance: label !== null && label[1] === undefined ? "asked" : "inferred",
        fragment: label?.[2],
    };
}

/** An item as the gate renders it: the marker, the label and any trailing template comment gone. */
export function itemText(item: string): string {
    return stripLabels(item)
        .replace(/^[ \t]*- (\[[ x]\][ \t]*)?/, "")
        .replace(/<!--.*?-->/g, "")
        .trim();
}
