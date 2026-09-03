/**
 * The preservation comparison (story #423): the tracked items of the pre-translation copy against
 * those of the post-translation copy.
 *
 * The comparison is a multiset difference and nothing more. Counting is **position-blind**, which
 * is the property that makes the check compatible with an honest rewrite: a sentence split in two,
 * a name moved to the start of a sentence, and a noun repeated in place of a pronoun all leave
 * every count where it was.
 *
 * Two directions fail, and only two:
 *
 * - An item that survives at a **lower** count than it had. Something the author wrote is gone.
 * - An item that is **newly present** — absent from the pre-translation copy altogether. The
 *   translator invented it, unless a named grounding source already carried it.
 *
 * A higher count of an item that was already there never fails. That is repetition, which rule 5
 * of the translator's brief actively asks for.
 */

import {
    extractTracked,
    properNounVocabulary,
    type CapitalisedWord,
    type Scan,
    type TrackedItem,
    type TrackedKind,
} from "./tokens.js";

/** Which way a tracked item failed to survive. */
export type FindingKind = "missing" | "introduced";

/** One item that did not survive the translation intact. */
export interface PreservationFinding {
    kind: FindingKind;
    item: TrackedKind;
    /** The item as the author will recognise it. */
    label: string;
    /** The lines it stood on: in the pre-translation copy when missing, the post one when introduced. */
    lines: number[];
}

/** One item's count and where its occurrences stood. */
interface Tally {
    kind: TrackedKind;
    label: string;
    lines: number[];
}

/** The order findings are reported in, so a run's read-out is stable. */
const KIND_ORDER: readonly TrackedKind[] = ["numeric", "modal", "name", "heading", "list-item", "table-row"];

function tallyInto(tallies: Map<string, Tally>, key: string, kind: TrackedKind, label: string, line: number): void {
    const existing: Tally | undefined = tallies.get(key);
    if (existing === undefined) {
        tallies.set(key, { kind, label, lines: [line] });
        return;
    }
    existing.lines.push(line);
}

/**
 * Every tracked item of one scan, counted. Proper nouns are counted at every position, including
 * the start of a sentence — the vocabulary decided which words are names, and position never does.
 */
function tally(scan: Scan, vocabulary: ReadonlySet<string>): Map<string, Tally> {
    const tallies: Map<string, Tally> = new Map<string, Tally>();
    for (const found of scan.items as TrackedItem[]) {
        tallyInto(tallies, found.key, found.kind, found.label, found.line);
    }
    for (const word of scan.capitalised as CapitalisedWord[]) {
        if (vocabulary.has(word.word)) {
            tallyInto(tallies, `name:${word.word}`, "name", word.word, word.line);
        }
    }
    return tallies;
}

/**
 * The keys a grounding source carries. A source's proper nouns are admitted wherever they stand,
 * because the source is evidence that the name exists, not a copy under comparison.
 */
function sourceKeys(source: string): Set<string> {
    const scan: Scan = extractTracked(source);
    const keys: Set<string> = new Set<string>();
    for (const found of scan.items as TrackedItem[]) {
        keys.add(found.key);
    }
    for (const word of scan.capitalised as CapitalisedWord[]) {
        keys.add(`name:${word.word}`);
    }
    return keys;
}

function byKindThenLabel(left: PreservationFinding, right: PreservationFinding): number {
    const order: number = KIND_ORDER.indexOf(left.item) - KIND_ORDER.indexOf(right.item);
    return order !== 0 ? order : left.label.localeCompare(right.label);
}

/**
 * Every tracked item that did not survive the translation, missing items first.
 *
 * `sources` are the contents of the grounding sources the run named. With none named, every
 * introduced item is a finding: a translator handed no source material has nothing to have
 * grounded an addition in.
 */
export function comparePreservation(before: string, after: string, sources: readonly string[] = []): PreservationFinding[] {
    const beforeScan: Scan = extractTracked(before);
    const afterScan: Scan = extractTracked(after);
    const vocabulary: Set<string> = properNounVocabulary(beforeScan);
    for (const word of properNounVocabulary(afterScan)) {
        vocabulary.add(word);
    }

    const mine: Map<string, Tally> = tally(beforeScan, vocabulary);
    const theirs: Map<string, Tally> = tally(afterScan, vocabulary);
    const grounded: Set<string> = new Set<string>();
    for (const source of sources) {
        for (const key of sourceKeys(source)) {
            grounded.add(key);
        }
    }

    const missing: PreservationFinding[] = [];
    for (const [key, item] of mine) {
        const survived: number = theirs.get(key)?.lines.length ?? 0;
        if (survived < item.lines.length) {
            missing.push({ kind: "missing", item: item.kind, label: item.label, lines: item.lines });
        }
    }

    const introduced: PreservationFinding[] = [];
    for (const [key, item] of theirs) {
        if (!mine.has(key) && !grounded.has(key)) {
            introduced.push({ kind: "introduced", item: item.kind, label: item.label, lines: item.lines });
        }
    }

    return [...missing.sort(byKindThenLabel), ...introduced.sort(byKindThenLabel)];
}

/** How many tracked items one copy carries, for the read-out a passing run prints. */
export function trackedTotal(content: string): number {
    const scan: Scan = extractTracked(content);
    let total: number = scan.items.length;
    const vocabulary: Set<string> = properNounVocabulary(scan);
    for (const word of scan.capitalised as CapitalisedWord[]) {
        if (vocabulary.has(word.word)) {
            total++;
        }
    }
    return total;
}
