/**
 * Handoff records (epic #405, story #446): the pause a workbook session comes back to.
 *
 * A pause at a handoff can outlast the session that recorded it, so the handoff is kept with
 * everything else the workbook retains about a person — under the learner folder, excluded by the
 * same one rule.
 *
 * Each handoff is its own file, and a resolution is *appended* to that file rather than replacing
 * it (decision record #450, invariant 11). This mirrors two conventions the repository already
 * runs on — one file per discovery ticket, and append-only decision scratch per branch — so it
 * needs no new idiom and it is safe when two sessions touch the workbook. A single mutable
 * document would be simpler to read and would lose the history of what was handed off and when.
 *
 * Opening the workbook means starting a *session*, not opening a page in a browser: no rendered
 * page ever reads a handoff.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { type Runner, defaultRunner } from "@nexus/close-migration/run";
import {
    appendLearnerRecord,
    learnerRecordDir,
    listLearnerRecords,
    readLearnerRecord,
    writeLearnerRecord,
} from "./learner-store.js";
import { openWorkbook, type OpenedWorkbook } from "./workbook-store.js";

const KIND = "handoffs";

/**
 * How a handoff came to be resolved. The session resolves one only after a green suite and an
 * intact fence; a learner can also resolve one by hand, and the record says which happened, because
 * "resolved" alone would say the same word about something nobody checked (record #469).
 */
export type HandoffResolution = "verified" | "override";

export interface Handoff {
    /** The record's file name — also its position in the deterministic order. */
    id: string;
    /** The story that was handed off. A handoff that names no story is not a handoff. */
    story: string;
    /** The workbook the pause happened in. */
    workbook: string;
    /** When the pause was recorded, as the caller stated it. */
    recordedAt: string;
    /** Why the session paused, when it said. */
    note: string;
    /** Present once the handoff has been resolved; the record itself is never rewritten. */
    resolvedAt: string | null;
    /** How it was resolved, or null while it is still outstanding. */
    resolution: HandoffResolution | null;
}

export interface HandoffInput {
    story: string;
    workbook: string;
    recordedAt: string;
    note?: string;
}

function fieldOf(body: string, name: string): string | null {
    const match: RegExpMatchArray | null = body.match(new RegExp(`^- ${name}: (.*)$`, "m"));
    return match === null ? null : match[1].trim();
}

/** Turn one record's text into a handoff. Returns null for a file that is not one. */
function parseHandoff(id: string, body: string): Handoff | null {
    const story: string | null = fieldOf(body, "story");
    if (story === null || story === "") return null;
    const resolution: string | null = fieldOf(body, "resolution");
    return {
        id,
        story,
        workbook: fieldOf(body, "workbook") ?? "",
        recordedAt: fieldOf(body, "recorded") ?? "",
        note: fieldOf(body, "note") ?? "",
        resolvedAt: fieldOf(body, "resolved"),
        resolution: resolution === "verified" || resolution === "override" ? resolution : null,
    };
}

/**
 * Record a pause. The file name carries the recording order, so enumerating handoffs is a sorted
 * directory read and needs no timestamp comparison to be deterministic.
 */
export function recordHandoff(repoRoot: string, input: HandoffInput, run: Runner = defaultRunner): Handoff {
    if (input.story.trim() === "") {
        throw new Error("a handoff must name the story it handed off");
    }
    const existing: number = listLearnerRecords(repoRoot, KIND).length;
    const id: string = `handoff-${String(existing + 1).padStart(4, "0")}.md`;
    const body: string =
        `# Handoff\n\n` +
        `- story: ${input.story}\n` +
        `- workbook: ${input.workbook}\n` +
        `- recorded: ${input.recordedAt}\n` +
        `- note: ${input.note ?? ""}\n`;
    writeLearnerRecord(repoRoot, KIND, id, body, run);
    return parseHandoff(id, body) as Handoff;
}

/** Every handoff ever recorded, in recording order. Resolved ones are still here. */
export function allHandoffs(repoRoot: string): Handoff[] {
    const handoffs: Handoff[] = [];
    for (const id of listLearnerRecords(repoRoot, KIND)) {
        const body: string | null = readLearnerRecord(repoRoot, KIND, id);
        if (body === null) continue;
        const parsed: Handoff | null = parseHandoff(id, body);
        if (parsed !== null) handoffs.push(parsed);
    }
    return handoffs;
}

/** The handoffs still waiting, in recording order. */
export function outstandingHandoffs(repoRoot: string): Handoff[] {
    return allHandoffs(repoRoot).filter((h) => h.resolvedAt === null);
}

/**
 * Mark a handoff resolved by appending to its record. Nothing is deleted and nothing already
 * written is changed, so what was handed off and when stays readable.
 *
 * The append goes through the learner store rather than straight to the file: resolving is a write
 * to a personal record, so it asks git the same question recording it asked (invariant 9). The
 * record existing already is not the answer — the rule that excluded it may have gone since.
 *
 * `how` says what resolved it. A session that has just seen a green suite and an intact fence
 * passes "verified"; a learner resolving one by hand gets the default, "override", so the record
 * distinguishes a checked resolution from an asserted one rather than writing one line for both.
 */
export function resolveHandoff(
    repoRoot: string,
    id: string,
    resolvedAt: string,
    run: Runner = defaultRunner,
    how: HandoffResolution = "override",
): Handoff {
    const file: string = path.join(learnerRecordDir(repoRoot, KIND), id);
    if (!fs.existsSync(file)) throw new Error(`no handoff record named ${id}`);
    const before: string | null = readLearnerRecord(repoRoot, KIND, id);
    if (before !== null && fieldOf(before, "resolved") !== null) {
        return parseHandoff(id, before) as Handoff;
    }
    appendLearnerRecord(repoRoot, KIND, id, `- resolved: ${resolvedAt}\n- resolution: ${how}\n`, run);
    return parseHandoff(id, fs.readFileSync(file, "utf8")) as Handoff;
}

/** What a learner comes back to when a session starts. */
export interface WorkbookSession extends OpenedWorkbook {
    /** Every outstanding handoff, in recording order. */
    outstanding: Handoff[];
    /** The most recent outstanding handoff, or null when the workbook resumes at the start. */
    resumeAt: Handoff | null;
}

/**
 * Start a session on a workbook. This is what "opening the workbook" means — a session, not a page
 * in a browser — so this is the only place a handoff is read back.
 */
export function startWorkbookSession(repoRoot: string, slug: string): WorkbookSession {
    const opened: OpenedWorkbook = openWorkbook(repoRoot, slug);
    const outstanding: Handoff[] = outstandingHandoffs(repoRoot).filter(
        (h) => h.workbook === "" || h.workbook === slug,
    );
    return {
        ...opened,
        outstanding,
        resumeAt: outstanding.length === 0 ? null : outstanding[outstanding.length - 1],
    };
}
