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

import { type PlanSlice, type TeachingPlan } from "./teaching-plan.js";

/** What is on record for a lesson already written. */
export interface StagedLesson {
    story: number;
    /** Whether the pinning test this slice's exercise names currently passes. */
    pinningTestPassed: boolean;
}

export type ArrivalAction =
    | { kind: "write"; slice: PlanSlice }
    | { kind: "open"; story: number }
    | { kind: "handoff"; slice: PlanSlice }
    | { kind: "done" };

/**
 * Decide what a session does on arrival, walking the plan in order.
 *
 * The first slice with no lesson yet is the frontier: a learner-built slice is written, and a
 * handoff slice is handed off (story #464) rather than written. A slice that already has a lesson
 * but has not yet been finished is opened again rather than rewritten (invariant 3) — writing
 * stops there, so at most one slice beyond those already taught ever holds an authored lesson.
 */
export function resolveArrival(plan: TeachingPlan, written: readonly StagedLesson[]): ArrivalAction {
    const byStory: Map<number, StagedLesson> = new Map(written.map((w) => [w.story, w]));
    for (const slice of plan.slices) {
        const lesson: StagedLesson | undefined = byStory.get(slice.story);
        if (lesson === undefined) {
            return slice.learnerBuilds ? { kind: "write", slice } : { kind: "handoff", slice };
        }
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
 * markup (the renderer refuses it). A drill concept, when one was chosen (story #462), opens the
 * lesson so a hint taken on it is asked about again rather than dropped.
 */
export function renderExerciseSection(facts: ExerciseFacts, drillConcept?: string | null): string {
    const lines: string[] = [];
    if (drillConcept !== undefined && drillConcept !== null && drillConcept.trim() !== "") {
        lines.push("## Warm-up", "", `Before anything new: what do you remember about **${drillConcept}**?`, "");
    }
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
