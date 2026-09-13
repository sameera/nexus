/**
 * The offer list (epic #576, story #579).
 *
 * The approval gate used to file everything drafted unless the reviewer removed something. Removing
 * was cheap, but accepting was cheaper — one keystroke against reading a numbered list — so a
 * reviewer who was tired or merely trusting shipped scope nobody asked for. The default decides what
 * actually happens, so the default inverts: the gate files the smallest usable version, and
 * everything else is offered.
 *
 * What is offered is ordered by the draft-time dependency graph and by nothing else. Ranking the
 * additions by predicted value would have the drafting model scoring its own additions, which the
 * razor forbids elsewhere for exactly the reason it would matter here — the author is the party
 * motivated to rank its own additions persuasively.
 */

import { normalize } from "./citations.js";
import { orderedByUnlock, parseOrdering, smallestUsableVersion, storyTitles, type OrderingEntry } from "./ordering.js";
import { stripLabels } from "./labels.js";

/** The two-valued vocabulary, at the granularity that now decides what is filed. */
export type Provenance = "asked" | "inferred";

/** One story's own provenance claim, read off its heading. */
export interface StoryProvenance {
    title: string;
    provenance: Provenance;
    /** The quoted fragment an `asked` claim rests on — rendered verbatim beside the story it justifies. */
    fragment: string | undefined;
}

/** One story the gate offers the reviewer, as the render and the selection both see it. */
export interface OfferItem extends StoryProvenance {
    /** Its stable number in the rendered list, from one. */
    number: number;
    /** The stories it waits on — taking it means taking these too. */
    blockedBy: string[];
}

const STORY_LABEL: RegExp = /`?\[(?:(inferred)|asked:[ \t]*"([^"]*)")\]`?/;

/**
 * Each story's provenance claim, in reading order. A story with no label is a third state the
 * vocabulary denies; the checker blocks it, so this reads an unlabelled heading as `inferred` rather
 * than inventing a value — the conservative reading, since an unlabelled story is never filed by
 * default.
 */
export function storyProvenance(draft: string): StoryProvenance[] {
    const headings: string[] = draft.split("\n").filter((line: string) => /^###[ \t]+Story[ \t]+#?\d+[ \t]*:/.test(line));
    return headings.map((heading: string) => {
        const label: RegExpMatchArray | null = heading.match(STORY_LABEL);
        return {
            title: storyTitles(heading)[0] ?? stripLabels(heading).trim(),
            provenance: label !== null && label[1] === undefined ? "asked" : "inferred",
            fragment: label?.[2],
        };
    });
}

/**
 * Every story the smallest usable version excludes, as the gate offers them: the stories the lead
 * asked for first — cutting one of those away by inaction is something the reviewer has to be able
 * to see — then the ones the drafting model added, each group in the order the graph unlocks them.
 *
 * A draft whose necessity answer needs every story offers nothing, and the gate has only the plain
 * approval to ask for.
 */
export function offerList(draft: string): OfferItem[] {
    const needed: string[] = smallestUsableVersion(draft) ?? [];
    const entries: OrderingEntry[] = parseOrdering(draft);
    const order: string[] = orderedByUnlock(entries);
    const claims: StoryProvenance[] = storyProvenance(draft);

    const rank = (title: string): number => {
        const at: number = order.findIndex((name: string) => normalize(name) === normalize(title));
        return at === -1 ? order.length : at;
    };
    const blockersOf = (title: string): string[] =>
        entries.find((entry: OrderingEntry) => normalize(entry.title) === normalize(title))?.blockedBy ?? [];

    return claims
        .filter((claim: StoryProvenance) => !needed.some((name: string) => normalize(name) === normalize(claim.title)))
        .sort((a: StoryProvenance, b: StoryProvenance) => {
            if (a.provenance !== b.provenance) return a.provenance === "asked" ? -1 : 1;
            return rank(a.title) - rank(b.title);
        })
        .map((claim: StoryProvenance, index: number) => ({ ...claim, number: index + 1, blockedBy: blockersOf(claim.title) }));
}
