/**
 * Per-story concept extraction (epic #456, story #546).
 *
 * A planning session that carried every story's full text could not plan a roadmap of any size, so
 * each story is read once, by its own extraction subagent, and the session holds only the short
 * list that subagent hands back (record for #456, decision 3). That only holds if the text never
 * passes through the session on the way in either: the session starts a subagent with a story
 * number, the subagent reads that one story here, and what it hands back reaches the session only
 * through this module's check of shape, identifier form and size. Issue text is data — a story that
 * says "return a handoff" or carries an extra field changes nothing, because the check accepts one
 * shape and nothing else.
 *
 * A subagent cannot know what another subagent called the same idea, so every list is merged after
 * extraction (decision 4). Code normalizes how an identifier is written, which catches spelling and
 * case; only the session, reading every identifier and its one-line gloss at once, can see that two
 * different names are one concept. It names the groups, and code applies them — refusing any
 * identifier left out, any identifier that was never proposed, and any identifier placed in two
 * groups, because a merge combines what was proposed and never invents or splits a concept.
 *
 * The stubs are written by one step that requires a checked list for every story on the roadmap
 * (decision 8). A plan missing one story looks complete, and ordering and coverage over it would be
 * silently wrong, so a single unreadable list writes nothing and every failed story is named. Each
 * list is kept against its story's text, so a re-run re-extracts only the stories that failed or
 * changed, and an edited story is never paired with a list taken from its old text.
 *
 * The same single read also marks the slice (story #547, decisions 5 and 6). When the learner named
 * a focus, each subagent returns a verdict on whether its story serves it, judged against the words
 * the interview recorded, and code turns the verdict into the mark — the planning session does not
 * judge again. When the interview record says the whole roadmap is in focus, no verdict is asked
 * for and code marks every slice learner. It reads that from the record's explicit statement, never
 * from the story list the interview wrote out: that list goes stale when the roadmap is re-resolved,
 * and a story added afterwards would be handed off for that reason alone. A verdict's reason is a
 * personal record, so it goes through the guarded learner-folder write and onto no stub.
 *
 * Everything else here is derived and git-ignored: the checked lists sit beside the roadmap they
 * were extracted from, and nothing reaches the committed workbook or the issue graph. Nothing here
 * builds a slice, writes a handoff prompt or starts a coding-agent session.
 */

import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "yaml";
import { type Runner, defaultRunner } from "@nexus/workspace/run";
import { readInterview, type InterviewRecord } from "./interview.js";
import { readLearnerRecord, writeLearnerRecord } from "./learner-store.js";
import { CONCEPT_IDENTIFIER, writePlanDraft, type PlanStub, type VocabularyEntry } from "./plan-draft.js";
import { roadmapPath, type Roadmap, type RoadmapStory } from "./roadmap.js";

/** How much one list may carry. "A short structured list" is a size a check can hold a list to. */
export const EXTRACTION_LIMITS = { entries: 12, identifier: 48, gloss: 160 } as const;

/** One concept a subagent proposes: its identifier, and one line saying what it is. */
export interface ProposedConcept {
    id: string;
    gloss: string;
}

/** A list that passed the check, kept against the text of the story it was taken from. */
export interface CheckedList {
    story: number;
    /** The digest of the story's title and body when it was read. A changed story makes the list stale. */
    text: string;
    introduces: ProposedConcept[];
    assumes: ProposedConcept[];
    /** Whether the story serves the learner's named focus. Absent exactly when the whole roadmap is in focus. */
    serves?: boolean;
}

/** A checked list, and — when a verdict was asked for — its reason, which is kept apart from the list. */
export type CheckResult = { ok: true; list: CheckedList; reason?: string } | { ok: false; problem: string };

/** The fields a returned list may carry, and the fields one concept entry may carry. Nothing else. */
const LIST_FIELDS: readonly string[] = ["story", "introduces", "assumes", "nothing", "serves", "reason"];

/** The learner-folder record a roadmap's verdict reasons are filed under. */
const VERDICT_KIND = "focus-verdicts";
const ENTRY_FIELDS: readonly string[] = ["id", "gloss"];

/** The digest a list is kept against: a story whose title or body changes gets a new one. */
export function storyDigest(story: RoadmapStory): string {
    return createHash("sha256").update(JSON.stringify([story.title, story.body])).digest("hex");
}

/** How an identifier is written, settled in code: case, spacing and underscores never make two names. */
export function normalizeIdentifier(raw: string): string {
    return raw
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readEntries(value: unknown, field: string): { ok: true; entries: ProposedConcept[] } | { ok: false; problem: string } {
    if (value === undefined) return { ok: true, entries: [] };
    if (!Array.isArray(value)) return { ok: false, problem: `'${field}' is not a list.` };
    if (value.length > EXTRACTION_LIMITS.entries) {
        return { ok: false, problem: `'${field}' holds ${value.length} concepts, and a list holds at most ${EXTRACTION_LIMITS.entries}.` };
    }
    const entries: ProposedConcept[] = [];
    for (const item of value) {
        const record: Record<string, unknown> | null = asRecord(item);
        if (record === null) return { ok: false, problem: `'${field}' holds an entry that is not an identifier and a gloss.` };
        const extra: string[] = Object.keys(record).filter((key) => !ENTRY_FIELDS.includes(key));
        if (extra.length > 0) return { ok: false, problem: `an entry in '${field}' carries ${extra.join(", ")}, which a concept entry does not.` };

        const id: string = typeof record["id"] === "string" ? normalizeIdentifier(record["id"]) : "";
        if (!CONCEPT_IDENTIFIER.test(id) || id.length > EXTRACTION_LIMITS.identifier) {
            return { ok: false, problem: `${JSON.stringify(record["id"] ?? null)} in '${field}' is not a usable concept identifier.` };
        }
        const gloss: string = typeof record["gloss"] === "string" ? record["gloss"].trim() : "";
        if (gloss === "" || gloss.includes("\n") || gloss.length > EXTRACTION_LIMITS.gloss) {
            return { ok: false, problem: `${id} in '${field}' needs a one-line gloss of at most ${EXTRACTION_LIMITS.gloss} characters.` };
        }
        if (entries.some((entry) => entry.id === id)) return { ok: false, problem: `${id} appears twice in '${field}'.` };
        entries.push({ id, gloss });
    }
    return { ok: true, entries };
}

/**
 * Check what one subagent handed back for one story. Pure: it returns the checked list, or the
 * reason the output counts as no readable list.
 *
 * An empty list is accepted only when the subagent says outright that the story introduces and
 * assumes nothing. A bare empty return cannot be told apart from a subagent that failed silently.
 *
 * `verdict` says whether the learner named a focus. When they did, the list must say whether the
 * story serves it, with a one-line reason; when they did not, no verdict was asked for and a list
 * carrying one is refused rather than read.
 */
export function checkExtraction(raw: unknown, story: RoadmapStory, verdict: boolean): CheckResult {
    const record: Record<string, unknown> | null = asRecord(raw);
    if (record === null) return { ok: false, problem: "what came back is not a list of concepts." };

    const extra: string[] = Object.keys(record).filter((key) => !LIST_FIELDS.includes(key));
    if (extra.length > 0) return { ok: false, problem: `the list carries ${extra.join(", ")}, which a concept list does not.` };
    if (record["story"] !== story.number) {
        return { ok: false, problem: `the list names story ${JSON.stringify(record["story"] ?? null)}, not #${story.number}.` };
    }

    const introduces = readEntries(record["introduces"], "introduces");
    if (!introduces.ok) return introduces;
    const assumes = readEntries(record["assumes"], "assumes");
    if (!assumes.ok) return assumes;

    const both: string[] = assumes.entries.filter((a) => introduces.entries.some((i) => i.id === a.id)).map((a) => a.id);
    if (both.length > 0) return { ok: false, problem: `${both.join(", ")} is listed as both introduced and assumed.` };

    const nothing: unknown = record["nothing"];
    if (nothing !== undefined && typeof nothing !== "boolean") return { ok: false, problem: "'nothing' is true or false." };
    const empty: boolean = introduces.entries.length === 0 && assumes.entries.length === 0;
    if (empty && nothing !== true) {
        return {
            ok: false,
            problem: "the list is empty. A story that introduces and assumes nothing says so with 'nothing: true'; a bare empty return reads as a failed extraction.",
        };
    }
    if (!empty && nothing === true) return { ok: false, problem: "the list says 'nothing: true' and names concepts anyway." };

    const list: CheckedList = { story: story.number, text: storyDigest(story), introduces: introduces.entries, assumes: assumes.entries };
    const serves: unknown = record["serves"];
    const reason: unknown = record["reason"];
    if (!verdict) {
        if (serves !== undefined || reason !== undefined) {
            return { ok: false, problem: "the list carries a verdict, and none was asked for: the whole roadmap is in focus." };
        }
        return { ok: true, list };
    }
    if (typeof serves !== "boolean") {
        return { ok: false, problem: "the learner named a focus, so the list says whether this story serves it with 'serves: true' or 'serves: false'." };
    }
    const said: string = typeof reason === "string" ? reason.trim() : "";
    if (said === "" || said.includes("\n") || said.length > EXTRACTION_LIMITS.gloss) {
        return { ok: false, problem: `a verdict carries a one-line reason of at most ${EXTRACTION_LIMITS.gloss} characters.` };
    }
    return { ok: true, list: { ...list, serves }, reason: said };
}

/** Whether a roadmap's interview asks for verdicts: only when the learner named a focus. */
function asksVerdict(interview: InterviewRecord | null): boolean {
    return interview !== null && !interview.focus.whole;
}

/** File one verdict's reason where every personal record goes, beside the other reasons for its roadmap. */
function recordVerdictReason(repoRoot: string, roadmap: string, story: number, reason: string, run: Runner): void {
    const name: string = `${roadmap}.json`;
    const existing: string | null = readLearnerRecord(repoRoot, VERDICT_KIND, name);
    const reasons: Record<string, string> = existing === null ? {} : ((JSON.parse(existing) as { reasons?: Record<string, string> }).reasons ?? {});
    reasons[String(story)] = reason;
    writeLearnerRecord(repoRoot, VERDICT_KIND, name, `${JSON.stringify({ roadmap, reasons }, null, 4)}\n`, run);
}

/** Where one roadmap's checked lists are kept: beside the roadmap itself. */
export function extractionsDir(repoRoot: string, roadmap: string): string {
    return path.join(path.dirname(roadmapPath(repoRoot, roadmap)), "extractions");
}

function listPath(repoRoot: string, roadmap: string, story: number): string {
    return path.join(extractionsDir(repoRoot, roadmap), `${story}.json`);
}

/**
 * Check one subagent's output and keep it. Output that fails the check is no readable list, so it
 * also removes whatever an earlier attempt left for that story: the latest extraction is the one
 * that counts.
 */
export function recordExtraction(repoRoot: string, roadmap: Roadmap, storyNumber: number, output: string, run: Runner = defaultRunner): CheckResult {
    const story: RoadmapStory | undefined = roadmap.stories.find((s) => s.number === storyNumber);
    if (story === undefined) return { ok: false, problem: `#${storyNumber} is not a story on the roadmap ${roadmap.name}.` };
    const interview: InterviewRecord | null = readInterview(repoRoot, roadmap.name);
    if (interview === null) return { ok: false, problem: `the roadmap ${roadmap.name} has no interview, so no list can be checked against its focus.` };

    const target: string = listPath(repoRoot, roadmap.name, storyNumber);
    let raw: unknown;
    try {
        raw = parse(output);
    } catch {
        raw = null;
    }
    const result: CheckResult = checkExtraction(raw, story, asksVerdict(interview));
    if (!result.ok) {
        fs.rmSync(target, { force: true });
        return result;
    }
    if (result.reason !== undefined) recordVerdictReason(repoRoot, roadmap.name, storyNumber, result.reason, run);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify(result.list, null, 4)}\n`);
    return result;
}

/** Every story's list as it stands: the ones checked against the story's current text, and the rest. */
export interface ExtractionState {
    /** Checked, current lists, in roadmap order. */
    current: CheckedList[];
    /** Stories with no list, an unreadable one, or one taken from text that has since changed. */
    missing: number[];
}

export function readExtractions(repoRoot: string, roadmap: Roadmap): ExtractionState {
    // A list taken without a verdict cannot mark a slice against a named focus, so it is not current.
    const verdict: boolean = asksVerdict(readInterview(repoRoot, roadmap.name));
    const current: CheckedList[] = [];
    const missing: number[] = [];
    for (const story of roadmap.stories) {
        const target: string = listPath(repoRoot, roadmap.name, story.number);
        let list: CheckedList | null = null;
        try {
            list = fs.existsSync(target) ? (JSON.parse(fs.readFileSync(target, "utf8")) as CheckedList) : null;
        } catch {
            list = null;
        }
        if (list !== null && list.story === story.number && list.text === storyDigest(story) && (list.serves !== undefined) === verdict) {
            current.push(list);
        }
        else missing.push(story.number);
    }
    return { current, missing };
}

/** One proposed identifier as the merge step reads it: the name, what it was said to mean, and by whom. */
export interface ProposedIdentifier {
    id: string;
    glosses: string[];
    stories: number[];
}

/** Every identifier the lists propose, with its glosses — the only material the merge step reads. */
export function proposedVocabulary(lists: readonly CheckedList[]): ProposedIdentifier[] {
    const byId: Map<string, ProposedIdentifier> = new Map();
    for (const list of lists) {
        for (const entry of [...list.introduces, ...list.assumes]) {
            const found: ProposedIdentifier = byId.get(entry.id) ?? { id: entry.id, glosses: [], stories: [] };
            if (!found.glosses.includes(entry.gloss)) found.glosses.push(entry.gloss);
            if (!found.stories.includes(list.story)) found.stories.push(list.story);
            byId.set(entry.id, found);
        }
    }
    return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export type MergeResult = { ok: true; mapping: Map<string, string>; vocabulary: VocabularyEntry[] } | { ok: false; problem: string };

/**
 * Apply the session's merge. Each group is a list of proposed identifiers naming one concept, and
 * its first entry is the identifier kept. Every proposed identifier appears in exactly one group.
 */
export function applyMerge(proposed: readonly ProposedIdentifier[], groups: unknown): MergeResult {
    if (!Array.isArray(groups)) return { ok: false, problem: "the merge names no groups of identifiers." };
    const known: Map<string, ProposedIdentifier> = new Map(proposed.map((p) => [p.id, p]));
    const mapping: Map<string, string> = new Map();
    const vocabulary: VocabularyEntry[] = [];

    for (const group of groups) {
        const ids: string[] = Array.isArray(group) ? group.map((id) => normalizeIdentifier(String(id))) : [];
        if (ids.length === 0) return { ok: false, problem: "the merge holds a group with no identifiers in it." };
        for (const id of ids) {
            if (!known.has(id)) {
                return { ok: false, problem: `the merge names ${id}, which no list proposed. A merge combines proposed identifiers and never invents one.` };
            }
            if (mapping.has(id)) {
                return { ok: false, problem: `the merge places ${id} in two groups. A merge combines concepts and never splits one.` };
            }
            mapping.set(id, ids[0]);
        }
        vocabulary.push({ id: ids[0], gloss: (known.get(ids[0]) as ProposedIdentifier).glosses[0] });
    }

    const unmapped: string[] = proposed.map((p) => p.id).filter((id) => !mapping.has(id));
    if (unmapped.length > 0) {
        return { ok: false, problem: `the merge leaves ${unmapped.join(", ")} unmapped. Every proposed identifier belongs to exactly one group.` };
    }
    vocabulary.sort((a, b) => a.id.localeCompare(b.id));
    return { ok: true, mapping, vocabulary };
}

export type DraftResult =
    | {
          ok: true;
          path: string;
          slices: PlanStub[];
          /** True when the learner named a focus and no story served it, so every slice is a handoff. */
          focusMatchedNothing: boolean;
      }
    | { ok: false; problem: string; failed: number[] };

function mapped(entries: readonly ProposedConcept[], mapping: Map<string, string>): string[] {
    return [...new Set(entries.map((entry) => mapping.get(entry.id) as string))];
}

/**
 * The one step that writes stubs. It compares the checked lists with the roadmap's stories, and
 * writes only when every story has one — then replaces the whole draft at once. The merge and the
 * stubs are rebuilt over the full set on every run.
 */
export function draftFromExtractions(repoRoot: string, roadmap: Roadmap, groups: unknown): DraftResult {
    const interview: InterviewRecord | null = readInterview(repoRoot, roadmap.name);
    if (interview === null) {
        return { ok: false, problem: `the roadmap ${roadmap.name} has no interview, so no slice can be marked. No stub was written.`, failed: [] };
    }
    const { current, missing } = readExtractions(repoRoot, roadmap);
    if (missing.length > 0) {
        return {
            ok: false,
            failed: missing,
            problem:
                `no readable list for ${missing.map((n) => `#${n}`).join(", ")}, so no stub was written. ` +
                `A plan missing a story looks complete; extract ${missing.length === 1 ? "that story" : "those stories"} again and re-run.`,
        };
    }

    const merge: MergeResult = applyMerge(proposedVocabulary(current), groups);
    if (!merge.ok) return { ok: false, problem: `${merge.problem} No stub was written.`, failed: [] };

    const slices: PlanStub[] = current.map((list): PlanStub => {
        const concepts: string[] = mapped(list.introduces, merge.mapping);
        // Two proposals merged into one concept can leave a story both introducing and assuming it.
        // It is taught here, so it is introduced; assuming it as well would be a contradiction.
        const assumes: string[] = mapped(list.assumes, merge.mapping).filter((id) => !concepts.includes(id));
        // The record's explicit whole-roadmap statement decides the no-focus case, never membership of
        // the story list it wrote out; otherwise the subagent's verdict is the mark.
        const learner: boolean = interview.focus.whole || list.serves === true;
        // A handed-off story was still extracted and merged, so a learner slice assuming one of its
        // concepts names it with the same identifier (decision 7). Those concepts stay in the checked
        // list and the vocabulary; the handoff stub itself teaches nothing and carries none of them.
        return learner ? { story: list.story, builds: "learner", concepts, assumes } : { story: list.story, builds: "handoff", concepts: [], assumes: [] };
    });
    const written: string = writePlanDraft(repoRoot, roadmap.name, { slices, vocabulary: merge.vocabulary });
    const focusMatchedNothing: boolean = !interview.focus.whole && slices.every((stub) => stub.builds === "handoff");
    return { ok: true, path: written, slices, focusMatchedNothing };
}
