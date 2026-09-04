/**
 * The razor's drafting-time tokens, as the one piece of machinery that reads them (epic #284,
 * stories #285 and #424).
 *
 * Three kinds of token exist only while a draft is being written: the provenance label, the
 * placeholder a template ships so its slots are visible, and the marker a gate render puts beside
 * an advisory observation. Each serves the author, the gate or the digest; none of them is the
 * durable reader of a filed issue, so all three have to be gone by the time a body is filed.
 * "Remember to strip them" is an instruction a model can drop, which is why stripping and the
 * assertion that nothing survived are the same tested pair rather than a habit.
 *
 * Only the label is *derived away* — stripping it leaves a correct sentence behind. A surviving
 * placeholder is an unanswered question and a surviving observation marker is a verdict that was
 * never a body's to carry, so both are reported for a human to resolve rather than deleted.
 */

/** Which drafting-time vocabulary a surviving token belongs to. */
export type TokenKind = "label" | "placeholder" | "observation";

/** One surviving drafting-time token in a body that was supposed to be clean. */
export interface Finding {
    /** 1-indexed line of the body the token was found on. */
    line: number;
    kind: TokenKind;
    /** The token as written, so the message names the thing to remove. */
    token: string;
}

/**
 * The label grammar. Two values and nothing else (§1 of the skill): `[inferred]`, or `[asked: "…"]`
 * carrying the quoted fragment. Surrounding backticks are optional — a draft renders more cleanly
 * with them and the checker must not care — and any trailing space the removal leaves behind goes
 * with it, so a stripped line ends where its prose ends.
 */
const LABEL: RegExp = /[ \t]*`?\[(?:inferred|asked:[ \t]*"[^"]*")\][ \t]*`?/g;

/**
 * The template placeholder grammar (§4): a `{{…}}` token, the form every Nexus template marks its
 * slots with. `${…}` is deliberately not matched — a command's shell snippet is prose a body may
 * legitimately quote.
 */
const PLACEHOLDER: RegExp = /\{\{[^{}\n]*\}\}/g;

/**
 * The razor's observation marker (§4): the sentinel every advisory render prefixes its observation
 * with. It is a distinct token rather than a bare warning emoji because a filed body may carry a
 * warning callout of its own — the epic's utilization-risk banner is one — and banning that would
 * ban the body's own content along with the marker.
 */
const OBSERVATION: RegExp = /⚠️[ \t]*razor:/g;

const GRAMMARS: ReadonlyArray<{ kind: TokenKind; pattern: RegExp }> = [
    { kind: "label", pattern: LABEL },
    { kind: "placeholder", pattern: PLACEHOLDER },
    { kind: "observation", pattern: OBSERVATION },
];

/** Derive a filing body: the draft with every provenance label removed and nothing else changed. */
export function stripLabels(draft: string): string {
    return draft
        .split("\n")
        .map((line: string) => line.replace(LABEL, " ").replace(/[ \t]+$/, "").replace(/[ \t]{2,}/g, " "))
        .join("\n");
}

/**
 * Assertion mode: every drafting-time token still present in a body, in reading order. An empty
 * result is the only thing that permits filing.
 */
export function survivingTokens(body: string): Finding[] {
    const findings: Finding[] = [];
    body.split("\n").forEach((line: string, index: number) => {
        const onLine: Finding[] = [];
        for (const grammar of GRAMMARS) {
            for (const match of line.matchAll(grammar.pattern)) {
                onLine.push({ line: index + 1, kind: grammar.kind, token: match[0].trim() });
            }
        }
        findings.push(...onLine.sort((a: Finding, b: Finding) => line.indexOf(a.token) - line.indexOf(b.token)));
    });
    return findings;
}
