/**
 * The epic filer's own output vocabulary (stories #378 and #385).
 *
 * This capability is emoji-led and colour-coded, and it writes its warnings to stdout — a different
 * vocabulary from the story filer's, and one Invariant 19 freezes wording, emoji and stream for.
 * Colour is the epic's second ratified divergence: the Python filer emits the escape sequences
 * unconditionally, so a redirected run captures them in the file; here they are emitted only when
 * output is going to an attached terminal, answered by the same interactivity check the
 * confirmation prompt already needs.
 */

import { type ToolkitIo } from "../io.js";

export const RED = "\u001b[0;31m";
export const GREEN = "\u001b[0;32m";
export const YELLOW = "\u001b[1;33m";
export const NO_COLOR = "\u001b[0m";

export interface EpicOutput {
    /** A refusal: the cross, red, on stderr. */
    error: (message: string) => void;
    /** A completed run worth announcing: the tick, green, on stdout. */
    success: (message: string) => void;
    /** Something the lead should see that does not fail the run: the warning sign, yellow, stdout. */
    warn: (message: string) => void;
    /** An ordinary progress line, uncoloured, on stdout. */
    line: (message: string) => void;
}

export function epicOutput(io: ToolkitIo, colour: boolean): EpicOutput {
    const paint = (code: string, text: string): string => (colour ? `${code}${text}${NO_COLOR}` : text);
    return {
        error: (message: string) => io.stderr(paint(RED, `❌ ${message}`)),
        success: (message: string) => io.stdout(paint(GREEN, `✅ ${message}`)),
        warn: (message: string) => io.stdout(paint(YELLOW, `⚠️  ${message}`)),
        line: (message: string) => io.stdout(message),
    };
}
