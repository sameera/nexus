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
 * A handoff stub is smaller still (story #548). A handoff slice teaches nothing, so it carries its
 * story and its mark and no concepts, no sources and no lesson — and with no lesson it never becomes
 * a page. It names no sibling list either: the shipped handoff prompt already takes every other
 * slice in the plan as a sibling, which includes every other slice of the same epic.
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
 * log is keyed by them, so an identifier YAML would read as a number, a boolean or null, or one
 * carrying a space or a colon, would be renamed by the first reader that parsed it (record for #456,
 * invariant 8).
 */
export const CONCEPT_IDENTIFIER: RegExp = /^(?!(?:true|false|null)$)[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** One slice of the draft: the shipped plan's story, mark and introduced concepts, plus what it assumes. */
export interface PlanStub {
    story: number;
    builds: SliceMark;
    /**
     * Which part of its story this slice is, 1-based, when the story became several slices. Absent
     * exactly when the slice is the whole of its story (record #562).
     */
    part?: number;
    /** The concepts this slice introduces — the shipped plan's own concept field, unchanged. */
    concepts: string[];
    /** The concepts this slice assumes a learner already holds. The one field a stub adds. */
    assumes: string[];
}

/** One merged concept: the identifier every list now uses for it, and what it means in one line. */
export interface VocabularyEntry {
    id: string;
    gloss: string;
    /**
     * Every other proposed name the merge folded into this concept. A handed-off story's concepts stay
     * only in its checked list, under the names its subagent proposed (decision 7), so these are what
     * lead a later stage from that list to the identifier a learner slice uses.
     */
    aliases: string[];
}

/** One concept the learner's declaration removed, beside the words that removed it. */
export interface DeclaredConcept {
    concept: string;
    /** The learner's own phrase, quoted verbatim. It reaches no stub and no committed file. */
    phrase: string;
}

/** One concept a learner slice assumes that the plan put out of its reach. */
export interface CoverageGap {
    concept: string;
    /** The learner slice that assumes it. */
    story: number;
    /** The handed-off story that introduces it, when the focus boundary is what put it out of reach. */
    handedOff?: number;
}

/** What the coverage check found. A plan whose verdict is not clean does not reach the approval gate. */
export interface CoverageVerdict {
    clean: boolean;
    gaps: CoverageGap[];
}

export interface PlanDraft {
    /** Every slice, in the roadmap's dependency order. */
    slices: PlanStub[];
    /** The merged concept vocabulary, kept with the draft so a later stage can match words to identifiers. */
    vocabulary?: VocabularyEntry[];
    /**
     * The concepts the learner declared they already know, each beside the phrase that declared it.
     * The reviewer at the approval gate reads these; a later slice assuming one of them is satisfied
     * rather than missing (record #562, invariants 5 and 9).
     */
    declared?: DeclaredConcept[];
    /** Every declared phrase that named no concept the roadmap teaches (invariant 8). */
    unmatched?: string[];
    /**
     * What the coverage check found over the finished plan. It travels with the plan so the approval
     * gate can refuse a plan in code rather than on instruction (invariant 33).
     */
    coverage?: CoverageVerdict;
}

/** The only fields a stub may carry. Anything else — prose, a pinned state, a source — is refused. */
const STUB_FIELDS: readonly string[] = ["story", "builds", "part", "concepts", "assumes"];

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

    const part: unknown = record["part"];
    if (part !== undefined && (typeof part !== "number" || !Number.isInteger(part) || part <= 0)) {
        throw new StubError(`${at} carries a 'part' that is not a positive whole number. A part says which of its story's slices this is.`);
    }
    if (part !== undefined && mark === "handoff") {
        throw new StubError(`${at} is a handoff and carries a 'part'. A handoff teaches nothing, so there is nothing of it to split.`);
    }

    const concepts: string[] = identifiers(record["concepts"], "concepts", at);
    const assumes: string[] = identifiers(record["assumes"], "assumes", at);
    if (mark === "handoff" && (concepts.length > 0 || assumes.length > 0)) {
        throw new StubError(
            `${at} is a handoff and lists concepts. A handoff slice teaches nothing, so its stub carries its story ` +
            `and its mark and no concepts or sources.`,
        );
    }
    const both: string[] = assumes.filter((id) => concepts.includes(id));
    if (both.length > 0) {
        throw new StubError(
            `${at} both introduces and assumes ${both.join(", ")}. A concept a slice assumes is not one it teaches, ` +
            `and listing it as introduced would make it read as freshly taught.`,
        );
    }
    return { story, builds: mark as SliceMark, ...(part === undefined ? {} : { part: part as number }), concepts, assumes };
}

/**
 * Validate a whole draft: every stub, and each story's slices.
 *
 * A story is one slice, or it is several consecutively numbered parts of itself — a slice's identity
 * is its story plus which part of that story it is, and an unsplit slice is the whole of its story
 * (record #562). Without that rule nothing distinguishes a legitimate split from a duplicated stub.
 */
export function validateDraft(draft: PlanDraft): PlanDraft {
    const slices: PlanStub[] = draft.slices.map((stub, index) => validateStub(stub, index));
    const byStory: Map<number, PlanStub[]> = new Map();
    for (const stub of slices) byStory.set(stub.story, [...(byStory.get(stub.story) ?? []), stub]);
    for (const [story, group] of byStory) {
        if (group.length === 1 && group[0].part === undefined) continue;
        const parts: number[] = group.map((stub) => stub.part ?? 0).sort((a, b) => a - b);
        if (group.length === 1) {
            throw new StubError(`story #${story} is one slice and carries a 'part'. An unsplit slice is the whole of its story.`);
        }
        if (parts.some((part, index) => part !== index + 1)) {
            throw new StubError(
                `story #${story} has ${group.length} slices numbered ${parts.join(", ")}. The parts of a split story are ` +
                `consecutive from 1, because several slices for one story are otherwise indistinguishable from a duplicated stub.`,
            );
        }
    }
    return {
        slices,
        ...(draft.vocabulary === undefined ? {} : { vocabulary: draft.vocabulary }),
        ...(draft.declared === undefined ? {} : { declared: draft.declared }),
        ...(draft.unmatched === undefined ? {} : { unmatched: draft.unmatched }),
        ...(draft.coverage === undefined ? {} : { coverage: draft.coverage }),
    };
}

/** The draft's text: the shipped plan's slice structure, in the order given. */
export function renderPlanDraft(draft: PlanDraft): string {
    const valid: PlanDraft = validateDraft(draft);
    const doc: Record<string, unknown> = {
        slices: valid.slices.map((stub) => (stub.builds === "handoff" ? { story: stub.story, builds: stub.builds } : { ...stub })),
    };
    if (valid.vocabulary !== undefined) {
        doc["vocabulary"] = valid.vocabulary.map((entry) =>
            entry.aliases.length === 0 ? { id: entry.id, gloss: entry.gloss } : { id: entry.id, gloss: entry.gloss, aliases: [...entry.aliases] },
        );
    }
    if (valid.declared !== undefined) doc["declared"] = valid.declared.map((entry) => ({ ...entry }));
    if (valid.unmatched !== undefined) doc["unmatched"] = [...valid.unmatched];
    if (valid.coverage !== undefined) doc["coverage"] = { clean: valid.coverage.clean, gaps: valid.coverage.gaps.map((gap) => ({ ...gap })) };
    return stringify(doc, { indent: 4, flowCollectionPadding: false });
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
    return validateDraft({
        slices: Array.isArray(doc["slices"]) ? (doc["slices"] as PlanStub[]) : [],
        ...(Array.isArray(doc["vocabulary"])
            ? {
                  vocabulary: (doc["vocabulary"] as Partial<VocabularyEntry>[]).map(
                      (entry): VocabularyEntry => ({ id: String(entry.id), gloss: String(entry.gloss), aliases: Array.isArray(entry.aliases) ? entry.aliases.map(String) : [] }),
                  ),
              }
            : {}),
        ...(Array.isArray(doc["declared"])
            ? { declared: (doc["declared"] as Partial<DeclaredConcept>[]).map((entry): DeclaredConcept => ({ concept: String(entry.concept), phrase: String(entry.phrase) })) }
            : {}),
        ...(Array.isArray(doc["unmatched"]) ? { unmatched: (doc["unmatched"] as unknown[]).map(String) } : {}),
        ...(typeof doc["coverage"] === "object" && doc["coverage"] !== null
            ? {
                  coverage: {
                      clean: (doc["coverage"] as CoverageVerdict).clean === true,
                      gaps: (((doc["coverage"] as CoverageVerdict).gaps ?? []) as CoverageGap[]).map((gap): CoverageGap => ({
                          concept: String(gap.concept),
                          story: Number(gap.story),
                          ...(gap.handedOff === undefined ? {} : { handedOff: Number(gap.handedOff) }),
                      })),
                  },
              }
            : {}),
    });
}
