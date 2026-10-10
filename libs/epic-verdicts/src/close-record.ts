/**
 * The close record and the close comment, built from the pull requests' verdicts (epic #830, story
 * #865, decision record #872: D2, D4–D8, D12).
 *
 * Close used to mine the diff, the decision stubs, the engineers' notes and the story-issue
 * comments, and ask the lead why the code departs from the record. Every one of those judgments is
 * now made before the merge and carried in each pull request's verdict (#829). This module reads
 * only the verdicts, the record body and the evidence gate's stamps (G2), and renders the shapes
 * distill already reads, in code rather than from a seeded template (D4):
 *
 * - **Key Decisions** (D5): every decision of the record body whose digest close stamps, in record
 *   order, with its ID, decision, reason and refuted alternative — by title in an old-format
 *   record, and the text the verdict carries for a record in neither format — then each decision
 *   stub a verdict confirmed, once, in the merge order of the first pull request that confirmed it.
 * - **Deviation Rationale** (D6): one bullet per accepted departure per pull request, in merge
 *   order and then ID order, naming what it departs from, the pull request and the departure's ID,
 *   what the code does instead, the accepted reason and who accepted it.
 * - **`analyze:`** (D7): `ran <date> @ <head>` from the completing pull request's verdict, plus
 *   today's revised-record clause when a waiver accepted the revision.
 * - #849's `range`, `story_ranges`, `landed_check` and `waivers` stamps, with each waived critical
 *   or high finding listed with who waived it (D6).
 * - **The record amendment** (D12): one comment from the superseding marks, with a hidden key
 *   naming the epic so a re-run finds it before writing another.
 *
 * Text copied from an answer, a stub, a proposal or the record is made inert first (D8), and the
 * frontmatter and the machine block hold only values close computes. There is no Process Lesson
 * (D14). Given the same verdicts, record body and epic state, the output is the same (G13).
 */

import { parse as parseYaml } from "yaml";
import { CLOSE_STUB_KEY_PREFIX } from "@nexus/delivery-config/stub-key";
import { deferredScopeStatus, type Departure, type Judgments } from "@nexus/pr-acceptance/judgments-block";
import { recordSections, type SectionDecision } from "@nexus/scope-razor/record";
import { MAINTAINER_ASSOCIATIONS } from "@nexus/pr-acceptance/receipt-blocks";
import { sameRepo } from "@nexus/workspace/issue-ref";
import { type AppliedWaiver, type CloseRanges, type PrLandedCheck } from "./close-ranges.js";
import { inertLines, inertText } from "./close-text.js";

/** The marker distill's range reader and its recovery anchor the close comment's machine block to. */
export const CLOSE_RECORD_MARKER = "<!-- nexus:close-record -->";

/** What opens the hidden key a record amendment carries. */
export const AMENDMENT_KEY_PREFIX = "<!-- nexus:close-amendment ";

/** One merged pull request's verdict, as far as close writes from it. */
export interface CloseVerdict {
    repo: string;
    pr: number;
    /** The verdict block's `date` and analyzed `head`. */
    date: string;
    head: string;
    /** The record digest the verdict was judged against, or null in degraded mode. */
    recordHash: string | null;
    judgments: Judgments;
}

/** The decision record as close stamps it: the current body and the digest close writes as `record_hash`. */
export interface CloseRecordSource {
    number: number;
    body: string;
    digest: string;
}

export interface CloseContentInput {
    epic: number;
    title: string;
    /** The epic's feature name, for the `feature:` key. */
    feature: string;
    /** The epic's feature path, for a stub's body. */
    featurePath: string;
    date: string;
    /** The release that wrote the record, or null when unresolved (the key is then omitted). */
    nexusVersion: string | null;
    issuesRepo: string;
    /** The repository close runs in, where the close record is committed. */
    codeRepo: string;
    record: CloseRecordSource | null;
    /** Every merged claiming pull request's verdict, in merge order. */
    verdicts: CloseVerdict[];
    ranges: Pick<CloseRanges, "range" | "stories" | "landed" | "waivers">;
    /** Stories waived as shipping without a pull request of their own, with the waiver comment's date (D10). */
    waivedStories?: { story: number; date: string }[];
}

export type KeyDecision =
    | { kind: "record"; record: number; id: string | undefined; title: string; decision: string | undefined; why: string | undefined; refuted: string[] }
    | { kind: "record-whole"; record: number; text: string }
    | { kind: "stub"; choice: string; reason: string; refuted: string; confirmedBy: string };

export interface DeviationEntry {
    repo: string;
    pr: number;
    id: string;
    /** What it departs from, with the record issue (or the epic's description) named. */
    baseline: string;
    instead: string;
    reason: string;
    /** `@login (link)`, or "the record revision". */
    acceptedBy: string;
}

export interface WaivedFinding {
    repo: string;
    pr: number;
    id: string;
    severity: string;
    about: string;
    author: string;
    link: string;
    reason: string;
}

export interface SupersededDecision {
    repo: string;
    pr: number;
    id: string;
    /** The decision's text from the record body, or the name the mark gives when the body has no match. */
    decision: string;
    instead: string;
    why: string;
    acceptedBy: string;
}

export interface ApprovedProposal {
    repo: string;
    pr: number;
    id: string;
    summary: string;
    approver: string;
    link: string;
}

export interface CloseContent {
    epic: number;
    title: string;
    feature: string;
    featurePath: string;
    date: string;
    nexusVersion: string | null;
    issuesRepo: string;
    codeRepo: string;
    record: { number: number; digest: string } | null;
    analyze: string;
    /** The `analyze:` value, when a waiver accepted a revised record: the comment's Conformance line. */
    conformance: string | null;
    ranges: CloseContentInput["ranges"];
    keyDecisions: KeyDecision[];
    deviations: DeviationEntry[];
    waivedFindings: WaivedFinding[];
    superseded: SupersededDecision[];
    approved: ApprovedProposal[];
    waivedStories: { story: number; date: string }[];
    /** Things the run reports but that change nothing it writes. */
    notes: string[];
}

const norm = (s: string): string => s.trim().replace(/\s+/g, " ").toLowerCase();
const idNumber = (id: string): number => Number(/\d+$/.exec(id)?.[0] ?? 0);
const prRef = (p: { repo: string; pr: number }): string => `${p.repo}#${p.pr}`;

function acceptedBy(answer: { author: string; link: string }): string {
    if (answer.author === "" && answer.link === "") return "the record revision";
    return answer.link === "" ? `@${answer.author}` : `@${answer.author || "unknown"} (${answer.link})`;
}

/** The text a record decision named by a mark or a verdict resolves to in the record body. */
function findDecision(decisions: SectionDecision[], format: string, name: string): SectionDecision | undefined {
    return format === "new" ? decisions.find((d) => d.id === name.trim()) : decisions.find((d) => norm(d.title) === norm(name));
}

/** Assemble everything close writes, in memory, from the verdicts, the record body and the gate's stamps. */
export function assembleCloseContent(input: CloseContentInput): CloseContent {
    const notes: string[] = [];
    const sections = input.record === null ? null : recordSections(input.record.body);
    const keyDecisions: KeyDecision[] = [];

    // Key Decisions, part one: the record's own decisions, from the body close stamps (D5).
    if (input.record !== null && sections !== null) {
        const n = input.record.number;
        if (sections.format === "neither") {
            const carried = [...input.verdicts].reverse().map((v) => v.judgments.keyDecisions?.record).find((r) => r?.format === "neither" && r.text !== undefined);
            keyDecisions.push({ kind: "record-whole", record: n, text: carried?.text ?? input.record.body });
        } else {
            for (const v of input.verdicts) {
                for (const ref of v.judgments.keyDecisions?.record?.decisions ?? []) {
                    const name = "id" in ref ? ref.id : ref.title;
                    if (findDecision(sections.decisions, sections.format, name) === undefined) {
                        const note = `The verdict on ${prRef(v)} names record decision "${inertText(name)}", which the current body of record #${n} does not carry; Key Decisions lists the body's decisions.`;
                        if (!notes.includes(note)) notes.push(note);
                    }
                }
            }
            for (const d of sections.decisions) {
                keyDecisions.push({ kind: "record", record: n, id: d.id, title: d.title, decision: d.decision, why: d.why, refuted: d.refutedAlternatives });
            }
        }
    }

    // Part two: each confirmed stub once, by its own identity, first confirmation first.
    const stubsSeen = new Set<string>();
    for (const v of input.verdicts) {
        for (const s of v.judgments.keyDecisions?.stubs ?? []) {
            const key = `${s.path}\u0000${norm(s.choice)}`;
            if (stubsSeen.has(key)) continue;
            stubsSeen.add(key);
            keyDecisions.push({ kind: "stub", choice: s.choice, reason: s.reason, refuted: s.refuted, confirmedBy: prRef(v) });
        }
    }

    const deviations: DeviationEntry[] = [];
    const superseded: SupersededDecision[] = [];
    const waivedFindings: WaivedFinding[] = [];
    const approved: ApprovedProposal[] = [];
    for (const v of input.verdicts) {
        const accepted = v.judgments.items
            .filter((d): d is Departure & { answer: NonNullable<Departure["answer"]> } => d.found && d.answer?.verb === "accepted")
            .sort((a, b) => idNumber(a.id) - idNumber(b.id));
        for (const d of accepted) {
            const baseline = input.record === null ? `the epic's description (#${input.epic}), ${d.departsFrom}` : `record #${input.record.number} ${d.departsFrom}`;
            const by = acceptedBy(d.answer);
            deviations.push({ repo: v.repo, pr: v.pr, id: d.id, baseline, instead: d.summary, reason: d.answer.reason, acceptedBy: by });
            if (d.supersedes !== null && sections !== null) {
                const found = findDecision(sections.decisions, sections.format, d.supersedes.decision);
                const text =
                    found === undefined
                        ? d.supersedes.decision
                        : `${found.id === undefined ? found.title : `${found.id} — ${found.title}`}${found.decision === undefined ? "" : `: ${found.decision}`}`;
                superseded.push({ repo: v.repo, pr: v.pr, id: d.id, decision: text, instead: d.supersedes.instead, why: d.answer.reason, acceptedBy: by });
            }
        }
        for (const f of [...v.judgments.findings].sort((a, b) => idNumber(a.id) - idNumber(b.id))) {
            if (!f.found || f.answer?.verb !== "waived" || (f.severity !== "critical" && f.severity !== "high")) continue;
            waivedFindings.push({ repo: v.repo, pr: v.pr, id: f.id, severity: f.severity, about: f.about, author: f.answer.author, link: f.answer.link, reason: f.answer.reason });
        }
        for (const s of deferredScopeStatus(v.judgments).sort((a, b) => idNumber(a.id) - idNumber(b.id))) {
            if (s.state !== "to-file" || s.approvedBy === null) continue;
            approved.push({ repo: v.repo, pr: v.pr, id: s.id, summary: s.summary, approver: s.approvedBy.author, link: s.approvedBy.link });
        }
    }

    // `analyze:` keeps today's grammar, from the completing pull request (D7).
    const completing = input.verdicts[input.verdicts.length - 1];
    let analyze = completing === undefined ? "not recorded" : `ran ${completing.date} @ ${completing.head}`;
    let conformance: string | null = null;
    if (completing !== undefined && input.record !== null) {
        const waiver = input.ranges.waivers.find(
            (w): w is Extract<AppliedWaiver, { cause: "record-revised" }> => w.cause === "record-revised" && w.pr === completing.pr && sameRepo(w.repo, completing.repo),
        );
        if (waiver !== undefined) {
            analyze +=
                `; stale — record #${input.record.number} revised since analysis (${completing.recordHash ?? "none"} → ${waiver.digest}); ` +
                `waived ${waiver.at.slice(0, 10)} by @${waiver.author || "unknown"}`;
            conformance = analyze;
        }
    }

    return {
        epic: input.epic,
        title: input.title,
        feature: input.feature,
        featurePath: input.featurePath,
        date: input.date,
        nexusVersion: input.nexusVersion,
        issuesRepo: input.issuesRepo,
        codeRepo: input.codeRepo,
        record: input.record === null ? null : { number: input.record.number, digest: input.record.digest },
        analyze,
        conformance,
        ranges: input.ranges,
        keyDecisions,
        deviations,
        waivedFindings,
        superseded,
        approved,
        waivedStories: input.waivedStories ?? [],
        notes,
    };
}

/** The key a proposal's stub number is looked up under: its pull request and its ID. */
export function proposalKey(p: { repo: string; pr: number; id: string }): string {
    return `${p.repo.toLowerCase()}#${p.pr} ${p.id}`;
}

// ---------------------------------------------------------------------------------------------
// Rendering. Every copied string goes through inertText or inertLines; every YAML value is computed.
// ---------------------------------------------------------------------------------------------

/** A YAML scalar: plain when it is plainly safe, else double-quoted (JSON is valid YAML). */
export function scalar(s: string): string {
    return /^[A-Za-z0-9][A-Za-z0-9 ._/@+-]*$/.test(s) && !/ $/.test(s) ? s : JSON.stringify(s);
}

/** A story number as the stamps write it: bare when the issues live where the record is committed. */
function storyRef(c: CloseContent, story: number): string {
    return JSON.stringify(sameRepo(c.issuesRepo, c.codeRepo) ? `#${story}` : `${c.issuesRepo}#${story}`);
}

function flow(entries: Array<[string, string]>): string {
    return `{ ${entries.map(([k, v]) => `${k}: ${v}`).join(", ")} }`;
}

function landedEntry(p: PrLandedCheck): string {
    const head: Array<[string, string]> = [
        ["repo", scalar(p.repo)],
        ["pr", String(p.pr)],
        ["result", p.result],
    ];
    if (p.result === "changed") head.push(["files", `[${p.files.filter((f) => f.status === "changed").map((f) => scalar(f.path)).join(", ")}]`]);
    if (p.result === "not-checked") head.push(["reason", p.reason]);
    return flow(head);
}

function waiverEntries(c: CloseContent): string[] {
    const out: string[] = [];
    for (const w of c.ranges.waivers) {
        const e: Array<[string, string]> = [
            ["repo", scalar(w.repo)],
            ["pr", String(w.pr)],
            ["cause", w.cause],
        ];
        if (w.cause === "landed-change") e.push(["files", `[${w.files.map(scalar).join(", ")}]`]);
        else e.push(["record", JSON.stringify(`#${w.record}`)], ["digest", scalar(w.digest)]);
        e.push(["author", scalar(w.author || "unknown")], ["url", scalar(w.url)], ["stories", `[${w.stories.map((s) => storyRef(c, s)).join(", ")}]`]);
        out.push(flow(e));
    }
    for (const f of c.waivedFindings) {
        out.push(
            flow([
                ["repo", scalar(f.repo)],
                ["pr", String(f.pr)],
                ["cause", "finding"],
                ["id", f.id],
                ["severity", f.severity],
                ["author", scalar(f.author || "unknown")],
                ["url", scalar(f.link)],
            ]),
        );
    }
    return out;
}

/** The stamps the record's frontmatter and the comment's machine block share, entry for entry. */
function stampLines(c: CloseContent): string[] {
    const lines: string[] = [];
    if (c.ranges.range.length === 0) lines.push("range: []");
    else {
        lines.push("range:");
        for (const r of c.ranges.range) lines.push(`  - repo: ${scalar(r.repo)}`, `    pr: ${r.pr}`, `    base: ${r.base}`, `    head: ${r.head}`);
    }
    if (c.ranges.stories.length === 0) lines.push("story_ranges: []");
    else {
        lines.push("story_ranges:");
        for (const s of c.ranges.stories) {
            lines.push(`  - story: ${storyRef(c, s.story)}`);
            if (s.ranges.length === 0) {
                lines.push("    ranges: []");
                continue;
            }
            lines.push("    ranges:");
            for (const r of s.ranges) {
                lines.push(
                    `      - ${
                        r.source === "no-range"
                            ? flow([["repo", scalar(r.repo)], ["pr", String(r.pr)], ["range", "none"]])
                            : flow([["repo", scalar(r.repo)], ["pr", String(r.pr)], ["base", r.base], ["head", r.head]])
                    }`,
                );
            }
        }
    }
    if (c.ranges.landed.length === 0) lines.push("landed_check: []");
    else {
        lines.push("landed_check:");
        for (const s of c.ranges.landed) {
            lines.push(`  - story: ${storyRef(c, s.story)}`, `    result: ${s.result}`);
            lines.push(s.prs.length === 0 ? "    prs: []" : "    prs:");
            for (const p of s.prs) lines.push(`      - ${landedEntry(p)}`);
        }
    }
    const waivers = waiverEntries(c);
    if (waivers.length > 0) lines.push("waivers:", ...waivers.map((w) => `  - ${w}`));
    return lines;
}

function keyDecisionLines(d: KeyDecision): string[] {
    const t = inertText;
    if (d.kind === "record-whole") {
        return [`- **Decision record #${d.record}, read whole (its headings match neither format):**`, ...inertLines(d.text).map((l) => (l === "" ? "  >" : `  > ${l}`))];
    }
    if (d.kind === "stub") {
        return [`- **${t(d.choice)}** (a decision stub the verdict on ${d.confirmedBy} confirmed). **Why:** ${t(d.reason)} **Refuted alternative:** ${t(d.refuted)}`];
    }
    const name = d.id === undefined ? t(d.title) : `${d.id} — ${t(d.title)}`;
    const parts = [`- **${name} (#${d.record}).**`];
    if (d.decision !== undefined) parts.push(t(d.decision));
    if (d.why !== undefined) parts.push(`**Why:** ${t(d.why)}`);
    parts.push(`**Refuted alternative:** ${d.refuted.length === 0 ? "none" : d.refuted.map(t).join("; ")}`);
    return [parts.join(" ")];
}

function deviationLine(d: DeviationEntry): string {
    return `- **Departs from ${inertText(d.baseline)} — ${d.repo}#${d.pr} ${d.id}.** ${inertText(d.instead)} **Why:** ${inertText(d.reason)} **Accepted by:** ${d.acceptedBy}`;
}

/** The Key Decisions bullets, the same on the record and the comment (G9). */
export function renderKeyDecisions(c: CloseContent): string[] {
    return c.keyDecisions.length === 0 ? ["none"] : c.keyDecisions.flatMap(keyDecisionLines);
}

/** The Deviation Rationale bullets, the same on the record and the comment (G9); empty when none. */
export function renderDeviationRationale(c: CloseContent): string[] {
    return c.deviations.map(deviationLine);
}

function deferredLines(c: CloseContent, stubs: ReadonlyMap<string, number>, arrow: string): string[] {
    return c.approved.map((p) => {
        const n = stubs.get(proposalKey(p));
        return n === undefined
            ? `- ${arrow}not yet filed — ${inertText(p.summary)} (approved by @${p.approver || "unknown"} on ${p.repo}#${p.pr} ${p.id})`
            : `- ${arrow}#${n} — ${inertText(p.summary)}`;
    });
}

/**
 * The close record, `close-record.md`. `stubs` maps each approved proposal's {@link proposalKey}
 * to the stub issue filed for it; an approved proposal with no number yet is named as not filed.
 */
export function renderCloseRecord(c: CloseContent, stubs: ReadonlyMap<string, number> = new Map()): string {
    const fm: string[] = [
        "---",
        `title: ${JSON.stringify(`Close Record: ${inertText(c.title)}`)}`,
        `epic: ${JSON.stringify(`#${c.epic}`)}`,
        `feature: ${JSON.stringify(inertText(c.feature))}`,
        `date: ${c.date}`,
    ];
    if (c.nexusVersion !== null) fm.push(`nexus_version: ${scalar(c.nexusVersion)}`);
    if (!sameRepo(c.issuesRepo, c.codeRepo)) fm.push(`issues_repo: ${scalar(c.issuesRepo)}`);
    fm.push(`analyze: ${scalar(c.analyze)}`);
    if (c.record !== null) fm.push(`record: ${JSON.stringify(`#${c.record.number}`)}`, `record_hash: ${c.record.digest}`);
    fm.push(...stampLines(c), "---");

    const deviations = renderDeviationRationale(c);
    const deferred = deferredLines(c, stubs, "");
    const body: string[] = [
        "",
        `# Close Record: ${inertText(c.title)}`,
        "",
        "## Key Decisions",
        "",
        ...renderKeyDecisions(c),
        "",
        "## Deviation Rationale",
        "",
        ...(deviations.length === 0 ? ["none"] : deviations),
        "",
        "## Waived Stories",
        "",
        ...(c.waivedStories.length === 0 ? ["none"] : c.waivedStories.map((w) => `- #${w.story} — waived ${w.date}`)),
        "",
        "## Deferred Scope",
        "",
        ...(deferred.length === 0 ? ["none"] : ["Deferred items filed as epic stub issues:", "", ...deferred]),
        "",
    ];
    return [...fm, ...body].join("\n");
}

function waiverStatement(c: CloseContent): string[] {
    const lines: string[] = [];
    for (const w of c.ranges.waivers) {
        const what = w.cause === "landed-change" ? `(${w.files.join(", ")})` : `(record #${w.record} at ${w.digest})`;
        lines.push(`- ${w.repo}#${w.pr} ${w.cause} ${what} by @${w.author || "unknown"}, ${w.url}${w.reason ? `: ${inertText(w.reason)}` : ""}`);
    }
    for (const f of c.waivedFindings) {
        lines.push(`- ${f.repo}#${f.pr} finding ${f.id} (${f.severity}: ${inertText(f.about)}) waived by @${f.author || "unknown"}, ${f.link}: ${inertText(f.reason)}`);
    }
    return lines;
}

/**
 * The close comment posted on the epic issue (G47): the prose inline, in full, then the
 * marker-anchored machine block distill's recovery reads. It links nothing under the queue.
 */
export function renderCloseComment(c: CloseContent, stubs: ReadonlyMap<string, number> = new Map()): string {
    const out: string[] = ["## Close Record", "", "Epic closed. Durable record below — the ephemeral `close-record.md` is hand-off only.", ""];
    if (c.record !== null) out.push(`Decision record: #${c.record.number} @ \`${c.record.digest}\``, "");
    if (c.conformance !== null) out.push(`Conformance: ${c.conformance}`, "");
    const waivers = waiverStatement(c);
    if (waivers.length > 0) out.push("Waivers applied:", "", ...waivers, "");
    out.push("### Key Decisions", "", ...renderKeyDecisions(c), "");
    const deviations = renderDeviationRationale(c);
    if (deviations.length > 0) out.push("### Deviation Rationale", "", ...deviations, "");
    const deferred = deferredLines(c, stubs, "Deferred scope → ");
    if (deferred.length > 0) out.push("### Pointers (durable)", "", ...deferred, "");

    const block: string[] = [`epic: ${JSON.stringify(`#${c.epic}`)}`];
    if (c.nexusVersion !== null) block.push(`nexus_version: ${scalar(c.nexusVersion)}`);
    block.push(`issues_repo: ${scalar(c.issuesRepo)}`, `date: ${c.date}`);
    if (c.record !== null) block.push(`record: ${JSON.stringify(`#${c.record.number}`)}`, `record_hash: ${c.record.digest}`);
    block.push(`analyze: ${scalar(c.analyze)}`, ...stampLines(c));
    out.push(CLOSE_RECORD_MARKER, "```yaml", ...block, "```", "");
    return out.join("\n");
}

/** The hidden key a record amendment for this epic carries, which find-before-write looks for. */
export function amendmentKey(issuesRepo: string, epic: number): string {
    return `${AMENDMENT_KEY_PREFIX}epic: ${issuesRepo.toLowerCase()}#${epic} -->`;
}

/**
 * The amendment comment on the record issue (D12, G28): one bullet per superseded decision, with
 * what shipped instead and why. Null when no departure is marked superseding: nothing is posted.
 */
export function renderRecordAmendment(c: CloseContent): string | null {
    if (c.superseded.length === 0 || c.record === null) return null;
    const prs = [...new Set(c.superseded.map(prRef))];
    return [
        `## Amended at close — ${c.superseded.length} decision(s) superseded`,
        "",
        `\`nexus close\` read these from the analyze verdicts on ${prs.join(", ")}, which judged the shipped code against this record. ` +
            "The record body stands as approved; this comment is the correction, not a re-decision.",
        "",
        ...c.superseded.map(
            (s) => `- **${inertText(s.decision)}** → **shipped:** ${inertText(s.instead)}. ${inertText(s.why)} (${s.repo}#${s.pr} ${s.id}, accepted by ${s.acceptedBy})`,
        ),
        "",
        amendmentKey(c.issuesRepo, c.epic),
        "",
    ].join("\n");
}

/** The hidden key a deferred-scope stub carries: its epic, pull request and proposal. */
export function stubKey(c: Pick<CloseContent, "issuesRepo" | "epic">, p: Pick<ApprovedProposal, "repo" | "pr" | "id">): string {
    return `${CLOSE_STUB_KEY_PREFIX}epic: ${c.issuesRepo.toLowerCase()}#${c.epic} pr: ${p.repo.toLowerCase()}#${p.pr} proposal: ${p.id} -->`;
}

/**
 * The title and body of the stub an approved proposal is filed as (D9): its goal,
 * the feature path, its provenance and its key. No estimate and no ordering; planning sizes it.
 */
export function renderDeferredStub(c: CloseContent, p: ApprovedProposal): { title: string; body: string } {
    const goal = inertText(p.summary);
    return {
        title: goal,
        body: [
            goal,
            "",
            "## Meta",
            "",
            `- **feature:** ${inertText(c.featurePath)}`,
            `- **source:** deferred from epic ${inertText(c.title)} (#${c.epic}) (${c.date}): ${p.repo}#${p.pr} ${p.id}, approved by @${p.approver || "unknown"} (${p.link})`,
            "",
            stubKey(c, p),
            "",
        ].join("\n"),
    };
}

/** The machine block of a close comment, parsed: null when it carries none that reads. */
export function machineBlock(comment: string): Record<string, unknown> | null {
    // The marker that opens a line is the comment's own; a quoted copy earlier in it is not.
    const own = comment.search(OWN_MARKER_RE);
    const at = own >= 0 ? own : comment.indexOf(CLOSE_RECORD_MARKER);
    if (at < 0) return null;
    const fence = /^\n```ya?ml\n([\s\S]*?)\n```/.exec(comment.slice(at + CLOSE_RECORD_MARKER.length));
    if (fence === null) return null;
    try {
        const doc: unknown = parseYaml(fence[1]);
        return doc !== null && typeof doc === "object" && !Array.isArray(doc) ? (doc as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

export function recordNumber(v: unknown): number | null {
    const m = /^#?(\d+)$/.exec(String(v ?? "").trim());
    return m === null ? null : Number(m[1]);
}

/** What an epic's comments say about its own close: the close to resume from, or that one cannot be read. */
export type EpicCloseComment = { found: "own"; body: string; block: Record<string, unknown> } | { found: "unreadable"; why: string } | { found: "none" };

/**
 * The epic's own close comment, the one close resumes from and recovery re-stamps: the newest from
 * an author who can speak for the repository, with the marker opening a line (a quoted copy's does
 * not), whose machine block stamps this epic and, where it names one, this issues repository.
 * Another epic's close comment is passed over. `unreadable` is a trusted, unquoted marker whose
 * block does not read, stamps no epic, or stamps this epic in another issues repository (a renamed
 * repository, or a copied comment), when no own one exists: neither a close to resume from nor
 * proof that none happened, so the caller stops and names why.
 */
export function findEpicCloseComment(comments: readonly { body: string; authorAssociation: string }[], epic: number, issuesRepo: string): EpicCloseComment {
    let unreadable: string | null = null;
    for (const c of [...comments].reverse()) {
        if (!MAINTAINER_ASSOCIATIONS.includes(c.authorAssociation.toUpperCase()) || !OWN_MARKER_RE.test(c.body)) continue;
        const block = machineBlock(c.body);
        const stamped = block === null ? null : recordNumber(block["epic"]);
        if (block === null || stamped === null) {
            unreadable ??= "its machine block does not read";
            continue;
        }
        if (stamped !== epic) continue;
        const repo = block["issues_repo"];
        if (typeof repo === "string" && !sameRepo(repo, issuesRepo)) {
            unreadable ??= `it stamps epic #${epic} of ${repo}, not of ${issuesRepo}`;
            continue;
        }
        return { found: "own", body: c.body, block };
    }
    return unreadable === null ? { found: "none" } : { found: "unreadable", why: unreadable };
}

/** The close-record marker opening a line, as close writes it; a quoted copy starts with `>`. */
const OWN_MARKER_RE = /^<!-- nexus:close-record -->/m;

/** The merged pull requests a close stamped, in merge order: the range, then any with no range of its own. */
export function stampedPrs(block: Record<string, unknown>): { prs: { repo: string; pr: number }[]; unnamed: number } {
    const out: { repo: string; pr: number }[] = [];
    const seen = new Set<string>();
    let unnamed = 0;
    const add = (e: unknown): void => {
        if (e === null || typeof e !== "object") return;
        const rec = e as Record<string, unknown>;
        const repo = typeof rec["repo"] === "string" ? rec["repo"] : "";
        const pr = typeof rec["pr"] === "number" ? rec["pr"] : null;
        if (pr === null || repo === "") {
            unnamed += 1;
            return;
        }
        const key = `${repo.toLowerCase()}#${pr}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ repo, pr });
    };
    for (const e of Array.isArray(block["range"]) ? block["range"] : []) add(e);
    for (const s of Array.isArray(block["story_ranges"]) ? block["story_ranges"] : []) {
        const ranges = s !== null && typeof s === "object" ? (s as Record<string, unknown>)["ranges"] : undefined;
        for (const e of Array.isArray(ranges) ? ranges : []) add(e);
    }
    return { prs: out, unnamed };
}
