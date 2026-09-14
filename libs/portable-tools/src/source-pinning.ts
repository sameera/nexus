/**
 * Source pinning (epic #459): the step that fills in the material a slice's lesson is written from,
 * once the slice's epic has an approved decision record.
 *
 * A stub is approved knowing its concepts and its mark, because both come from the roadmap alone. Its
 * sources cannot be known then: they come from a decision record, and a record does not exist until the
 * slice's own epic is designed. The stage that reads that record and the diff built against it is the
 * one that pins them, so a lesson written later opens named sources instead of searching the repository
 * again for what promotion already read.
 *
 * Pinning is owned here and nowhere else. It fills only slices the learner builds in the named epic,
 * never a handoff or a scaffold, which teach from nothing. It never rewrites a source already pinned, so
 * running it again cannot move what a lesson was already written from. And an epic whose record is not
 * approved yet is not an error: the step pins nothing and says so, because the record simply is not
 * there to pin from.
 *
 * The step is pure. The record's approval, the plan and the authored sources are handed in, and a plan
 * comes back whole or not at all.
 */

import { parse } from "yaml";
import { sliceLabel, type PinnedSources, type PlanSliceRecord, type WorkbookPlan } from "./workbook-plan.js";

/** The decision record an epic's slices are pinned from, as the issue graph holds it right now. */
export interface DecisionRecordState {
    number: number;
    /** A record is approved when its sub-issue is closed. */
    approved: boolean;
    body: string;
}

/** The sources an agent read out of the record and the diff for one story. */
export interface AuthoredSources {
    story: number;
    section: string;
    exemplar: string;
}

export interface PinningInput {
    plan: WorkbookPlan;
    epic: number;
    /** The epic's decision record, or null when it has none yet. */
    record: DecisionRecordState | null;
    authored: readonly AuthoredSources[];
}

export type PinningResult =
    | { ok: true; plan: WorkbookPlan; pinned: string[]; kept: string[]; waiting: string | null }
    | { ok: false; report: string };

/** Raised instead of reading an authored sources file that does not say what each source is. */
export class SourcesError extends Error {
    constructor(detail: string) {
        super(`sources: ${detail}`);
        this.name = "SourcesError";
    }
}

function refused(lead: string, details: readonly string[] = []): PinningResult {
    return { ok: false, report: [`Pinning refused: ${lead}`, ...details, "Nothing in the committed workbook was written."].join("\n") };
}

/** Read the sources an agent authored: a `sources` list, one entry per story. */
export function parseAuthoredSources(source: string): AuthoredSources[] {
    const doc: unknown = parse(source);
    const list: unknown = typeof doc === "object" && doc !== null ? (doc as Record<string, unknown>)["sources"] : undefined;
    if (!Array.isArray(list)) throw new SourcesError("the file declares no 'sources' list.");
    return list.map((raw, index): AuthoredSources => {
        const entry: Record<string, unknown> = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
        const story: number = Number(entry["story"]);
        if (!Number.isInteger(story) || story <= 0) throw new SourcesError(`entry ${index + 1} names no 'story'.`);
        const field = (name: string): string => {
            const value: unknown = entry[name];
            if (typeof value !== "string" || value.trim() === "") throw new SourcesError(`#${story} declares no '${name}'.`);
            return value.trim();
        };
        return { story, section: field("section"), exemplar: field("exemplar") };
    });
}

/** Whether a slice is one the pinning step fills for this epic: a story the learner builds in it. */
function pinnable(slice: PlanSliceRecord, epic: number): boolean {
    return slice.scaffold === undefined && slice.learnerBuilds && slice.epic === epic;
}

/**
 * Pin the sources for every slice the learner builds in one epic. A slice already pinned keeps what it
 * has; every other one must be given sources, because a slice left bare would be taught from a search
 * the step exists to replace. Sources offered for a story the step does not fill are refused rather
 * than dropped, since they most often mean the agent read the wrong epic.
 */
export function pinSources(input: PinningInput): PinningResult {
    const { plan, epic, record } = input;
    if (record === null) {
        return { ok: true, plan, pinned: [], kept: [], waiting: `epic #${epic} has no decision record yet, so nothing was pinned.` };
    }
    if (!record.approved) {
        return { ok: true, plan, pinned: [], kept: [], waiting: `decision record #${record.number} for epic #${epic} is not approved yet, so nothing was pinned.` };
    }

    const targets: PlanSliceRecord[] = plan.slices.filter((slice) => pinnable(slice, epic));
    const stray: string[] = input.authored
        .filter((entry) => !targets.some((slice) => slice.story === entry.story))
        .map((entry) => {
            const named: PlanSliceRecord | undefined = plan.slices.find((slice) => slice.story === entry.story);
            if (named === undefined) return `  #${entry.story} is not a story this plan teaches.`;
            if (!named.learnerBuilds) return `  #${entry.story} is a handoff slice, which teaches nothing and so is pinned no sources.`;
            return `  #${entry.story} belongs to epic #${named.epic}, not #${epic}.`;
        });
    if (stray.length > 0) return refused(`sources were given for stories this step does not pin for epic #${epic}.`, stray);

    const missing: string[] = targets
        .filter((slice) => slice.sources === undefined && !input.authored.some((entry) => entry.story === slice.story))
        .map((slice) => `  ${sliceLabel(slice)} is built by the learner and was given no sources.`);
    if (missing.length > 0) return refused(`every slice the learner builds in epic #${epic} is pinned together.`, [...new Set(missing)]);

    const pinned: string[] = [];
    const kept: string[] = [];
    const slices: PlanSliceRecord[] = plan.slices.map((slice) => {
        if (!pinnable(slice, epic)) return slice;
        if (slice.sources !== undefined) {
            kept.push(sliceLabel(slice));
            return slice;
        }
        const entry: AuthoredSources = input.authored.find((candidate) => candidate.story === slice.story) as AuthoredSources;
        const sources: PinnedSources = { section: entry.section, exemplar: entry.exemplar };
        pinned.push(sliceLabel(slice));
        return { ...slice, sources };
    });
    return { ok: true, plan: { ...plan, slices }, pinned, kept, waiting: null };
}
