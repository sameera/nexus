/**
 * Copied text made inert (epic #830, story #865, decision record #872, D8; G18).
 *
 * Close copies text other people wrote into the surfaces it writes: an answer's reason, a decision
 * stub's choice and reason, a deferred-scope proposal's summary, and the record's own decision
 * text. Distill's range reader takes the first close-record marker in a close record before it
 * looks at the frontmatter, so a reason carrying that marker and a fenced range would forge the
 * range distill diffs. Refusing such text would stop an unattended close on any reason that quotes
 * code, so the text is neutralised instead:
 *
 * - every HTML comment opener and closer is escaped, so no marker survives — the close-record
 *   marker, the verdict markers, or any other;
 * - every run of three or more backticks or tildes is broken up, so no fence opens or closes;
 * - in {@link inertText}, line breaks become spaces, so nothing copied can start a line: no
 *   heading, no frontmatter delimiter, no list item of its own.
 *
 * Frontmatter values are never copied text; close writes them only from values it computes. #866
 * uses these same functions for the stub bodies it files.
 */

/** A zero-width space: breaks a backtick or tilde run without changing what a reader sees. */
const BREAK = "\u200b";

function defuse(s: string): string {
    return s
        .replace(/<!--/g, "&lt;!--")
        .replace(/--!?>/g, (m) => m.replace(">", "&gt;"))
        .replace(/`{3,}|~{3,}/g, (run) => run.split("").join(BREAK));
}

/** `s` as one inert line: no marker, no fence, no line break. */
export function inertText(s: string): string {
    return defuse(s.replace(/\r\n?|\n|\u2028|\u2029/g, " "))
        .replace(/[ \t]+/g, " ")
        .trim();
}

/** `s` as inert lines, each kept: no marker and no fence, for text quoted whole. */
export function inertLines(s: string): string[] {
    return s
        .replace(/\r\n?/g, "\n")
        .split(/\n|\u2028|\u2029/)
        .map((line) => defuse(line).replace(/[ \t]+$/, ""));
}
