/**
 * The machine-read regions of a human-facing artifact (story #417, decision record #421).
 *
 * A translator with write access to a drafted artifact is a real hazard, because the file carries
 * regions the pipeline parses — frontmatter, fenced blocks, HTML comment blocks and the
 * acceptance-criteria keyword lines — and a change inside one of them fails silently and late. The
 * defence is a comparison, not an instruction, and a comparison needs both copies cut into the
 * same regions by the same reader. This module is that reader.
 *
 * It is deliberately syntactic. It says where the parsed regions are; it says nothing about
 * whether the prose around them is faithful.
 */

/** The kinds of region the pipeline parses and the translator must leave alone. */
export type RegionKind = "frontmatter" | "fenced-block" | "html-comment" | "criteria-line";

/** One machine-read region, with the lines exactly as the file carries them. */
export interface Region {
    kind: RegionKind;
    /** 1-indexed line the region starts on. */
    line: number;
    /** The region's lines, delimiters included, with no trailing newline. */
    lines: readonly string[];
}

/** A fence line: three or more backticks or tildes, and whatever follows the run. */
const FENCE_RE = /^([`~]{3,})(.*)$/;

/** The emphasised acceptance-criteria keywords, as the artifact templates write them. */
const EMPHASISED_KEYWORD_RE = /\*\*(given|when|then)\*\*/i;

/** The three keywords as standalone words, for a criteria line written without emphasis. */
const BARE_KEYWORD_RES: readonly RegExp[] = [/\bgiven\b/i, /\bwhen\b/i, /\bthen\b/i];

interface Fence {
    /** The run character, so a tilde fence never closes a backtick one. */
    char: string;
    length: number;
}

/** The fence a line opens or closes, or undefined when the line is not a fence line. */
function fenceOf(raw: string): Fence | undefined {
    const match: RegExpMatchArray | null = raw.trim().match(FENCE_RE);
    if (match === null) {
        return undefined;
    }
    return { char: match[1][0], length: match[1].length };
}

/** Whether a fence line closes an open fence: same character, at least as long, nothing trailing. */
function closes(raw: string, open: Fence): boolean {
    const match: RegExpMatchArray | null = raw.trim().match(FENCE_RE);
    if (match === null) {
        return false;
    }
    return match[1][0] === open.char && match[1].length >= open.length && match[2].trim() === "";
}

/** Whether a line outside every other region is an acceptance-criteria line. */
function isCriteriaLine(raw: string): boolean {
    if (EMPHASISED_KEYWORD_RE.test(raw)) {
        return true;
    }
    return BARE_KEYWORD_RES.every((keyword: RegExp) => keyword.test(raw));
}

/** The end line of the frontmatter block, or undefined when the body opens none. */
function frontmatterEnd(lines: readonly string[]): number | undefined {
    if (lines.length === 0 || lines[0].trim() !== "---") {
        return undefined;
    }
    for (let index = 1; index < lines.length; index++) {
        if (lines[index].trim() === "---") {
            return index;
        }
    }
    // An unclosed delimiter opens no block: a body is not frontmatter because it starts with a rule.
    return undefined;
}

/**
 * Every machine-read region of `content`, in document order. Regions never overlap: a criteria
 * line inside a fenced block or inside frontmatter belongs to the enclosing region alone.
 */
export function extractRegions(content: string): Region[] {
    const lines: string[] = content.split("\n");
    // A trailing newline ends the last line; it does not begin an empty one.
    if (lines.length > 0 && lines[lines.length - 1] === "") {
        lines.pop();
    }
    const regions: Region[] = [];
    let index = 0;

    const end: number | undefined = frontmatterEnd(lines);
    if (end !== undefined) {
        regions.push({ kind: "frontmatter", line: 1, lines: lines.slice(0, end + 1) });
        index = end + 1;
    }

    while (index < lines.length) {
        const raw: string = lines[index];
        const fence: Fence | undefined = fenceOf(raw);
        if (fence !== undefined) {
            let close: number = lines.length - 1;
            for (let scan = index + 1; scan < lines.length; scan++) {
                if (closes(lines[scan], fence)) {
                    close = scan;
                    break;
                }
            }
            regions.push({ kind: "fenced-block", line: index + 1, lines: lines.slice(index, close + 1) });
            index = close + 1;
            continue;
        }
        if (raw.includes("<!--")) {
            let close: number = lines.length - 1;
            for (let scan = index; scan < lines.length; scan++) {
                if (lines[scan].includes("-->")) {
                    close = scan;
                    break;
                }
            }
            regions.push({ kind: "html-comment", line: index + 1, lines: lines.slice(index, close + 1) });
            index = close + 1;
            continue;
        }
        if (isCriteriaLine(raw)) {
            regions.push({ kind: "criteria-line", line: index + 1, lines: [raw] });
        }
        index++;
    }

    return regions;
}
