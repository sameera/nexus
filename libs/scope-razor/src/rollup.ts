/**
 * The size rollup and the design warrant it decides (epic #576, story #580).
 *
 * The epic's `complexity` is a bottom-up rollup of its story sizes (0009), and the needs-design
 * label follows from that one value. Both are therefore properties of the story set, and the story
 * set is settled at the approval gate rather than when the draft was written — so an epic whose
 * filed set differs from its drafted one carries a rollup nothing has re-derived, and a design
 * warrant that follows from a number about stories that were never filed.
 *
 * Re-derivation used to be an instruction in the gate's prose, which is the failure mode the closure
 * rule was moved into the checker to end. What is mechanically decidable about the rollup lives
 * here: a story's own size, the floor the filed set forces, and the warrant a recorded rollup
 * implies. What is not — how far cross-story integration raises the rollup above that floor — stays
 * a judgment, and the rule is that the judgment is stated in `complexity_drivers` rather than
 * assumed.
 *
 * Nothing here builds a finding: the checker owns that vocabulary, and importing it back would make
 * a cycle out of two modules that each know one thing.
 */

import { normalize } from "./citations.js";
import { stripLabels } from "./labels.js";

/** The size ladder, smallest first. A story is sized S or M (0009); an epic rolls up past both. */
export type Size = "S" | "M" | "L" | "XL";

const LADDER: readonly Size[] = ["S", "M", "L", "XL"];

/** `### Story 1: <title>` and `### Story #577: <title>` alike — the number is not part of the name. */
const STORY_HEADING: RegExp = /^###[ \t]+Story[ \t]+#?\d+[ \t]*:[ \t]*(.+?)[ \t]*$/;

/** `- **size:** M`, as each story states its own. */
const SIZE_ROW: RegExp = /^-[ \t]+\*\*size:\*\*[ \t]*(S|M|L|XL)[ \t]*$/i;

/** One story's stated size, or `undefined` where the story states none. */
export interface StorySize {
    title: string;
    size: Size | undefined;
}

function frontmatter(draft: string): string[] {
    const lines: string[] = draft.split("\n");
    if (lines[0]?.trim() !== "---") return [];
    const end: number = lines.findIndex((line: string, index: number) => index > 0 && line.trim() === "---");
    return end === -1 ? [] : lines.slice(1, end);
}

/** Every story the draft declares, in reading order, with the size it states for itself. */
export function storySizes(draft: string): StorySize[] {
    const sizes: StorySize[] = [];
    let open: StorySize | undefined;
    for (const line of draft.split("\n")) {
        const heading: RegExpMatchArray | null = stripLabels(line).match(STORY_HEADING);
        if (heading !== null) {
            open = { title: heading[1].trim(), size: undefined };
            sizes.push(open);
            continue;
        }
        const size: RegExpMatchArray | null = line.match(SIZE_ROW);
        if (size !== null && open !== undefined && open.size === undefined) open.size = size[1].toUpperCase() as Size;
    }
    return sizes;
}

/** The epic's recorded rollup, or `undefined` for a draft that records none. */
export function recordedComplexity(draft: string): Size | undefined {
    const row: string | undefined = frontmatter(draft).find((line: string) => /^complexity:/.test(line));
    const value: RegExpMatchArray | null = row?.match(/^complexity:[ \t]*"?(S|M|L|XL)"?/i) ?? null;
    return value === null ? undefined : (value[1].toUpperCase() as Size);
}

/** The drivers the recorded rollup rests on. An epic that states none states no reason to exceed the floor. */
export function complexityDrivers(draft: string): string[] {
    const row: string | undefined = frontmatter(draft).find((line: string) => /^complexity_drivers:/.test(line));
    const list: RegExpMatchArray | null = row?.match(/^complexity_drivers:[ \t]*\[(.*)\][ \t]*$/) ?? null;
    if (list === null) return [];
    return list[1]
        .split(",")
        .map((driver: string) => driver.trim().replace(/^"(.*)"$/, "$1").trim())
        .filter((driver: string) => driver !== "");
}

/**
 * The smallest rollup the filed story set forces: the largest size among the stories actually
 * filed. An epic cannot roll up below its own biggest story, whatever the count or the integration
 * between them says. A filed set in which no story states a size forces nothing, and the caller
 * asserts nothing from it.
 */
export function rollupFloor(sizes: StorySize[], chosen: string[]): Size | undefined {
    const inSet = (title: string): boolean => chosen.some((name: string) => normalize(name) === normalize(title));
    const filed: Size[] = sizes.filter((story: StorySize) => inSet(story.title) && story.size !== undefined).map((story: StorySize) => story.size as Size);
    if (filed.length === 0) return undefined;
    return filed.reduce((largest: Size, size: Size) => (LADDER.indexOf(size) > LADDER.indexOf(largest) ? size : largest));
}

/** Whether a rollup warrants a decision record: M or larger carries it, and an absent rollup errs toward carrying it (#139). */
export function designWarrant(complexity: Size | undefined): boolean {
    return complexity === undefined || LADDER.indexOf(complexity) >= LADDER.indexOf("M");
}

/** `a` against `b` on the ladder, as a comparator sign. */
export function compareSize(a: Size, b: Size): number {
    return LADDER.indexOf(a) - LADDER.indexOf(b);
}
