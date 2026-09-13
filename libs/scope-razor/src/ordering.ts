/**
 * The draft-level ordering block (epic #576, story #577).
 *
 * Ordering used to be assigned after approval, which meant that at the moment the reviewer decided,
 * there was nothing to show them about what a story waits on and nothing to check the approved set
 * against. The graph therefore moves into the draft, keyed on story titles — the only stable name a
 * story has before its issue number exists. A positional key would shift exactly when the story set
 * is re-scoped at the gate, which is the one moment anything relies on it.
 *
 * Everything here is a name match plus a walk over that graph. Nothing here is a judgment, and
 * nothing here survives filing: after the issues exist, the platform's own dependency edges are the
 * authoritative graph and this block is derived away with the provenance labels.
 */

import { normalize } from "./citations.js";
import { stripLabels } from "./labels.js";

/** The heading the block is written under. Its normative statement is §7a of the `nxs-razor` skill. */
export const ORDERING_HEADING: string = "## Implementation Order";

/** One story's place in the draft-time graph, by title. */
export interface OrderingEntry {
    /** The story title, as written in the block. */
    title: string;
    /** The titles it waits on — empty when the block says `none`. */
    blockedBy: string[];
}

/** A story in a chosen set that waits on a story the set leaves out. */
export interface UnmetBlocker {
    story: string;
    blocker: string;
}

/** `### Story 1: <title>` and `### Story #577: <title>` alike — the number is not part of the name. */
const STORY_HEADING: RegExp = /^###[ \t]+Story[ \t]+#?\d+[ \t]*:[ \t]*(.+?)[ \t]*$/;

/** `- **<title>** — blocked by: <title>; <title>` — an em dash or a hyphen, `none` for no blockers. */
const ORDERING_ROW: RegExp = /^-[ \t]+\*\*(.+?)\*\*[ \t]*[—–-][ \t]*blocked by:[ \t]*(.*)$/i;

/** The heading the necessity answer (§7) is written under. */
export const NECESSITY_HEADING: string = "## Smallest Usable Version";

/**
 * The stories the necessity answer names, or `undefined` when the draft carries no such section.
 *
 * The two are different states and the checker treats them differently: an absent section raises
 * nothing at all, because the record and discovery stages share this checker and never write one.
 * An empty one is an answer that names no story, and it is still not a finding — the razor admits no
 * minimum-count rule anywhere.
 */
export function smallestUsableVersion(draft: string): string[] | undefined {
    const lines: string[] = draft.split("\n");
    const start: number = lines.findIndex((line: string) => line.trim() === NECESSITY_HEADING);
    if (start === -1) return undefined;

    const named: string[] = [];
    for (const line of lines.slice(start + 1)) {
        if (/^#{1,3} /.test(line)) break;
        const text: string = stripLabels(line).trim();
        if (text === "") continue;
        named.push(...text.split(";").map((name: string) => name.trim().replace(/^[-*][ \t]*/, "").replace(/\*\*/g, "").trim()));
    }
    return named.filter((name: string) => name !== "");
}

/** Every story the draft declares, in reading order, with any provenance label stripped off. */
export function storyTitles(draft: string): string[] {
    return draft
        .split("\n")
        .map((line: string) => stripLabels(line).match(STORY_HEADING))
        .filter((match: RegExpMatchArray | null): match is RegExpMatchArray => match !== null)
        .map((match: RegExpMatchArray) => match[1].trim());
}

/** The ordering block's rows, in written order. A draft that carries no block yields nothing. */
export function parseOrdering(draft: string): OrderingEntry[] {
    const lines: string[] = draft.split("\n");
    const start: number = lines.findIndex((line: string) => line.trim() === ORDERING_HEADING);
    if (start === -1) return [];

    const entries: OrderingEntry[] = [];
    for (const line of lines.slice(start + 1)) {
        if (/^#{1,2} /.test(line)) break;
        const row: RegExpMatchArray | null = stripLabels(line).match(ORDERING_ROW);
        if (row === null) continue;
        const blockers: string = row[2].trim();
        entries.push({
            title: row[1].trim(),
            blockedBy: /^none$/i.test(blockers)
                ? []
                : blockers
                      .split(";")
                      .map((name: string) => name.trim())
                      .filter((name: string) => name !== ""),
        });
    }
    return entries;
}

/**
 * The order the stories unlock in: a story appears after everything it waits on, and two stories
 * that wait on nothing of each other's keep the order they were written in. This is the one order
 * the offer list follows — it costs no judgment, where ranking additions by value would have the
 * drafting model scoring its own additions.
 *
 * A cycle cannot be ordered, but dropping a story from the render would hide scope the reviewer is
 * deciding on, so the remainder is emitted in written order and the cycle is reported as a finding
 * by the caller that checks the graph.
 */
export function orderedByUnlock(entries: OrderingEntry[]): string[] {
    const remaining: OrderingEntry[] = [...entries];
    const placed: string[] = [];
    const done = (title: string): boolean => placed.some((seen: string) => normalize(seen) === normalize(title));
    const known = (title: string): boolean => entries.some((entry: OrderingEntry) => normalize(entry.title) === normalize(title));

    while (remaining.length > 0) {
        const ready: OrderingEntry[] = remaining.filter((entry: OrderingEntry) =>
            entry.blockedBy.every((blocker: string) => done(blocker) || !known(blocker)),
        );
        if (ready.length === 0) {
            placed.push(...remaining.map((entry: OrderingEntry) => entry.title));
            break;
        }
        placed.push(...ready.map((entry: OrderingEntry) => entry.title));
        remaining.splice(0, remaining.length, ...remaining.filter((entry: OrderingEntry) => !ready.includes(entry)));
    }
    return placed;
}

/**
 * Every blocker a chosen set of stories waits on but does not contain — the closure rule, as the
 * pairs a finding needs to name both ends of. Matching is the citation check's normalization, so a
 * re-typed title with different spacing or case is the same story rather than a missing one.
 */
export function unmetBlockers(entries: OrderingEntry[], chosen: string[]): UnmetBlocker[] {
    const inSet = (title: string): boolean => chosen.some((name: string) => normalize(name) === normalize(title));
    return entries
        .filter((entry: OrderingEntry) => inSet(entry.title))
        .flatMap((entry: OrderingEntry) =>
            entry.blockedBy
                .filter((blocker: string) => !inSet(blocker))
                .map((blocker: string) => ({ story: entry.title, blocker })),
        );
}
