/**
 * The tracked-item reader (story #423): what must survive a translation, read by form alone.
 *
 * The region check (story #417) proves the pipeline still parses the file. It says nothing about
 * whether the prose still carries the same facts, so a translator with write access can drop a
 * number, weaken a `must` to a `should` or lose a named entity and still pass. This module reads
 * the items whose survival is the faithfulness claim, so a later comparison can count them.
 *
 * Every class here is defined by **form, never by meaning**. That is the whole reason the check is
 * safe to run against a rewrite: a form-based class never touches an ordinary lower-case word, so
 * the translator's "prefer common words" rule stays free by construction, and the check never has
 * an opinion about how a sentence is worded.
 *
 * Machine-read regions are another check's territory. Their bytes are already compared, so this
 * reader skips every line `extractRegions` claims — one defect is reported once, by one check.
 */

import { extractRegions, type Region } from "./regions.js";

/** The classes of item whose survival this check proves. */
export type TrackedKind = "numeric" | "modal" | "name" | "heading" | "list-item" | "table-row";

/** One occurrence of a tracked item. Equal `key`s are the same item, wherever they stand. */
export interface TrackedItem {
    kind: TrackedKind;
    /** The canonical identity, `<kind>:<value>`. Counting is over this and nothing else. */
    key: string;
    /** The item as the reader should see it named in a finding. */
    label: string;
    /** 1-indexed line the occurrence stood on. */
    line: number;
}

/** One capitalised ordinary word, kept apart because the proper-noun tier is decided in two steps. */
export interface CapitalisedWord {
    /** Lower-cased, so the same name at two positions is the same word. */
    word: string;
    line: number;
    /** Whether the word opened a sentence, which is what disqualifies it from the tier. */
    sentenceInitial: boolean;
}

/** Everything one copy yields: the settled items, and the raw material for the proper-noun tier. */
export interface Scan {
    items: TrackedItem[];
    capitalised: CapitalisedWord[];
}

/**
 * The modal verbs, as a closed list. "May", "should" and "must" are distinct claims, so the check
 * counts them separately and counts a negated modal as its own item — weakening "must not" to
 * "must" is a change of strength, not a change of wording.
 */
const MODALS: readonly string[] = ["may", "might", "must", "shall", "should", "will", "would", "can", "could", "ought"];

/** The contracted negations, mapped to the modal they negate. */
const CONTRACTED_NEGATIONS: Readonly<Record<string, string>> = {
    cannot: "can",
    "can't": "can",
    "won't": "will",
    "shan't": "shall",
    "shouldn't": "should",
    "wouldn't": "would",
    "couldn't": "could",
    "mightn't": "might",
    "mustn't": "must",
    "oughtn't": "ought",
    "mayn't": "may",
};

/**
 * The spelled-out numbers, so a numeral rewritten as a word is the same value.
 *
 * "One", "zero" and "a" are deliberately absent. English uses them as a pronoun, a determiner and
 * an article as readily as it uses them as counts ("one can go stale"), and a form-based reader
 * cannot tell those apart. Tracking them would fail an honest rewrite, which is worse than missing
 * the rare deliberate "1" that becomes "one".
 *
 * The exclusion is symmetric: `UNTRACKED_VALUES` drops the numerals too. Dropping only the words
 * would fail the same rewrite in both directions — a numeral one spelled out would read as a lost
 * value, and the word written back as a numeral would read as an invented one.
 */
const WORD_NUMBERS: Readonly<Record<string, number>> = {
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,
};

/** The scale words a spelled-out number may carry. */
const SCALE_WORDS: Readonly<Record<string, number>> = { hundred: 100, thousand: 1000 };

/**
 * The values that sit outside the tracked numeric class whatever their written form, suffix
 * included. They are the values whose word forms English also uses as article, determiner and
 * pronoun, so neither form can be counted without failing an honest rewrite.
 */
const UNTRACKED_VALUES: ReadonlySet<number> = new Set([0, 1]);

/** Whether a numeric denotation is one the check refuses to track. */
function isUntrackedValue(value: string): boolean {
    return UNTRACKED_VALUES.has(Number(value));
}

/**
 * The closed list of English function words the proper-noun tier refuses. A capitalised word on
 * this list opened a clause or a title; it never names anything.
 */
const FUNCTION_WORDS: ReadonlySet<string> = new Set([
    "a", "about", "after", "all", "also", "an", "and", "any", "are", "as", "at", "back", "be",
    "because", "been", "before", "being", "both", "but", "by", "did", "do", "does", "during",
    "each", "either", "else", "every", "for", "from", "further", "given", "had", "has", "have",
    "he", "her", "here", "hers", "him", "his", "how", "however", "i", "if", "in", "into", "is",
    "it", "its", "me", "more", "most", "my", "neither", "never", "no", "none", "nor", "not", "now",
    "of", "on", "once", "one", "only", "or", "other", "our", "out", "over", "per", "rather", "she",
    "since", "so", "some", "such", "than", "that", "the", "their", "them", "then", "there",
    "these", "they", "this", "those", "through", "to", "too", "under", "unless", "until", "up",
    "us", "was", "we", "were", "what", "when", "where", "whether", "which", "while", "who", "whom",
    "whose", "why", "with", "within", "without", "yet", "you", "your", "zero",
]);

/**
 * The mark the scanner writes over a claimed span. It is not whitespace and it is not sentence
 * punctuation, so a claimed span never opens a sentence for the word that follows it, and it is not
 * a letter or a digit, so it never survives an atom trim.
 */
const CLAIMED = "·";

const INLINE_CODE_RE = /`([^`\n]+)`/g;
const QUOTED_RE = /"[^"\n]{1,200}"|“[^”\n]{1,200}”/g;
const HEADING_RE = /^ {0,3}(#{1,6})\s/;
const LIST_ITEM_RE = /^(\s*)([-*+]|\d+[.)])(\s+)/;
const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;
const REFERENCE_RE = /^(?:[A-Za-z][\w.-]*(?:\/[\w.-]+)*)?#\d+$/;
const FLAG_RE = /^--?[A-Za-z][\w-]*$/;
const NUMERAL_RE = /^(\d[\d,]*(?:\.\d+)?)(%|[A-Za-z]{1,4})?$/;
const EXTENSION_RE = /^[A-Za-z][\w-]*(?:\.[A-Za-z][\w-]*)+$/;
const INTERNAL_CAPS_RE = /[a-z0-9][A-Z]/;
const WORD_RE = /^[A-Za-z][A-Za-z'-]*$/;
const ATOM_RE = /[^\s·]+/g;
const TRIM_LEAD_RE = /^[^\p{L}\p{N}#\-/_]+/u;
const TRIM_TAIL_RE = /[^\p{L}\p{N}%/_']+$/u;

/** One candidate word of a line, with the position facts the classifier needs. */
interface Atom {
    text: string;
    sentenceInitial: boolean;
}

/** Blank out every span of `pattern`, keeping the text's length so later positions still hold. */
function claim(text: string, pattern: RegExp, onClaim: (match: string) => void): string {
    return text.replace(pattern, (match: string): string => {
        onClaim(match);
        return CLAIMED.repeat(match.length);
    });
}

/** Whether the atom starting at `start` opens a sentence. A claimed span never opens one. */
function opensSentence(text: string, start: number): boolean {
    for (let index = start - 1; index >= 0; index--) {
        const character: string = text[index];
        if (character === " " || character === "\t") {
            continue;
        }
        return character === "." || character === "!" || character === "?";
    }
    return true;
}

/** The atom's text with the surrounding punctuation removed, or "" when nothing is left. */
function trimAtom(raw: string): string {
    return raw.replace(TRIM_LEAD_RE, "").replace(TRIM_TAIL_RE, "");
}

/** The candidate atoms of one line of prose, in order. */
function atomsOf(text: string): Atom[] {
    const atoms: Atom[] = [];
    ATOM_RE.lastIndex = 0;
    let match: RegExpExecArray | null = ATOM_RE.exec(text);
    while (match !== null) {
        const trimmed: string = trimAtom(match[0]);
        if (trimmed !== "") {
            atoms.push({ text: trimmed, sentenceInitial: opensSentence(text, match.index) });
        }
        match = ATOM_RE.exec(text);
    }
    return atoms;
}

/** The value of a spelled-out number, hyphenated compounds included, or undefined. */
function wordNumber(atom: string): number | undefined {
    const parts: string[] = atom.toLowerCase().split("-");
    let total = 0;
    for (const part of parts) {
        const value: number | undefined = WORD_NUMBERS[part];
        if (value === undefined) {
            return undefined;
        }
        total += value;
    }
    return total;
}

/** The lower-cased atom at `index`, or "" past the end. */
function at(atoms: readonly Atom[], index: number): string {
    return atoms[index]?.text.toLowerCase() ?? "";
}

/**
 * The percentage suffix a number carries, written against the numeral or as the following word or
 * word pair, plus how many atoms that suffix consumed.
 */
function percentSuffix(atoms: readonly Atom[], index: number): { suffix: string; consumed: number } {
    if (at(atoms, index + 1) === "percent") {
        return { suffix: "%", consumed: 1 };
    }
    if (at(atoms, index + 1) === "per" && at(atoms, index + 2) === "cent") {
        return { suffix: "%", consumed: 2 };
    }
    return { suffix: "", consumed: 0 };
}

/** One item, keyed. */
function item(kind: TrackedKind, value: string, label: string, line: number): TrackedItem {
    return { kind, key: `${kind}:${value}`, label, line };
}

/** The structural item a line's shape declares, or undefined when the line carries none. */
function structureOf(raw: string, line: number): { found: TrackedItem; stripped: string } | undefined {
    const heading: RegExpMatchArray | null = raw.match(HEADING_RE);
    if (heading !== null) {
        const level = `h${heading[1].length}`;
        return {
            found: item("heading", level, `a level-${heading[1].length} heading`, line),
            stripped: " ".repeat(heading[0].length) + raw.slice(heading[0].length),
        };
    }
    if (TABLE_ROW_RE.test(raw)) {
        return { found: item("table-row", "", "a table row", line), stripped: raw.replace(/\|/g, " ") };
    }
    const list: RegExpMatchArray | null = raw.match(LIST_ITEM_RE);
    if (list !== null) {
        return {
            found: item("list-item", "", "a list item", line),
            stripped: " ".repeat(list[0].length) + raw.slice(list[0].length),
        };
    }
    return undefined;
}

/** The tier-one name-shaped classification of an atom, or undefined when it is not one. */
function tierOneName(atom: string): boolean {
    if (REFERENCE_RE.test(atom) || FLAG_RE.test(atom)) {
        return true;
    }
    if (atom.includes("/") && /[A-Za-z]/.test(atom)) {
        return true;
    }
    if (NUMERAL_RE.test(atom)) {
        return false;
    }
    if (EXTENSION_RE.test(atom) || atom.includes("_") || INTERNAL_CAPS_RE.test(atom)) {
        return true;
    }
    return /[A-Za-z]/.test(atom) && /\d/.test(atom);
}

/** The lines every machine-read region occupies, which this reader leaves to the region check. */
function regionLines(content: string): Set<number> {
    const covered: Set<number> = new Set<number>();
    for (const region of extractRegions(content) as Region[]) {
        for (let offset = 0; offset < region.lines.length; offset++) {
            covered.add(region.line + offset);
        }
    }
    return covered;
}

/**
 * Read every tracked item of `content`, plus the capitalised ordinary words the proper-noun tier
 * is built from. Position is never part of an item's identity, which is what lets a translator
 * split a sentence or repeat a noun in place of a pronoun without the check noticing.
 */
export function extractTracked(content: string): Scan {
    const covered: Set<number> = regionLines(content);
    const lines: string[] = content.replace(/’/g, "'").split("\n");
    if (lines.length > 0 && lines[lines.length - 1] === "") {
        lines.pop();
    }
    const items: TrackedItem[] = [];
    const capitalised: CapitalisedWord[] = [];

    for (let index = 0; index < lines.length; index++) {
        const line: number = index + 1;
        if (covered.has(line)) {
            continue;
        }
        let text: string = lines[index];
        const structure = structureOf(text, line);
        if (structure !== undefined) {
            items.push(structure.found);
            text = structure.stripped;
        }
        text = claim(text, INLINE_CODE_RE, (match: string) => {
            items.push(item("name", match.slice(1, -1), match.slice(1, -1), line));
        });
        text = claim(text, QUOTED_RE, (match: string) => {
            items.push(item("name", match, match, line));
        });

        const atoms: Atom[] = atomsOf(text);
        let skip = 0;
        for (let position = 0; position < atoms.length; position++) {
            if (skip > 0) {
                skip--;
                continue;
            }
            const atom: string = atoms[position].text;
            const lowered: string = atom.toLowerCase();

            if (tierOneName(atom)) {
                items.push(item("name", atom, atom, line));
                continue;
            }

            const numeral: RegExpMatchArray | null = atom.match(NUMERAL_RE);
            if (numeral !== null) {
                const value: string = numeral[1].replace(/,/g, "");
                const attached: string = numeral[2] ?? "";
                const following = attached === "" ? percentSuffix(atoms, position) : { suffix: "", consumed: 0 };
                skip = following.consumed;
                const suffix: string = attached === "" ? following.suffix : attached;
                if (!isUntrackedValue(value)) {
                    items.push(item("numeric", `${value}${suffix}`, `${value}${suffix}`, line));
                }
                continue;
            }

            const negated: string | undefined = CONTRACTED_NEGATIONS[lowered];
            if (negated !== undefined) {
                items.push(item("modal", `${negated} not`, `${negated} not`, line));
                continue;
            }
            if (MODALS.includes(lowered)) {
                const isNegated: boolean = at(atoms, position + 1) === "not";
                skip = isNegated ? 1 : 0;
                const value = isNegated ? `${lowered} not` : lowered;
                items.push(item("modal", value, value, line));
                continue;
            }

            const spelled: number | undefined = wordNumber(atom);
            if (spelled !== undefined) {
                const scale: number | undefined = SCALE_WORDS[at(atoms, position + 1)];
                const value: number = scale === undefined ? spelled : spelled * scale;
                const following = percentSuffix(atoms, position + (scale === undefined ? 0 : 1));
                skip = (scale === undefined ? 0 : 1) + following.consumed;
                items.push(item("numeric", `${value}${following.suffix}`, `${value}${following.suffix}`, line));
                continue;
            }

            if (WORD_RE.test(atom) && /^[A-Z]/.test(atom) && !FUNCTION_WORDS.has(lowered)) {
                capitalised.push({ word: lowered, line, sentenceInitial: atoms[position].sentenceInitial });
            }
        }
    }

    return { items, capitalised };
}

/**
 * The proper-noun tier, taken from the pre-translation copy alone: capitalised words that are not
 * sentence-initial and are not English function words. Membership is decided here; counting then
 * happens at every position in both copies, which is what keeps sentence splitting and a name
 * moved to the start of a sentence invisible to the check.
 */
export function properNounVocabulary(scan: Scan): Set<string> {
    const vocabulary: Set<string> = new Set<string>();
    for (const word of scan.capitalised) {
        if (!word.sentenceInitial) {
            vocabulary.add(word.word);
        }
    }
    return vocabulary;
}
