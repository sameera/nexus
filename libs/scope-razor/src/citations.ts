/**
 * The citation half of the razor (epic #284, stories #285 and #287): whether an item labelled
 * `asked` is actually traceable to the text the lead handed the run.
 *
 * The comparison is deliberately slack in one direction and hard in the other. Normalization
 * forgives the typographic drift a model introduces just by re-typing a quote, because a check that
 * blocks on a curly apostrophe teaches the lead to reword until the gate relents — an enforced rule
 * turned into a negotiated one. The word floor is the counterweight: without it, citing one common
 * word would satisfy the rule for every item and the citation would mean nothing.
 *
 * There is no fuzzy or semantic comparison here. It would catch the real gaming case — a true quote
 * that does not license the item attached to it — but it reintroduces the judgment this check
 * exists to remove and makes the verdict irreproducible run to run. What is proved is that the
 * quote exists, and a reviewer reading the fragment is what decides the rest.
 */

/** A fragment shorter than this fails as if it were absent. */
export const MINIMUM_FRAGMENT_WORDS: number = 4;

/** One `asked` label read out of a draft. */
export interface Citation {
    /** 1-indexed line the label was written on. */
    line: number;
    /** The quoted fragment, as written. */
    fragment: string;
    /** The item text the label is attached to, so a finding can name what fails. */
    item: string;
}

const ASKED: RegExp = /`?\[asked:[ \t]*"([^"]*)"\][ \t]*`?/g;

/** Fold the two texts into the one form they are compared in. */
export function normalize(text: string): string {
    return text
        .replace(/[‘’]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/[–—]/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

/** Whether a quoted fragment is long enough to mean anything and present in the source text. */
export function citationHolds(fragment: string, sourceText: string): boolean {
    const wanted: string = normalize(fragment);
    if (wanted === "" || wanted.split(" ").length < MINIMUM_FRAGMENT_WORDS) return false;
    return normalize(sourceText).includes(wanted);
}

/** Every `asked` label in a draft, in reading order. */
export function citations(draft: string): Citation[] {
    const found: Citation[] = [];
    draft.split("\n").forEach((line: string, index: number) => {
        for (const match of line.matchAll(ASKED)) {
            found.push({ line: index + 1, fragment: match[1], item: line.replace(ASKED, "").trim() });
        }
    });
    return found;
}
