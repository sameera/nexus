/**
 * The epic draft in, the filed body out (story #379).
 *
 * The reader here is the epic filer's own and reproduces the Python reader's rules exactly — the
 * fenced-block match, the split on the first separator, one layer of quote trimming, no type
 * coercion, an untrimmed body. The story filer's reader is a *different* shallow parser, and the
 * differences are observable in the filed body — most clearly for a draft with no frontmatter,
 * where nothing downstream re-normalises the tail. Byte-identity is the metric this epic is judged
 * on, so the two readers stay separate until both filers have a golden corpus to prove a
 * unification changed nothing (decision record #387).
 *
 * The derivation is three transforms in a fixed order (Invariant 4), asserted whole rather than
 * one at a time: every transform is individually easy, and the composition is where the bytes move.
 */

/** The fenced frontmatter block at the head of a draft, and the raw text inside it. */
const FRONTMATTER = /^---\s*\n([\s\S]*?)\n---\s*\n/;

/** A queue-path reference — committed-transient, so it rots wherever it appears. */
const QUEUE_REF = /\.nexus\/queue\//;

/** A pointer preamble line, which only counts before the epic's own title. */
const POINTER = /^\s*\**\s*(Feature|Queue entry|Full epic)\b/i;

export interface ParsedDraft {
    frontmatter: Record<string, string>;
    body: string;
}

/** Strip every leading and trailing occurrence of `chars`. */
function trimChars(value: string, chars: string): string {
    let start = 0;
    let end: number = value.length;
    while (start < end && chars.includes(value[start])) start++;
    while (end > start && chars.includes(value[end - 1])) end--;
    return value.slice(start, end);
}

/**
 * Split off a leading frontmatter block.
 *
 * A draft with no block is its own body verbatim — untrimmed, because trimming would change the
 * bytes filed for exactly the draft that has nothing else normalising them.
 */
export function parseDraft(content: string): ParsedDraft {
    const match: RegExpExecArray | null = FRONTMATTER.exec(content);
    if (match === null) return { frontmatter: {}, body: content };

    const frontmatter: Record<string, string> = {};
    for (const line of match[1].split("\n")) {
        const at: number = line.indexOf(":");
        if (at === -1) continue;
        const key: string = line.slice(0, at).trim();
        if (key === "") continue;
        frontmatter[key] = trimChars(line.slice(at + 1).trim(), "\"'");
    }
    return { frontmatter, body: content.slice(match[0].length) };
}

/** The draft's raw frontmatter text, or the empty string when it carries none. */
export function rawFrontmatter(content: string): string {
    return FRONTMATTER.exec(content)?.[1] ?? "";
}

/**
 * Drop the pointers that bake a transient location into a durable issue.
 *
 * A queue path is never durable wherever it appears — the distiller drains the entry the issue
 * would point at. A pointer preamble line is only preamble *before* the epic's title; a line of the
 * same shape after it is the epic's own prose and stays.
 */
export function stripNonDurableRefs(body: string): string {
    const lines: string[] = body.split("\n");
    const firstH1: number = lines.findIndex((line) => line.trimStart().startsWith("# "));
    const titleAt: number = firstH1 === -1 ? lines.length : firstH1;
    const kept: string[] = lines.filter((line, index) => {
        if (QUEUE_REF.test(line)) return false;
        return !(index < titleAt && POINTER.test(line));
    });
    return kept.join("\n").replace(/^\n+/, "");
}

/**
 * Drop the `## User Stories` section.
 *
 * Each story is filed as its own sub-issue, which is the durable working surface for its text;
 * repeating the bodies here would duplicate them and let the copies drift. Only a level-2 heading
 * terminates the section — the level-3 and level-4 subsections inside it are part of it.
 */
export function stripStoryBodies(body: string): string {
    const lines: string[] = body.split("\n");
    const start: number = lines.findIndex((line) => /^##\s+User Stories\s*$/.test(line));
    if (start === -1) return body;
    let end: number = lines.length;
    for (let j = start + 1; j < lines.length; j++) {
        if (/^##\s/.test(lines[j])) {
            end = j;
            break;
        }
    }
    return trimChars([...lines.slice(0, start), ...lines.slice(end)].join("\n"), "\n") + "\n";
}

/**
 * Append the machine block carrying the draft's raw frontmatter verbatim.
 *
 * It is an HTML comment, so it never renders in the issue, and the resolver lifts the frontmatter
 * back out of it — which is what makes an epic re-resolvable from its number alone. A draft with no
 * frontmatter gets no block (Invariant 5).
 */
export function appendEpicMeta(body: string, raw: string): string {
    if (raw.trim() === "") return body;
    return `${body.replace(/\n+$/, "")}\n\n<!-- nexus:epic-meta\n${raw}\n-->\n`;
}

/** The filed body: the three transforms, in order, over the draft's own content. */
export function deriveFiledBody(content: string): string {
    const { body }: ParsedDraft = parseDraft(content);
    return appendEpicMeta(stripStoryBodies(stripNonDurableRefs(body)), rawFrontmatter(content));
}
