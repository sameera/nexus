/**
 * The interview that establishes where the learner is starting from (epic #455, story #472).
 *
 * Two things a teaching stage needs are written down nowhere: what the person reading a repository
 * already understands, and why they opened it. No amount of reading the checkout produces either,
 * so the stage asks — once, in a bounded interview, before it plans anything.
 *
 * Bounded means a **fixed slate of slots the stage owns** (record #478). Code declares the slate,
 * owns its count, owns the once-per-roadmap check and owns the write; an agent phrases each slot
 * against the roadmap's material and reads the free-text answer back, and it can neither add a slot
 * nor reorder the slate nor repeat one. Every guarantee this epic makes — at most five questions,
 * one interview per roadmap, no later phase asking again — is a fact about a repository, and epic
 * #407's lesson is that a fact an agent asserts about a repository is neither verifiable nor
 * repeatable. A slate also turns "asks about none of the stories, bodies or edges the roadmap
 * already holds" into a property of what the stage is *able* to ask.
 *
 * What comes back is recorded in the learner's own terms, slot by slot, with an explicit answered
 * or unanswered mark. It resolves nothing to a concept identifier: the concept vocabulary does not
 * exist yet, and inventing one here would give one idea two namespaces. And "did not say" is not
 * "knows nothing" — reading it that way would make the plan teach from scratch material the learner
 * knows well, silently, from a record that looks complete.
 *
 * The second thing the stage has to ask — what the learner came here to learn — is a slot in this
 * same slate (story #473). Both questions go to the same person, and every later phase reads both
 * answers, so splitting the interview in two would buy nothing and would make the learner answer
 * twice. Making focus a slot is also what makes it structurally impossible to ask twice. A learner
 * who names no focus has the whole roadmap written into the record as in focus, explicitly: an
 * absent field forces every later reader to re-derive the default, and the first one that forgets
 * reads "no focus" as "nothing in focus" and hands off the entire roadmap.
 */

import { type Runner, defaultRunner } from "@nexus/workspace/run";
import { readLearnerRecord, writeLearnerRecord } from "./learner-store.js";
import { type Roadmap } from "./roadmap.js";

/** The slot that establishes what the learner came to learn. One of the five, never a second pass. */
export const FOCUS_SLOT: string = "focus";

/** The ceiling this epic sets on the interview. The slate never grows past it. */
export const INTERVIEW_SLOT_CAP: number = 5;

/**
 * The slots that record what the learner already knows, and the only ones a later stage may read a
 * declaration of prior knowledge from (record #562, invariant 6).
 *
 * `focus` is excluded because what the learner came to learn is focus rather than knowledge, and it
 * has already done its work in the marking pass. `recent-difficulty` is excluded because it is the
 * slot most likely to name a concept in the learner's own words while meaning the opposite of
 * knowing it — matching against it would remove precisely the teaching the learner needs most, taken
 * from the answer they gave most concretely.
 */
export const KNOWLEDGE_SLOTS: readonly string[] = ["stack-experience", "codebase-familiarity", "testing-practice"];

/** One question the stage is able to ask. The agent phrases it; it cannot invent another. */
export interface InterviewSlot {
    /** The slot's stable identifier, which the recorded answer is filed under. */
    id: string;
    /** What the slot is for, in the stage's own words. The agent phrases the question from this. */
    asks: string;
}

/**
 * The slate, declared here and nowhere else.
 *
 * None of these asks for anything the roadmap already holds — the stories, their bodies and the
 * edges between them are resolved, not asked about. They ask only about the person, which is the
 * one thing no checkout records.
 */
const SLATE: readonly InterviewSlot[] = [
    {
        id: "stack-experience",
        asks: "how much the learner has built before in the languages, frameworks and tools this repository uses",
    },
    {
        id: "codebase-familiarity",
        asks: "how well the learner already knows this repository — whether they have read it, changed it, or are meeting it now",
    },
    {
        id: "testing-practice",
        asks: "how the learner has worked with tests before, since every slice is taught test-first",
    },
    {
        id: "recent-difficulty",
        asks: "what the learner most recently found hard or had to look up, which says more than a self-rating does",
    },
    {
        id: FOCUS_SLOT,
        asks: "what the learner came here to learn, when the roadmap also carries work they did not come to build",
    },
];

/**
 * The slate the stage asks from. It takes no argument, which is the point: the questions the stage
 * is able to ask do not vary with the roadmap, so none of them can ask for roadmap material.
 */
export function interviewSlate(): readonly InterviewSlot[] {
    return SLATE;
}

/** One slot's outcome: what was asked, what the learner said, and whether they said anything. */
export interface SlotAnswer {
    slot: string;
    /** The question as the agent phrased it, kept so a later reader sees what was actually asked. */
    question: string;
    /** The learner's own words. Empty exactly when the slot is unanswered. */
    answer: string;
    /** False when the learner left the slot alone — never the same as answering negatively. */
    answered: boolean;
}

/** What the learner came to learn, and what that leaves in scope. */
export interface InterviewFocus {
    /** The learner's own words, or "" when they named no focus. */
    stated: string;
    /** True when no focus was named, which puts the whole roadmap in focus. */
    whole: boolean;
    /**
     * Every story the roadmap holds, written out when the focus is the whole roadmap so that no
     * later reader re-derives the default. Null — never empty — when the learner named a focus:
     * which slices fall inside it is a judgement this epic does not make, and an empty list here
     * would read as "nothing is in focus".
     */
    stories: number[] | null;
}

/** One roadmap's interview: every slot of the slate, answered or not, and the focus it established. */
export interface InterviewRecord {
    roadmap: string;
    slots: SlotAnswer[];
    focus: InterviewFocus;
}

/** What an agent hands back after asking: one entry per slot it got an answer for. */
export interface GivenAnswer {
    slot: string;
    question: string;
    answer?: string;
}

/** Raised instead of recording an answer to a question the stage cannot ask. */
export class UnknownInterviewSlot extends Error {
    constructor(slot: string) {
        super(
            `${JSON.stringify(slot)} is not a slot the interview declares. The slate is fixed — ` +
            `${SLATE.map((s) => s.id).join(", ")} — because a question nothing declared is a question ` +
            `nothing can check.`,
        );
        this.name = "UnknownInterviewSlot";
    }
}

/** Raised instead of asking a learner the same interview twice. */
export class InterviewAlreadyRecorded extends Error {
    constructor(roadmap: string) {
        super(
            `the roadmap ${roadmap} already has an interview. Exactly one exists per roadmap, and a ` +
            `later phase reads the recorded answers rather than asking again.`,
        );
        this.name = "InterviewAlreadyRecorded";
    }
}

/** The learner-folder record kind every interview is filed under. */
const KIND = "interview";

/** The file one roadmap's interview is recorded in. */
function recordName(roadmap: string): string {
    return `${roadmap}.json`;
}

/** The interview recorded for a roadmap, or null when it has not been run. */
export function readInterview(repoRoot: string, roadmap: string): InterviewRecord | null {
    const body: string | null = readLearnerRecord(repoRoot, KIND, recordName(roadmap));
    return body === null ? null : (JSON.parse(body) as InterviewRecord);
}

/**
 * Record one roadmap's interview.
 *
 * Every slot of the slate appears in the record, in slate order, whether or not the learner
 * answered it — a slot missing from the record and a slot the learner declined would otherwise read
 * the same. The write goes through the guarded learner-folder write, which asks git whether the
 * path is ignored on every write: an interview answer is a personal record, and one committed to a
 * shared repository cannot be taken back.
 */
export function recordInterview(repoRoot: string, roadmap: Roadmap, given: readonly GivenAnswer[], run: Runner = defaultRunner): InterviewRecord {
    if (readInterview(repoRoot, roadmap.name) !== null) throw new InterviewAlreadyRecorded(roadmap.name);

    const bySlot: Map<string, GivenAnswer> = new Map();
    for (const entry of given) {
        if (!SLATE.some((slot) => slot.id === entry.slot)) throw new UnknownInterviewSlot(entry.slot);
        bySlot.set(entry.slot, entry);
    }

    const slots: SlotAnswer[] = SLATE.map((slot): SlotAnswer => {
        const entry: GivenAnswer | undefined = bySlot.get(slot.id);
        const answer: string = (entry?.answer ?? "").trim();
        return {
            slot: slot.id,
            question: entry?.question ?? "",
            answer,
            answered: entry !== undefined && answer !== "",
        };
    });

    const stated: string = slots.find((slot) => slot.slot === FOCUS_SLOT)?.answer ?? "";
    const record: InterviewRecord = {
        roadmap: roadmap.name,
        slots,
        focus: {
            stated,
            whole: stated === "",
            stories: stated === "" ? roadmap.stories.map((story) => story.number) : null,
        },
    };
    writeLearnerRecord(repoRoot, KIND, recordName(roadmap.name), `${JSON.stringify(record, null, 4)}\n`, run);
    return record;
}
