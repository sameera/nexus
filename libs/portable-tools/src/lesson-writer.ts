/**
 * The lesson written on arrival (epic #407, story #463): a session writes the one lesson the
 * learner is up to, and never before.
 *
 * Writing the whole workbook up front throws away the one input that makes a lesson fit its
 * reader — how the previous lesson went — so a lesson exists only once the learner has arrived at
 * it (decision record #469, invariant 1). This module holds the two checkable facts that make that
 * true: which slice the learner is up to (`resolveArrival`), and what its exercise half must name
 * (`renderExerciseSection`). The theory half's prose is the epic's one generative step and is
 * deliberately not decided here — an agent writes it from the brief this chain hands it.
 *
 * A slice's exercise is "finished" when its own pinning test passes (the same fact the fence probe
 * checks for a handoff, story #465), so the decision to advance past a written lesson is made from
 * that one fact rather than from a second, competing notion of "done".
 */

import { PREDICT_THEN_REVEAL_COMPONENT } from "./predict-then-reveal.js";
import { type PlanSlice, type TeachingPlan } from "./teaching-plan.js";
import { WIDGET_FENCE_INFO } from "./workbook-widgets.js";

/** What is on record for a lesson already written. */
export interface StagedLesson {
    story: number;
    /** Whether the pinning test this slice's exercise names currently passes. */
    pinningTestPassed: boolean;
}

/**
 * What the learner folder says about the pauses this workbook has taken. A handoff slice is behind
 * the learner once its handoff is resolved, and a session that is holding one open resumes there
 * rather than treating the next slice as fresh (story #464, invariant 18).
 */
export interface HandoffState {
    /** Stories whose handoff has been recorded and resolved — those slices are behind the learner. */
    resolved: readonly number[];
    /** The story of the one outstanding handoff, or null when none is open. */
    outstanding: number | null;
}

const NO_HANDOFFS: HandoffState = { resolved: [], outstanding: null };

export type ArrivalAction =
    | { kind: "resume"; story: number }
    | { kind: "write"; slice: PlanSlice }
    | { kind: "open"; story: number }
    | { kind: "handoff"; slice: PlanSlice }
    | { kind: "done" };

/**
 * Decide what a session does on arrival, walking the plan in order.
 *
 * An outstanding handoff comes first: the learner is returning from a pause, so the session resumes
 * at the story that was handed off and verifies it before anything else is taught. Nothing else is
 * decided while one is open, because a session that wrote a lesson or recorded a second pause here
 * would leave two agents writing and neither result attributable to either (invariant 18).
 *
 * Otherwise the first slice with no lesson yet is the frontier: a learner-built slice is written,
 * and a handoff slice is handed off (story #464) rather than written. A handoff slice whose pause
 * has been resolved is behind the learner and the walk carries on past it. A slice that already has
 * a lesson but has not yet been finished is opened again rather than rewritten (invariant 3) —
 * writing stops there, so at most one slice beyond those already taught ever holds an authored
 * lesson.
 */
export function resolveArrival(
    plan: TeachingPlan,
    written: readonly StagedLesson[],
    handoffs: HandoffState = NO_HANDOFFS,
): ArrivalAction {
    if (handoffs.outstanding !== null) return { kind: "resume", story: handoffs.outstanding };
    const byStory: Map<number, StagedLesson> = new Map(written.map((w) => [w.story, w]));
    for (const slice of plan.slices) {
        if (!slice.learnerBuilds) {
            if (handoffs.resolved.includes(slice.story)) continue;
            return { kind: "handoff", slice };
        }
        const lesson: StagedLesson | undefined = byStory.get(slice.story);
        if (lesson === undefined) return { kind: "write", slice };
        if (!lesson.pinningTestPassed) return { kind: "open", story: slice.story };
    }
    return { kind: "done" };
}

/** The facts an exercise names, all decided in code rather than left to the lesson's prose. */
export interface ExerciseFacts {
    story: number;
    branch: string;
    pinningTest: string;
    gradingCommand: string;
}

/**
 * Render the exercise half of a lesson: plain markdown, because an authored lesson may carry no
 * markup (the renderer refuses it).
 */
export function renderExerciseSection(facts: ExerciseFacts): string {
    const lines: string[] = [];
    lines.push(
        "## Exercise",
        "",
        `- **Story:** #${facts.story}`,
        `- **Branch:** \`${facts.branch}\``,
        `- **Pinning test to write first:** \`${facts.pinningTest}\``,
        `- **Grading command:** \`${facts.gradingCommand}\``,
    );
    return lines.join("\n");
}

/**
 * Render the drill that opens a lesson (story #462). It is a predict-then-reveal exercise on the
 * page rather than a question in the session's transcript: the page is the reading surface that
 * works offline and prints, and the transcript is neither readable later nor printable.
 *
 * The concept is chosen in code; the question and the answer are prose an agent wrote, and they are
 * quoted rather than interpolated raw so a colon or a quotation mark in either cannot reshape the
 * declaration the renderer parses.
 */
export function renderDrillSection(concept: string, question: string, answer: string): string {
    return [
        "## Warm-up",
        "",
        `Before anything new, a question about ${concept}.`,
        "",
        "```" + WIDGET_FENCE_INFO,
        `component: ${PREDICT_THEN_REVEAL_COMPONENT}`,
        "data:",
        `  question: ${JSON.stringify(question)}`,
        `  answer: ${JSON.stringify(answer)}`,
        "```",
    ].join("\n");
}

/** Everything the chain decided about the lesson it is about to write, handed to the agent. */
export interface LessonBrief {
    story: number;
    /** The lesson file this slice teaches into. */
    lesson: string;
    /** The lesson's title, which the plan's pinned story title supplies. */
    title: string;
    /** The concepts this slice teaches. */
    concepts: readonly string[];
    /** The concept to drill, chosen in code, or null when none was cold enough. */
    drill: string | null;
    exercise: ExerciseFacts;
}

/** The one generative step: the prose an agent contributes, and nothing else. */
export interface AuthoredProse {
    /** The theory half, in the lesson's markdown subset. */
    theory: string;
    /** The drill's question and the answer it withholds, required whenever a drill was chosen. */
    drill?: { question: string; answer: string };
}

/**
 * Assemble the lesson: the front matter and the exercise are decided here, the drill is placed
 * where the chain decided it goes, and the agent's prose sits between them. Every fact the lesson
 * asserts about the work comes from the plan rather than from the prose, so a lesson cannot name a
 * branch or a test the session did not choose.
 */
export function composeLesson(brief: LessonBrief, prose: AuthoredProse): string {
    if (brief.drill !== null && prose.drill === undefined) {
        throw new Error(
            `the drill on ${brief.drill} has no question and answer to reveal, so the lesson for ` +
            `#${brief.story} would ask something with nothing behind it. The chain chooses the ` +
            `concept; the question and the answer are the agent's to write.`,
        );
    }
    const frontMatter: string[] = [
        "---",
        `title: ${brief.title}`,
        `story: ${brief.story}`,
        ...(brief.concepts.length === 0 ? [] : [`concepts: [${brief.concepts.join(", ")}]`]),
        // The concept this lesson drilled, so the next session can see it was already asked about.
        // The committed lessons are the session's memory, so what was drilled is recorded on the
        // page rather than in a personal record no teammate's checkout holds (record #469).
        ...(brief.drill === null ? [] : [`drill: ${brief.drill}`]),
        "---",
        "",
    ];
    const drill: string[] =
        brief.drill === null || prose.drill === undefined
            ? []
            : [renderDrillSection(brief.drill, prose.drill.question, prose.drill.answer), ""];
    return [
        ...frontMatter,
        ...drill,
        prose.theory.trim(),
        "",
        renderExerciseSection(brief.exercise),
        "",
    ].join("\n");
}
