/**
 * The gate's checklist (epic #576, story #579).
 *
 * The approval gate used to file everything drafted unless the reviewer removed something. Removing
 * was cheap, but accepting was cheaper — one keystroke against reading a numbered list — so a
 * reviewer who was tired or merely trusting shipped scope nobody asked for. The default decides what
 * actually happens, so the default inverts: the gate files the smallest usable version, and
 * everything else is offered.
 *
 * What the gate renders is that default, already ticked. One list holds every story, every
 * model-added criterion on a story the default files, and every boundary, and the reviewer names
 * only what they want flipped — so the set they read is the set that gets filed, rather than a
 * default they have to reconstruct out of several groups that each mean something different.
 *
 * The order is the draft-time dependency graph's and nothing else. Ranking the offered stories by
 * predicted value would have the drafting model scoring its own additions, which the razor forbids
 * elsewhere for exactly the reason it would matter here — the author is the party motivated to rank
 * its own additions persuasively.
 */

import { normalize } from "./citations.js";
import { bullets, criteria, itemText, readClaim, sections, type Claim, type Section } from "./document.js";
import { orderedByUnlock, parseOrdering, smallestUsableVersion, storyTitles, type OrderingEntry } from "./ordering.js";
import { stripLabels } from "./labels.js";

/** The two-valued vocabulary, at the granularity that now decides what is filed. */
export type Provenance = "asked" | "inferred";

/** Which part of the draft a checklist line came from. */
export type ChecklistKind = "story" | "criterion" | "assumption" | "out-of-scope";

/**
 * One line of the gate's checklist. `filed` is the tick the reviewer is shown: the default this item
 * arrives at the gate with, so a reviewer who types nothing gets exactly the ticked set.
 */
export interface ChecklistItem {
    /** Its stable number in the rendered list, from one, across every kind. */
    number: number;
    kind: ChecklistKind;
    /** Ticked means a plain approval files it. Untick to drop it; tick an unticked one to add it. */
    filed: boolean;
    /** A story's title, or the item's own text with its provenance label stripped off. */
    text: string;
    provenance: Provenance;
    /** The quoted fragment an `asked` claim rests on, rendered verbatim beside the item it justifies. */
    fragment: string | undefined;
    /** Stories only: the size the draft declares, when it declares one. */
    size: string | undefined;
    /** Stories only: what taking it also takes. */
    blockedBy: string[];
    /** Criteria only: the story the criterion belongs to. */
    parent: string | undefined;
}

/** A story as the checklist needs it: its claim, its size, its graph row and its own criteria. */
interface StoryRow {
    title: string;
    provenance: Provenance;
    fragment: string | undefined;
    size: string | undefined;
    blockedBy: string[];
    /** The model-added criteria only — an asked-for one is the story's own definition. */
    inferredCriteria: string[];
}

const STORY_SECTION: RegExp = /^Story[ \t]+#?\d+[ \t]*:/;
const SIZE_ROW: RegExp = /^-[ \t]+\*\*size:\*\*[ \t]*(.+)$/i;

/**
 * Every story the draft declares, in reading order. A story with no label is a third state the
 * vocabulary denies; the checker blocks it, so an unlabelled heading reads as `inferred` rather than
 * inventing a value — the conservative reading, since an unlabelled story is not filed by default.
 */
function storyRows(draft: string): StoryRow[] {
    const entries: OrderingEntry[] = parseOrdering(draft);
    return sections(draft, "###")
        .filter((section: Section) => STORY_SECTION.test(section.heading))
        .map((section: Section) => {
            const claim: Claim = readClaim(section.heading);
            const title: string = storyTitles(`### ${section.heading}`)[0] ?? stripLabels(section.heading).trim();
            const size: RegExpMatchArray | undefined = section.lines
                .map((line: string) => stripLabels(line).trim().match(SIZE_ROW))
                .find((match: RegExpMatchArray | null): match is RegExpMatchArray => match !== null);
            return {
                title,
                provenance: claim.provenance,
                fragment: claim.fragment,
                size: size?.[1].trim(),
                blockedBy: entries.find((entry: OrderingEntry) => normalize(entry.title) === normalize(title))?.blockedBy ?? [],
                inferredCriteria: criteria(section.lines).filter((line: string) => readClaim(line).provenance === "inferred"),
            };
        });
}

const BOUNDARY_SECTIONS: ReadonlyArray<[string, ChecklistKind]> = [
    ["Assumptions", "assumption"],
    ["Out of Scope", "out-of-scope"],
];

/**
 * The gate's checklist: every story, every model-added criterion on a story the default files, and
 * every boundary — one numbered sequence, each line carrying the tick it arrives with.
 *
 * The stories the smallest usable version needs come first and ticked, then the stories it excludes:
 * asked-for before model-added, so a claim on the lead's own authority is never buried under the
 * drafting model's inventions, and each band in the order the graph unlocks it.
 *
 * Criteria are listed for the stories the default files and no others. A criterion is a statement
 * about a story rather than scope that can stand alone, so one belonging to a story the reviewer has
 * not taken has nothing to be ticked against; it arrives with its story if they take it.
 *
 * A boundary is listed whatever its provenance, and ticked. Neither an assumption nor an
 * out-of-scope item adds scope — together they are the edge the smallest usable version was drawn
 * inside — so the reviewer is shown the boundary they are approving rather than only the part of it
 * the drafting model supplied.
 */
export function checklist(draft: string): ChecklistItem[] {
    const needed: string[] = smallestUsableVersion(draft) ?? [];
    const order: string[] = orderedByUnlock(parseOrdering(draft));
    const rows: StoryRow[] = storyRows(draft);

    const rank = (title: string): number => {
        const at: number = order.findIndex((name: string) => normalize(name) === normalize(title));
        return at === -1 ? order.length : at;
    };
    const inSuv = (title: string): boolean => needed.some((name: string) => normalize(name) === normalize(title));
    const band = (row: StoryRow): number => (inSuv(row.title) ? 0 : row.provenance === "asked" ? 1 : 2);
    const stories: StoryRow[] = [...rows].sort((a: StoryRow, b: StoryRow) => band(a) - band(b) || rank(a.title) - rank(b.title));

    const items: Array<Omit<ChecklistItem, "number">> = stories.map((row: StoryRow) => ({
        kind: "story" as const,
        filed: inSuv(row.title),
        text: row.title,
        provenance: row.provenance,
        fragment: row.fragment,
        size: row.size,
        blockedBy: row.blockedBy,
        parent: undefined,
    }));

    for (const row of stories.filter((candidate: StoryRow) => inSuv(candidate.title))) {
        for (const line of row.inferredCriteria) {
            items.push({ kind: "criterion", filed: true, text: itemText(line), provenance: "inferred", fragment: undefined, size: undefined, blockedBy: [], parent: row.title });
        }
    }

    for (const [heading, kind] of BOUNDARY_SECTIONS) {
        const section: Section | undefined = sections(draft, "##").find((candidate: Section) => candidate.heading.replace(/\s*<!--.*$/, "").trim() === heading);
        for (const line of bullets(section?.lines ?? [])) {
            const claim: Claim = readClaim(line);
            items.push({ kind, filed: true, text: itemText(line), provenance: claim.provenance, fragment: claim.fragment, size: undefined, blockedBy: [], parent: undefined });
        }
    }

    return items.map((item: Omit<ChecklistItem, "number">, index: number) => ({ ...item, number: index + 1 }));
}
