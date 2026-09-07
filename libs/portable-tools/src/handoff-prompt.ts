/**
 * A handoff slice's prompt (epic #407, story #464): the session hands the exercise to a separate
 * coding-agent session and pauses, rather than building or teaching the slice itself.
 *
 * The prompt names exactly one story to build, and it names the repository, the branch, the epic,
 * the sibling slices to leave alone, and the two epic-level commands not to run — a coding agent
 * that closed the epic early would end the milestone before the learner finished it (decision
 * record #469, invariant 15). It is a personal record under the learner folder, never a page in
 * the workbook (invariant 17), so it can never appear as drift against the rendered lessons; the
 * pause itself is recorded through the existing handoff mechanism (`handoffs.ts`, epic #405) rather
 * than a second one built here.
 */

import { type Runner, defaultRunner } from "@nexus/close-migration/run";
import { type Handoff, recordHandoff } from "./handoffs.js";
import { writeLearnerRecord } from "./learner-store.js";
import { type TeachingPlan } from "./teaching-plan.js";

export interface HandoffContext {
    repo: string;
    branch: string;
    epic: number;
    story: number;
    /** The other slices of the plan, which the coding agent must not touch. */
    siblings: readonly number[];
}

/** Every other slice in the plan — the ones a handed-off coding agent must leave alone. */
export function siblingSlices(plan: TeachingPlan, story: number): number[] {
    return plan.slices.map((s) => s.story).filter((s) => s !== story);
}

/**
 * The prompt text, handed to the learner to run in a separate session. Plain prose: it is a
 * personal record, not a rendered page, so it carries no markup requirement either way, but it
 * stays readable as the reader's own copy-paste brief.
 */
export function renderHandoffPrompt(ctx: HandoffContext): string {
    const siblingList: string = ctx.siblings.length === 0 ? "(none)" : ctx.siblings.map((s) => `#${s}`).join(", ");
    return [
        `# Handoff: build story #${ctx.story}`,
        "",
        "Run this in a separate coding-agent session — not the workbook session.",
        "",
        `- Repository: ${ctx.repo}`,
        `- Branch: ${ctx.branch}`,
        `- Epic: #${ctx.epic}`,
        `- Story to build: #${ctx.story}`,
        `- Sibling slices to leave alone: ${siblingList}`,
        "",
        "Do not run `/nxs.analyze` or `/nxs.close`. The epic is not finished when this one slice is;",
        "those two commands are the lead's to run once the whole epic is built.",
    ].join("\n");
}

/**
 * Pause the session at a handoff slice: record the pause (`recordHandoff`) and write the prompt
 * beside it under the same learner-folder kind, so both live where everything the workbook retains
 * about a person lives, and neither is ever a page.
 *
 * The clock comes from the caller, like every other fact the session decides, so the pause it
 * records is the one artifact of a session a test can pin rather than the one it cannot.
 */
export function pauseForHandoff(
    repoRoot: string,
    workbook: string,
    ctx: HandoffContext,
    run: Runner = defaultRunner,
    now: () => string = () => new Date().toISOString(),
): { handoff: Handoff; promptPath: string } {
    const handoff: Handoff = recordHandoff(repoRoot, { story: String(ctx.story), workbook, recordedAt: now() }, run);
    const promptName: string = handoff.id.replace(/\.md$/, "-prompt.md");
    const promptPath: string = writeLearnerRecord(repoRoot, "handoffs", promptName, renderHandoffPrompt(ctx), run);
    return { handoff, promptPath };
}
