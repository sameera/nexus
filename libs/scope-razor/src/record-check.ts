/**
 * The checkpoint's cross-reference checks over a new-format record draft (epic #787, story #792, D7).
 *
 * A record's parts must point at each other. Each guarantee names the decisions behind it. In a
 * multi-story epic, each decision names the story that delivers it. Each epic or story change gives
 * the exact old and new wording. Each change not yet made, and each decision with a trade-off,
 * appears in the Approval brief. A gap in any of these is the kind the trial caught only by hand,
 * so each one blocks filing here. Most are allowed when the brief lists the item under "Resolve
 * before approval", because that is where the approver decides it.
 *
 * "Listed" means the item's ID appears, as a whole token, in the right group of the Approval brief.
 * The check proves that an ID is listed, not that the brief's sentence about it is right (D7's
 * trade-off). An ID listed in another group does not count.
 */

import { commitmentsIn, type Commitment, type UnreadableCommitment } from "./amendments.js";
import type { RazorFinding } from "./check.js";
import { stripLabels } from "./labels.js";
import { readRecord, recordSections, wholeId, type RecordDecision, type RecordField } from "./record.js";

const RESOLVE: string = "Resolve before approval";
const CHOICES: string = "Choices with trade-offs";
const PRESERVE: RegExp = /^Existing behaviou?r to preserve$/i;
const NONE: RegExp = /^none\.?$/i;

/** One gap, before it is shaped into a finding. */
interface Gap {
    id: string;
    line: number;
    message: string;
}

/**
 * The Approval brief's groups, each as the lines under its bold name, with provenance labels
 * removed. A label's quoted fragment is the lead's words, not a listing, so it must not count as
 * one. A group runs from its bold line to the next bold line or the next heading.
 */
function briefGroups(draft: string): Map<string, string[]> {
    const groups: Map<string, string[]> = new Map();
    let inBrief: boolean = false;
    let current: string[] | undefined;
    for (const raw of stripLabels(draft).split("\n")) {
        const heading: RegExpMatchArray | null = raw.match(/^(#+) (.*)$/);
        if (heading !== null) {
            if (heading[1].length <= 2) inBrief = /^Approval brief$/i.test(heading[2].replace(/\s*<!--.*$/, "").trim());
            current = undefined;
            continue;
        }
        if (!inBrief) continue;
        const group: RegExpMatchArray | null = raw.trim().match(/^\*\*([^*]+)\*\*$/);
        if (group !== null) {
            current = [];
            groups.set(group[1].trim().toLowerCase(), current);
            continue;
        }
        current?.push(raw);
    }
    return groups;
}

/** A value with its labels removed, or undefined when it is absent or written as `none`. */
function stated(field: RecordField | undefined): string | undefined {
    if (field === undefined) return undefined;
    const value: string = stripLabels(field.value).trim();
    return NONE.test(value) ? undefined : value;
}

function fieldOf(d: RecordDecision, name: RegExp): RecordField | undefined {
    return d.fields.find((f: RecordField) => name.test(f.name));
}

/** A commitment's status as written. An unreadable line still usually states one. */
function statusOf(c: Commitment | UnreadableCommitment): string {
    if (c.problem === undefined) return c.recorded;
    return c.text.match(/\bStatus:\s*(.+?)\.?\s*$/i)?.[1] ?? "not stated";
}

/**
 * Every cross-reference gap in a new-format draft. `stories` is the number of stories in the epic;
 * in an epic of one story, no decision needs to name it. A draft in any other format has none.
 */
export function crossReferenceFindings(draft: string, stories: number): RazorFinding[] {
    const read = readRecord(draft);
    if (read.format !== "new") return [];

    const groups: Map<string, string[]> = briefGroups(draft);
    const listedIn = (group: string, id: string): boolean => (groups.get(group.toLowerCase()) ?? []).some((line: string) => wholeId(id).test(line));
    const gaps: Gap[] = [];

    for (const g of recordSections(draft).guarantees) {
        if (g.id === undefined || g.decisions.length > 0 || PRESERVE.test(g.group) || listedIn(RESOLVE, g.id)) continue;
        gaps.push({
            id: g.id,
            line: g.line,
            message: `${g.id} cites no decision and is not under "Existing behaviour to preserve". End it with the decisions that support it, or list ${g.id} under "${RESOLVE}".`,
        });
    }

    for (const d of read.decisions) {
        if (d.id === undefined) continue;
        const id: string = d.id;

        const delivered: RecordField | undefined = fieldOf(d, /^Delivered by$/i);
        if (stories > 1 && stated(delivered) === undefined && !listedIn(RESOLVE, id)) {
            gaps.push({
                id,
                line: delivered?.line ?? d.line,
                message: `${id} names no delivering story, in an epic of ${stories} stories. Name the story under "Delivered by", or list ${id} under "${RESOLVE}".`,
            });
        }

        const tradeOff: RecordField | undefined = fieldOf(d, /^Trade-off$/i);
        if (stated(tradeOff) !== undefined && tradeOff !== undefined) {
            const inResolve: boolean = listedIn(RESOLVE, id);
            const inChoices: boolean = listedIn(CHOICES, id);
            if (!inResolve && !inChoices) {
                gaps.push({
                    id,
                    line: tradeOff.line,
                    message: `${id} has a trade-off, and the Approval brief lists ${id} under neither "${RESOLVE}" nor "${CHOICES}". List it with its trade-off as a sub-bullet.`,
                });
            } else if (inResolve && inChoices) {
                gaps.push({
                    id,
                    line: tradeOff.line,
                    message: `${id} is listed under both "${RESOLVE}" and "${CHOICES}". A decision appears in the brief once: under Resolve, with its trade-off there. Remove it from "${CHOICES}".`,
                });
            }
        }
    }

    for (const c of commitmentsIn(draft)) {
        const id: string = c.decision;
        if (c.problem !== undefined || c.old === undefined || c.new === undefined) {
            const why: string = c.problem ?? "no quoted old or new wording";
            gaps.push({
                id,
                line: c.line,
                message: `${id} changes epic or story text without both the exact old and the exact new wording (${why}). Quote both: Old: "…". New: "…". An addition has Old: "".`,
            });
        }
        const status: string = statusOf(c);
        if (!/^amended\b/i.test(status) && !listedIn(RESOLVE, id)) {
            gaps.push({
                id,
                line: c.line,
                message: `${id}'s epic or story change has status "${status}", not amended, and "${RESOLVE}" does not list ${id}. List it there, with the date it was checked.`,
            });
        }
    }

    return gaps
        .sort((a: Gap, b: Gap) => a.line - b.line)
        .map((gap: Gap) => ({ severity: "blocking" as const, rule: "cross-reference" as const, where: `${gap.id} (line ${gap.line})`, message: gap.message }));
}
