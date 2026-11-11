/**
 * The collapsed planning-context block an initiative body may carry (epic #1011, decision record #1016).
 *
 * The block's text is digest-checked: a reader compares it with the digest recorded at filing, so a
 * single changed character makes the context unreadable for planning. Every pass that rewrites an
 * issue body (the story filer's ref rewrite, the stub-number rewrite) must leave the block as filed,
 * and must find it by the same rule the reader uses. Those passes live on either side of this
 * library, so the markers and that rule live here, below both.
 */

import { escapeRegExp } from "@nexus/workspace/regexp";

/** The line that opens the collapsed context. */
export const CONTEXT_BEGIN: string = "<!-- nexus:context-begin -->";
/** The line that closes the collapsed context. */
export const CONTEXT_END: string = "<!-- nexus:context-end -->";
/** Any trace of either marker, garbled or not. Kept beside the markers so a change to one reaches the other. */
export const CONTEXT_MARKER_TRACE: RegExp = /<!--\s*nexus:context-(?:begin|end)\b/;

/** Where the block sits in a body. */
export interface ContextBlockBounds {
    /** Where the opening marker starts. */
    start: number;
    /** Where the context text starts, after the opening marker's line break. */
    innerStart: number;
    /** Where the context text ends: the line break before the closing marker. */
    innerEnd: number;
    /** Just past the closing marker. */
    stop: number;
}

/** Any line break: CRLF, LF or a bare CR, the same set the reader normalizes. */
const BREAK: string = "(?:\\r\\n|\\r|\\n)";
/** The opening marker on a line of its own: at the start of the body or after a line break. */
const BEGIN_LINE: RegExp = new RegExp(`(?<![^\\r\\n])${escapeRegExp(CONTEXT_BEGIN)}${BREAK}`);

/** How long the line break ending just before `at` is: 2 for CRLF, 1 for LF or a bare CR, else 0. */
function breakBefore(body: string, at: number): number {
    if (body[at - 1] === "\n") return body[at - 2] === "\r" ? 2 : 1;
    return body[at - 1] === "\r" ? 1 : 0;
}

/**
 * Find the block: from the first opening marker on a line of its own to the last closing marker
 * that opens a line after it. A body with no such pair has no block.
 */
export function contextBlockBounds(body: string): ContextBlockBounds | null {
    const open: RegExpExecArray | null = BEGIN_LINE.exec(body);
    if (open === null) return null;
    // Scan back for the last closing marker that opens its own line.
    let at: number = body.lastIndexOf(CONTEXT_END);
    while (at > open.index && breakBefore(body, at) === 0) at = body.lastIndexOf(CONTEXT_END, at - 1);
    if (at <= open.index) return null;
    const innerStart: number = open.index + open[0].length;
    return { start: open.index, innerStart, innerEnd: Math.max(at - breakBefore(body, at), innerStart), stop: at + CONTEXT_END.length };
}

/**
 * Apply `edit` to the parts of `body` outside the collapsed context, and keep the block itself,
 * markers included, exactly as it is. A body with no block is edited whole.
 */
export function editOutsideContext(body: string, edit: (text: string) => string): string {
    const block: ContextBlockBounds | null = contextBlockBounds(body);
    if (block === null) return edit(body);
    return edit(body.slice(0, block.start)) + body.slice(block.start, block.stop) + edit(body.slice(block.stop));
}
