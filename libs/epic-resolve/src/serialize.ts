/**
 * The deterministic epic serializer — pure, no fs, no `gh`.
 *
 * Reconstructs the `epic.md` field shape from the fetched issue graph so downstream parsers are
 * unchanged. Determinism (Invariant 3) is structural: stories are ordered by ascending issue
 * number (never GitHub's return order), the `## Implementation Sequence` is rebuilt from the live
 * `blocked_by` edges (never a stale table baked into the issue body), and no volatile field
 * (timestamp, run id) is ever emitted — so the same graph always serializes to byte-identical text.
 *
 * Frontmatter comes from the epic issue's embedded meta block when present (Story 2) — the raw
 * planning frontmatter carried through verbatim, with `link` reset to the issue number — so the
 * full field shape round-trips. A bare issue with no meta block (e.g. hand-filed) falls back to the
 * recoverable-only fields (`epic` title + `link`); nothing is ever fabricated.
 */

import { withLink } from "./meta.js";

export interface EpicHeader {
    number: number;
    title: string;
    body: string;
    /** Raw planning frontmatter lifted from the issue's meta block, or null when there is none. */
    rawFrontmatter?: string | null;
}

export interface EpicStory {
    number: number;
    title: string;
    body: string;
}

export interface SerializeInput {
    epic: EpicHeader;
    /** Stories in any order — the serializer sorts them canonically. */
    stories: EpicStory[];
    /** story issue number → the issue numbers it is blocked_by. */
    blockedBy: Map<number, number[]>;
}

/** H2 section titles that the rebuilt `## User Stories` block is inserted before. */
const STORY_ANCHOR_TITLES = new Set(["Assumptions", "Out of Scope", "Open Questions"]);

/** Section titles the serializer always rebuilds itself, so any inherited copy is dropped. */
const REBUILT_TITLES = new Set(["User Stories", "Implementation Sequence"]);

interface Section {
    title: string;
    text: string;
}

/** Strip leading and trailing blank lines from a block without touching its interior. */
function trimBlock(s: string): string {
    return s.replace(/^(?:[ \t]*\n)+/, "").replace(/\s+$/, "");
}

/**
 * Split a markdown body into a preamble (before the first H2) and its H2 sections, ignoring `## `
 * lines inside fenced code blocks so a fenced example never masquerades as a section boundary.
 */
function splitH2(body: string): { preamble: string; sections: Section[] } {
    const lines = body.split("\n");
    const preambleLines: string[] = [];
    const sections: Section[] = [];
    let current: { title: string; lines: string[] } | null = null;
    let fence: string | null = null;

    for (const line of lines) {
        const fenceMatch = /^(\s*)(`{3,}|~{3,})/.exec(line);
        if (fenceMatch) {
            const marker = fenceMatch[2][0];
            if (fence === null) fence = marker;
            else if (fence === marker) fence = null;
        }
        const heading = fence === null ? /^##[ \t]+(.+?)[ \t]*$/.exec(line) : null;
        if (heading) {
            if (current) sections.push({ title: current.title, text: current.lines.join("\n") });
            current = { title: heading[1], lines: [line] };
        } else if (current) {
            current.lines.push(line);
        } else {
            preambleLines.push(line);
        }
    }
    if (current) sections.push({ title: current.title, text: current.lines.join("\n") });
    return { preamble: preambleLines.join("\n"), sections };
}

/**
 * The frontmatter block. When the issue carried a meta block, round-trip its raw planning
 * frontmatter verbatim (only `link` reset to the issue number). Otherwise emit the recoverable-only
 * fields — never fabricating the ones the filing skills strip.
 */
function renderFrontmatter(epic: EpicHeader): string {
    if (epic.rawFrontmatter != null && epic.rawFrontmatter.trim().length > 0) {
        return ["---", withLink(epic.rawFrontmatter, epic.number), "---"].join("\n");
    }
    return ["---", `epic: ${JSON.stringify(epic.title)}`, `link: "#${epic.number}"`, "---"].join("\n");
}

/** `STORY-<epic>.<seq>` — zero-padded to two digits, matching the pipeline's story-ref shape. */
function storyRef(epicNumber: number, seq: number): string {
    return `STORY-${epicNumber}.${String(seq).padStart(2, "0")}`;
}

function renderUserStories(stories: EpicStory[]): string {
    const parts: string[] = ["## User Stories"];
    stories.forEach((story, index) => {
        const heading = `### Story ${index + 1}: ${story.title}`;
        const body = trimBlock(story.body);
        parts.push(body.length > 0 ? `${heading}\n\n${body}` : heading);
    });
    return parts.join("\n\n");
}

function renderSequence(epicNumber: number, stories: EpicStory[], blockedBy: Map<number, number[]>): string {
    const refByNumber = new Map<number, string>();
    stories.forEach((story, index) => refByNumber.set(story.number, storyRef(epicNumber, index + 1)));

    const rows = stories.map((story, index) => {
        const blockers = [...(blockedBy.get(story.number) ?? [])].sort((a, b) => a - b);
        const cell =
            blockers.length === 0
                ? "none"
                : blockers.map((n) => refByNumber.get(n) ?? `#${n}`).join(", ");
        return `| ${storyRef(epicNumber, index + 1)} | #${story.number} | ${cell} |`;
    });

    return ["## Implementation Sequence", "", "| STORY | Issue | blocked_by |", "|---|---|---|", ...rows].join("\n");
}

/** Reconstruct the `epic.md` markdown for one resolved epic. Deterministic over its input. */
export function serializeEpic(input: SerializeInput): string {
    const stories = [...input.stories].sort((a, b) => a.number - b.number);
    const { preamble, sections } = splitH2(input.epic.body);
    const carried = sections.filter((s) => !REBUILT_TITLES.has(s.title));

    const frontmatter = renderFrontmatter(input.epic);
    const userStories = renderUserStories(stories);

    const blocks: string[] = [frontmatter];
    const trimmedPreamble = trimBlock(preamble);
    if (trimmedPreamble.length > 0) blocks.push(trimmedPreamble);

    let inserted = false;
    for (const section of carried) {
        if (!inserted && STORY_ANCHOR_TITLES.has(section.title)) {
            blocks.push(userStories);
            inserted = true;
        }
        blocks.push(trimBlock(section.text));
    }
    if (!inserted) blocks.push(userStories);

    blocks.push(renderSequence(input.epic.number, stories, input.blockedBy));

    return blocks.join("\n\n") + "\n";
}
