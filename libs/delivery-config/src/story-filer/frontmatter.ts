/**
 * What a `STORY-*.md` work item says (story #367).
 *
 * The reader is deliberately the shallow, line-oriented one the Python filer has always used
 * (decision record #375) rather than a general-purpose document parser: its observable behaviour
 * includes things a real parser does not do — one layer of surrounding quotes trimmed from either
 * end, a bracket list split on commas with no escaping, no type coercion — and work items already
 * sitting in scratch folders were authored against exactly those. Re-interpreting them would change
 * what a declared value resolves to, silently, in a filing path.
 */

/** A declared value: raw text, or the bracket-list form read as a list. */
export type FrontmatterValue = string | string[];

export interface ParsedDocument {
    frontmatter: Record<string, FrontmatterValue>;
    body: string;
}

/** Strip every leading and trailing occurrence of `chars` — the trimming the reader has always done. */
function trimChars(value: string, chars: string): string {
    let start = 0;
    let end: number = value.length;
    while (start < end && chars.includes(value[start])) start++;
    while (end > start && chars.includes(value[end - 1])) end--;
    return value.slice(start, end);
}

/**
 * Split off a leading `---` frontmatter block.
 *
 * A document that does not open with the separator, or that never closes the block, carries no
 * frontmatter and is its own body verbatim — an unterminated block is never half-read.
 */
export function parseFrontmatter(content: string): ParsedDocument {
    if (!content.startsWith("---")) return { frontmatter: {}, body: content };
    const closing: number = content.indexOf("---", 3);
    if (closing === -1) return { frontmatter: {}, body: content };

    const frontmatter: Record<string, FrontmatterValue> = {};
    for (const line of content.slice(3, closing).trim().split("\n")) {
        const at: number = line.indexOf(":");
        if (at === -1) continue;
        const key: string = line.slice(0, at).trim();
        const value: string = line.slice(at + 1).trim();
        if (value.startsWith("[") && value.endsWith("]")) {
            frontmatter[key] = value
                .slice(1, -1)
                .split(",")
                .map((item) => trimChars(trimChars(item.trim(), '"'), "'"))
                .filter((item) => item !== "");
        } else {
            frontmatter[key] = trimChars(trimChars(value, '"'), "'");
        }
    }
    return { frontmatter, body: content.slice(closing + 3).trim() };
}

/**
 * The lookup form of a story ref: the `STORY-` prefix dropped, case ignored.
 *
 * The ref is an authoring key with the lifetime of one filing batch — it lets a work item name a
 * sibling before any issue number exists — so it has to compare equal however an author spelled it.
 */
export function normalizeRef(ref: string): string {
    let value: string = ref.trim();
    if (value.startsWith("STORY-")) value = value.slice("STORY-".length);
    if (value.startsWith("story-")) value = value.slice("story-".length);
    return value.trim().toLowerCase();
}

/** A declared value read as a list, with a bare string read as a one-item list. */
export function asList(value: FrontmatterValue | undefined): string[] {
    if (value === undefined) return [];
    if (Array.isArray(value)) return value;
    return value === "" ? [] : [value];
}

/** A declared value read as text — a list-valued key reads as its first item. */
export function asText(value: FrontmatterValue | undefined): string {
    if (value === undefined) return "";
    return Array.isArray(value) ? (value[0] ?? "") : value;
}

export interface WorkItem {
    /** The file's own name, which is how the run reports it. */
    fileName: string;
    /** The absolute path it was read from. */
    filePath: string;
    /** The normalized authoring ref — declared, or the filename stem. */
    ref: string;
    title: string;
    labels: string[];
    /** The normalized refs this item is blocked by, with `none` and empties dropped. */
    blockedBy: string[];
    parent: string;
    project: string;
    /** The content after the frontmatter block — the body GitHub is handed. */
    body: string;
    frontmatter: Record<string, FrontmatterValue>;
}

/** The filename with its final extension dropped — the ref an item that declares none falls back to. */
export function fileStem(fileName: string): string {
    const at: number = fileName.lastIndexOf(".");
    return at <= 0 ? fileName : fileName.slice(0, at);
}

/** Read one work item's declared shape out of its file content. */
export function readWorkItem(fileName: string, content: string, filePath: string = fileName): WorkItem {
    const { frontmatter, body }: ParsedDocument = parseFrontmatter(content);
    const declaredRef: string = asText(frontmatter["ref"]);
    // A `blocked_by` written as a bare `none` is the same statement as an absent key.
    const rawBlockers: string[] = asList(frontmatter["blocked_by"]).filter(
        (entry) => entry.trim().toLowerCase() !== "none",
    );
    return {
        fileName,
        filePath,
        ref: normalizeRef(declaredRef !== "" ? declaredRef : fileStem(fileName)),
        title: asText(frontmatter["title"]),
        labels: asList(frontmatter["labels"]),
        blockedBy: rawBlockers.map(normalizeRef).filter((ref) => ref !== "" && ref !== "none"),
        parent: asText(frontmatter["parent"]),
        project: asText(frontmatter["project"]),
        body,
        frontmatter,
    };
}
