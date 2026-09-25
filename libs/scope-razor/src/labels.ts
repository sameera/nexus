/**
 * The razor's drafting-time tokens, as the one piece of machinery that reads them (epic #284,
 * stories #285 and #424).
 *
 * Three kinds of token exist only while a draft is being written: the provenance label, the
 * placeholder a template ships so its slots are visible, and the marker a gate render puts beside
 * an advisory observation. (The ordering block, a declared asset path and a record field written as
 * `none` joined them later, each documented where it is matched.) Each serves the author, the gate or the digest; none of them is the
 * durable reader of a filed issue, so all three have to be gone by the time a body is filed.
 * "Remember to strip them" is an instruction a model can drop, which is why stripping and the
 * assertion that nothing survived are the same tested pair rather than a habit.
 *
 * Only the label is *derived away* — stripping it leaves a correct sentence behind. A surviving
 * placeholder is an unanswered question and a surviving observation marker is a verdict that was
 * never a body's to carry, so both are reported for a human to resolve rather than deleted.
 */

/** Which drafting-time vocabulary a surviving token belongs to. */
export type TokenKind = "label" | "placeholder" | "observation" | "ordering" | "asset-path" | "none-field";

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

/**
 * The draft-level ordering block (epic #576): its heading, and the rows under it. It is a fourth
 * drafting-time vocabulary — after filing, the platform's native dependency edges are the
 * authoritative graph, so a copy in a body would be a second and never-updated statement of it.
 * Both the heading and a row are matched, because a hand-edit that removes only the heading leaves
 * the graph behind in the body just the same.
 */
const ORDERING: RegExp = /^(?:##[ \t]+Implementation Order[ \t]*|-[ \t]+\*\*.+?\*\*[ \t]*[\u2014\u2013-][ \t]*blocked by:.*)$/gi;

/**
 * A field written as `none` (epic #787, story #789, D6): a `- **Name:** none` bullet. A record's
 * draft writes every optional field of a decision entry, and writes `none` where it has nothing to
 * say, so an omitted trade-off cannot pass for a stated absence. The value exists for the
 * checkpoint's checks and not for a reader of the filed body, so derive removes the line. Only the
 * whole value `none` matches, in any case and with an optional period: prose that uses the word, or
 * a value that starts with it, is content.
 */
const NONE_FIELD: RegExp = /^[ \t]*-[ \t]+\*\*[^*\n]+?:\*\*[ \t]*none\.?[ \t]*$/gi;

const GRAMMARS: ReadonlyArray<{ kind: TokenKind; pattern: RegExp }> = [
    { kind: "label", pattern: LABEL },
    { kind: "placeholder", pattern: PLACEHOLDER },
    { kind: "observation", pattern: OBSERVATION },
    { kind: "ordering", pattern: ORDERING },
    { kind: "none-field", pattern: NONE_FIELD },
];

/** A declared path as a whole token: not preceded or followed by another path character. */
function wholePath(declared: string): RegExp {
    const escaped: string = declared.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![A-Za-z0-9_./~-])${escaped}(?![A-Za-z0-9_./-])`);
}

/** Derive a filing body: the draft with every provenance label removed and nothing else changed. */
export function stripLabels(draft: string): string {
    return draft
        .split("\n")
        .map((line: string) => line.replace(LABEL, " ").replace(/[ \t]+$/, "").replace(/[ \t]{2,}/g, " "))
        .join("\n");
}

/**
 * Derive the body that is filed: the draft with every provenance label removed, every field written
 * as `none` removed, and the draft-level ordering block removed whole, and nothing else changed. The
 * three go together because they are the same kind of thing — bookkeeping the author, the gate and
 * the digest read, and no durable reader of a filed issue ever does.
 */
export function deriveFilingBody(draft: string): string {
    const lines: string[] = stripLabels(draft)
        .split("\n")
        .filter((line: string) => !new RegExp(NONE_FIELD.source, "i").test(line));
    const start: number = lines.findIndex((line: string) => /^##[ \t]+Implementation Order[ \t]*$/i.test(line));
    if (start === -1) return lines.join("\n");
    let end: number = lines.findIndex((line: string, index: number) => index > start && /^#{1,2} /.test(line));
    if (end === -1) end = lines.length;
    lines.splice(start, end - start);
    return lines.join("\n");
}

/**
 * Assertion mode: every drafting-time token still present in a body, in reading order. An empty
 * result is the only thing that permits filing.
 */
export function survivingTokens(body: string, assetPaths: readonly string[] = []): Finding[] {
    const findings: Finding[] = [];
    body.split("\n").forEach((line: string, index: number) => {
        const onLine: Finding[] = [];
        for (const grammar of GRAMMARS) {
            for (const match of line.matchAll(grammar.pattern)) {
                onLine.push({ line: index + 1, kind: grammar.kind, token: match[0].trim() });
            }
        }
        // A local asset path this run declared (epic #594): matched exactly, never syntactically,
        // because a body legitimately quotes repository-relative paths in its own prose — and as a
        // whole token, because the published address of `assets/flow.png` under a feature named
        // `issue-assets` ends in `issue-assets/flow.png`.
        for (const assetPath of assetPaths) {
            if (assetPath !== "" && wholePath(assetPath).test(line)) onLine.push({ line: index + 1, kind: "asset-path", token: assetPath });
        }
        findings.push(...onLine.sort((a: Finding, b: Finding) => line.indexOf(a.token) - line.indexOf(b.token)));
    });
    return findings;
}
