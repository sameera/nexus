/**
 * The plan draft a planning pass writes (epic #456, story #545).
 *
 * The teaching session epic #407 shipped already reads a plan of slices, each naming its story, its
 * learner-or-handoff mark and its concepts, and decision record #469 requires the planning half to
 * adopt that contract rather than define a second one. So a stub is a slice in the shipped plan's
 * own field names — `story`, `builds`, `concepts` — and adds exactly one field beside them: the
 * concepts the slice assumes (record for #456, decision 2). The shipped `concepts` field already
 * means "introduced here"; it feeds the drill history and each lesson's front matter, so an assumed
 * concept put there would read as freshly taught.
 *
 * A stub is not a lesson. It carries no prose, no pinned story state, no sources, no branch and no
 * pinning test, and anything else offered as a stub field is refused rather than carried. Those
 * fields are owned by the approval that turns a draft into the committed plan (#458) and the
 * sources pinning that follows it (#459) — and both shipped plan readers refuse a slice missing
 * them. That is why the stubs stay a draft (decision 1): written beside the resolved roadmap, under
 * the gitignored derived-artifact location, and never into the committed workbook, where every
 * render, drift check and session would fail on them until approval.
 *
 * The draft is written whole or not at all. Every stub is validated before the file is touched, and
 * the file is replaced in one rename, so a reader never finds a draft that is part old and part new.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parse, stringify } from "yaml";
import { MATERIALIZED_DIR } from "@nexus/epic-resolve/write";

/** The file a planning pass's draft materializes as, beside the roadmap it was planned from. */
export const PLAN_DRAFT_FILENAME: string = "plan-draft.yml";

/** A slice is built by the learner or handed to a separate coding agent. There is no third mark. */
export type SliceMark = "learner" | "handoff";

export const SLICE_MARKS: readonly SliceMark[] = ["learner", "handoff"];

/**
 * The form every concept identifier takes: lower case, hyphenated, starting with a letter. The
 * shipped lesson writer places identifiers unquoted in a lesson's front matter and the shipped hint
 * log is keyed by them, so an identifier YAML would read as a number, or one carrying a space or a
 * colon, would be renamed by the first reader that parsed it (record for #456, invariant 8).
 */
export const CONCEPT_IDENTIFIER: RegExp = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** One slice of the draft: the shipped plan's story, mark and introduced concepts, plus what it assumes. */
export interface PlanStub {
    story: number;
    builds: SliceMark;
    /** The concepts this slice introduces — the shipped plan's own concept field, unchanged. */
    concepts: string[];
    /** The concepts this slice assumes a learner already holds. The one field a stub adds. */
    assumes: string[];
}

export interface PlanDraft {
    /** Every slice, in the roadmap's dependency order. */
    slices: PlanStub[];
}

/** The only fields a stub may carry. Anything else — prose, a pinned state, a source — is refused. */
const STUB_FIELDS: readonly string[] = ["story", "builds", "concepts", "assumes"];

/** Raised instead of writing a stub the shipped teaching session could not read as it stands. */
export class StubError extends Error {
    constructor(detail: string) {
        super(`${PLAN_DRAFT_FILENAME}: ${detail}`);
        this.name = "StubError";
    }
}

function identifiers(value: unknown, field: string, where: string): string[] {
    if (value === undefined) return [];
    if (!Array.isArray(value)) throw new StubError(`${where} carries '${field}' that is not a list of concept identifiers.`);
    return value.map((entry) => {
        const id: string = typeof entry === "string" ? entry : "";
        if (!CONCEPT_IDENTIFIER.test(id)) {
            throw new StubError(
                `${where} lists ${JSON.stringify(entry)} in '${field}'. A concept identifier is a plain lower-case ` +
                `hyphenated token, because the lesson writer places it unquoted in front matter.`,
            );
        }
        return id;
    });
}

/**
 * Read one stub, refusing anything the shipped plan contract would not accept as it stands. Pure:
 * it returns the stub or it throws, naming the slice and what is wrong with it.
 */
export function validateStub(raw: unknown, index: number): PlanStub {
    const where: string = `slice ${index + 1}`;
    const record: Record<string, unknown> =
        typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};

    const story: unknown = record["story"];
    if (typeof story !== "number" || !Number.isInteger(story) || story <= 0) {
        throw new StubError(`${where} names no single 'story'. A slice is one story at this stage, so a stub names exactly one.`);
    }
    const at: string = `${where} (story #${story})`;

    const mark: unknown = record["builds"];
    if (!SLICE_MARKS.includes(mark as SliceMark)) {
        throw new StubError(
            `${at} is marked ${JSON.stringify(mark ?? null)}. A slice is built by the 'learner' or is a 'handoff' ` +
            `to a separate coding agent, and the teaching session reads no other mark.`,
        );
    }

    const extra: string[] = Object.keys(record).filter((key) => !STUB_FIELDS.includes(key));
    if (extra.length > 0) {
        throw new StubError(
            `${at} carries ${extra.map((key) => `'${key}'`).join(", ")}. A stub declares its story, its mark and its ` +
            `concepts and nothing else — a lesson, its prose and its pinned state are written later, not planned.`,
        );
    }

    const concepts: string[] = identifiers(record["concepts"], "concepts", at);
    const assumes: string[] = identifiers(record["assumes"], "assumes", at);
    const both: string[] = assumes.filter((id) => concepts.includes(id));
    if (both.length > 0) {
        throw new StubError(
            `${at} both introduces and assumes ${both.join(", ")}. A concept a slice assumes is not one it teaches, ` +
            `and listing it as introduced would make it read as freshly taught.`,
        );
    }
    return { story, builds: mark as SliceMark, concepts, assumes };
}

/** Validate a whole draft: every stub, and one slice per story. */
export function validateDraft(draft: PlanDraft): PlanDraft {
    const slices: PlanStub[] = draft.slices.map((stub, index) => validateStub(stub, index));
    const seen: Set<number> = new Set();
    for (const stub of slices) {
        if (seen.has(stub.story)) {
            throw new StubError(`story #${stub.story} has two slices. One story is one slice at this stage.`);
        }
        seen.add(stub.story);
    }
    return { slices };
}

/** The draft's text: the shipped plan's slice structure, in the order given. */
export function renderPlanDraft(draft: PlanDraft): string {
    const valid: PlanDraft = validateDraft(draft);
    return stringify({ slices: valid.slices.map((stub) => ({ ...stub })) }, { indent: 4, flowCollectionPadding: false });
}

/** Where one roadmap's draft materializes: beside its roadmap, never in the committed workbook. */
export function planDraftPath(repoRoot: string, roadmap: string): string {
    return path.join(repoRoot, MATERIALIZED_DIR, `roadmap-${roadmap}`, PLAN_DRAFT_FILENAME);
}

/**
 * Replace a roadmap's draft with this one, whole. Every stub is validated before anything is
 * written, and the new text lands in one rename, so a refused stub leaves the previous draft exactly
 * as it was.
 */
export function writePlanDraft(repoRoot: string, roadmap: string, draft: PlanDraft): string {
    const text: string = renderPlanDraft(draft);
    const target: string = planDraftPath(repoRoot, roadmap);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const staged: string = `${target}.partial`;
    fs.writeFileSync(staged, text);
    fs.renameSync(staged, target);
    return target;
}

/** Read a roadmap's draft back, or null when none has been written. */
export function readPlanDraft(repoRoot: string, roadmap: string): PlanDraft | null {
    const target: string = planDraftPath(repoRoot, roadmap);
    if (!fs.existsSync(target)) return null;
    const doc: Record<string, unknown> = (parse(fs.readFileSync(target, "utf8")) as Record<string, unknown> | null) ?? {};
    return validateDraft({ slices: Array.isArray(doc["slices"]) ? (doc["slices"] as PlanStub[]) : [] });
}
