/**
 * The razor's provenance labels, as the one piece of machinery that reads them (epic #284,
 * story #285).
 *
 * A label is drafting-time content: it exists so the author, the epic gate and the approval digest
 * all see which items the lead asked for and which the model added. None of them is the durable
 * reader of a filed issue, so the label has to be gone by the time a body is filed. "Remember to
 * strip them" is an instruction a model can drop, which is why stripping and the assertion that
 * nothing survived are the same tested pair rather than a habit.
 */

/** One surviving drafting-time token in a body that was supposed to be clean. */
export interface Finding {
    /** 1-indexed line of the body the token was found on. */
    line: number;
    /** The token as written, so the message names the thing to delete. */
    token: string;
}

/**
 * The label grammar. Two values and nothing else (§1 of the skill): `[inferred]`, or `[asked: "…"]`
 * carrying the quoted fragment. Surrounding backticks are optional — a draft renders more cleanly
 * with them and the checker must not care — and any trailing space the removal leaves behind goes
 * with it, so a stripped line ends where its prose ends.
 */
const LABEL: RegExp = /[ \t]*`?\[(?:inferred|asked:[ \t]*"[^"]*")\][ \t]*`?/g;

/** Derive a filing body: the draft with every provenance label removed and nothing else changed. */
export function stripLabels(draft: string): string {
    return draft
        .split("\n")
        .map((line: string) => line.replace(LABEL, " ").replace(/[ \t]+$/, "").replace(/[ \t]{2,}/g, " "))
        .join("\n");
}

/**
 * Assertion mode: every provenance label still present in a body, in reading order. An empty result
 * is the only thing that permits filing.
 */
export function survivingLabels(body: string): Finding[] {
    const findings: Finding[] = [];
    body.split("\n").forEach((line: string, index: number) => {
        for (const match of line.matchAll(LABEL)) {
            findings.push({ line: index + 1, token: match[0].trim() });
        }
    });
    return findings;
}
