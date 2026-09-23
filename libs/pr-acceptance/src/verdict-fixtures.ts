/**
 * The live pull request that exposed the ranking defect, encoded as the payload `gh pr view`
 * returns for it (epic #747, decision record #750, key decision "Reproduction is discharged by
 * pinning the live payload").
 *
 * The defect was that a close reported the *older* of two verdicts on one pull request, sixteen
 * minutes apart, while every reader states newest-wins. A fix aimed at the wrong reader would pass
 * its own test and leave the real reader intact, so this payload is pinned once and every reader
 * that could have selected the older block is run against it.
 *
 * What the live payload actually is, and every part of it that matters:
 *
 * - **No reviews.** Both verdicts were published as issue comments.
 * - **Returned oldest first**, which is the order that makes "the first one found" look correct.
 * - **Both written by a maintainer** (`MEMBER`), so authorship separates neither.
 * - **The later one omits `nexus_version`**, the optional toolkit-version key — the one salient
 *   difference between the two blocks, and the property a model executing prose preferred over the
 *   platform's own timestamp.
 * - **Both name the same epic, story, analyzed commit and record.** Only the severity counts
 *   differ: the older reports two high findings, the later none.
 * - **Each block sits under prose repeating its own counts**, so a reader that reads the prose
 *   instead of the machine block cannot be told apart from one that reads the block — unless the
 *   two are made to disagree, which is what {@link proseDisagreeingWithBlock} does.
 */

export const TWO_VERDICT_PR = 665;
export const TWO_VERDICT_REPO = "github.com/geo-nexus/giccp";
export const TWO_VERDICT_EPIC = 114;
export const TWO_VERDICT_STORY = 117;
export const TWO_VERDICT_RECORD_HASH = "eb2fc23bc02d4ed85635196843ed6c0ff3ead694e348f8ba58b0a00744f32261";

/** The commit both verdicts analyzed. */
export const TWO_VERDICT_ANALYZED_HEAD = "4b0ea8d5326cd9e1f43175484f87e38e353f0331";
/** The pull request's head when the payload was captured — later than the analyzed commit. */
export const TWO_VERDICT_PR_HEAD = "de2de25b66b52e8e4628ccd332cabc813cb00ecd";

export const OLDER_VERDICT_AT = "2026-09-16T02:44:11Z";
export const NEWER_VERDICT_AT = "2026-09-16T02:59:56Z";

export interface VerdictBodyOptions {
    high: number;
    /** Omitted by the later of the two live blocks. */
    nexusVersion?: string;
    repo?: string;
    /** The issues repository the block names, when it names one (epic #751). */
    issuesRepo?: string;
    pr?: number;
    /** The counts the prose above the block states, when they are made to disagree with it. */
    proseHigh?: number;
}

/** One published verdict: the summary prose a lead reads, then the machine block a gate parses. */
export function verdictBody(opts: VerdictBodyOptions): string {
    const proseHigh = opts.proseHigh ?? opts.high;
    return [
        `Conformance: Table resource management (epic #${TWO_VERDICT_EPIC})`,
        `Mode: full (record #141 @ ${TWO_VERDICT_RECORD_HASH})`,
        "",
        `Severity: critical 0 · high ${proseHigh} · medium 0 · low 0`,
        "",
        "<!-- nexus:analyze-receipt -->",
        "```yaml",
        `epic: "#${TWO_VERDICT_EPIC}"`,
        ...(opts.nexusVersion === undefined ? [] : [`nexus_version: ${opts.nexusVersion}`]),
        ...(opts.issuesRepo === undefined ? [] : [`issues_repo: ${opts.issuesRepo}`]),
        `repo: ${opts.repo ?? TWO_VERDICT_REPO}`,
        `stories: [${TWO_VERDICT_STORY}]`,
        `pr: ${opts.pr ?? TWO_VERDICT_PR}`,
        "date: 2026-09-15",
        `head: ${TWO_VERDICT_ANALYZED_HEAD}`,
        "mode: full",
        'record: "#141"',
        `record_hash: ${TWO_VERDICT_RECORD_HASH}`,
        `findings: { critical: 0, high: ${opts.high}, medium: 0, low: 0 }`,
        "```",
    ].join("\n");
}

/** A block whose prose states counts the machine block does not — the two cannot be confused. */
export function proseDisagreeingWithBlock(): string {
    return verdictBody({ high: 0, proseHigh: 7 });
}

export interface PayloadComment {
    body: string;
    createdAt: string;
    authorAssociation: string;
}

export interface TwoVerdictPayloadOptions {
    /** Extra comments appended after the two live ones — an impostor, a stale copy, a quote. */
    extraComments?: PayloadComment[];
    /** Replaces the later verdict's body, keeping its timestamp and author. */
    newerBody?: string;
    /** Replaces the earlier verdict's body, keeping its timestamp and author. */
    olderBody?: string;
}

/**
 * The payload `gh pr view <N> --json state,headRefOid,baseRefOid,reviews,comments` returns for the
 * live pull request — comments oldest first, as GitHub returned them.
 */
export function twoVerdictPrPayload(opts: TwoVerdictPayloadOptions = {}): Record<string, unknown> {
    return {
        state: "MERGED",
        headRefOid: TWO_VERDICT_PR_HEAD,
        baseRefOid: "b".repeat(40),
        reviews: [],
        comments: [
            { body: "screenshot", createdAt: "2026-09-16T02:31:46Z", authorAssociation: "MEMBER" },
            {
                body: opts.olderBody ?? verdictBody({ high: 2, nexusVersion: "0.48.0" }),
                createdAt: OLDER_VERDICT_AT,
                authorAssociation: "MEMBER",
            },
            {
                body: opts.newerBody ?? verdictBody({ high: 0 }),
                createdAt: NEWER_VERDICT_AT,
                authorAssociation: "MEMBER",
            },
            ...(opts.extraComments ?? []),
        ],
    };
}
