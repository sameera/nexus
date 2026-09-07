/**
 * The teaching plan's drift check (epic #407, story #460): a session refuses to teach a lesson for
 * a story that has moved since the plan was approved.
 *
 * A learner comes back to a repository that may have kept changing underneath the plan they are
 * following. Writing a lesson for a story that has since closed or been rewritten would teach
 * something nobody is building any more, so every slice's pinned state is compared against the
 * story's live issue state before its lesson is written (decision record #469, invariants 9, 24).
 *
 * The comparison covers only the story's title and body, whitespace normalized, and a finding names
 * which of the two moved and what it moved from and to (invariant 24) — labels, assignees
 * and comments do not trip it, because the reader of this signal is a learner in mid-flow, and a
 * check that fires on incidental churn is a check they learn to skip past. Drift on a slice other
 * than the one about to be taught is reported and the session teaches on regardless; only the next
 * slice's own drift blocks it.
 *
 * The live read is injected as a function rather than performed here, so the comparison itself
 * stays pure and testable, and an unreadable story is reported as *unverifiable* — never silently
 * treated as unchanged.
 */

/** The story's state as it was when the plan was approved. */
export interface PinnedStory {
    title: string;
    body: string;
}

/** One slice of the plan: the story it teaches, and the state that story was pinned to. */
export interface PlanSlice {
    story: number;
    learnerBuilds: boolean;
    pinned: PinnedStory;
}

export interface TeachingPlan {
    slices: readonly PlanSlice[];
}

/** A story's state as read from the issue graph right now. */
export interface LiveStory {
    title: string;
    body: string;
    closed: boolean;
}

/** Reads one story's live state. Returns null when the state could not be read. */
export type IssueReader = (story: number) => LiveStory | null;

export type DriftState = "closed" | "changed" | "unverifiable";

export interface DriftFinding {
    story: number;
    state: DriftState;
    detail: string;
}

function normalize(text: string): string {
    return text.trim().replace(/\s+/g, " ");
}

/** One field's value as a drift report shows it: quoted, and cut short if it is long. */
function quote(value: string): string {
    const single: string = normalize(value);
    return JSON.stringify(single.length <= 160 ? single : `${single.slice(0, 159)}…`);
}

/**
 * What changed about a story, field by field, quoted rather than executed or expanded (invariant
 * 13). A learner who is told only that "the title or body has changed" still has to go and diff the
 * issue by hand, which is the work the report exists to save them (invariant 24).
 */
function changes(pinned: PinnedStory, live: LiveStory): string[] {
    const found: string[] = [];
    if (normalize(live.title) !== normalize(pinned.title)) {
        found.push(`its title was ${quote(pinned.title)} and is now ${quote(live.title)}`);
    }
    if (normalize(live.body) !== normalize(pinned.body)) {
        found.push(`its description was ${quote(pinned.body)} and is now ${quote(live.body)}`);
    }
    return found;
}

function driftFor(slice: PlanSlice, live: LiveStory | null): DriftFinding | null {
    if (live === null) {
        return {
            story: slice.story,
            state: "unverifiable",
            detail: `#${slice.story} could not be read, so its plan state could not be verified.`,
        };
    }
    if (live.closed) {
        return { story: slice.story, state: "closed", detail: `#${slice.story} has been closed since the plan was pinned.` };
    }
    const changed: string[] = changes(slice.pinned, live);
    if (changed.length > 0) {
        return {
            story: slice.story,
            state: "changed",
            detail: `#${slice.story} has changed since the plan was pinned: ${changed.join("; and ")}.`,
        };
    }
    return null;
}

/** Every slice whose live state no longer matches what the plan pinned, in plan order. */
export function checkPlanDrift(plan: TeachingPlan, read: IssueReader): DriftFinding[] {
    const findings: DriftFinding[] = [];
    for (const slice of plan.slices) {
        const finding: DriftFinding | null = driftFor(slice, read(slice.story));
        if (finding !== null) findings.push(finding);
    }
    return findings;
}

/** Whether the next lesson may be written, and everything drift found while deciding that. */
export interface LessonGate {
    /** True when the slice about to be taught has itself drifted or could not be verified. */
    blocked: boolean;
    /** The finding that blocked the gate, or null when the next slice is clear to teach. */
    finding: DriftFinding | null;
    /** Every drift finding across the whole plan, reported whether or not it blocks. */
    findings: DriftFinding[];
}

/**
 * Gate the next lesson. Only drift on `nextStory` itself blocks teaching it — drift found on a
 * later slice is still returned in `findings` so the session can report it, but it does not stop
 * the current lesson from being written.
 */
export function gateNextLesson(plan: TeachingPlan, nextStory: number, read: IssueReader): LessonGate {
    const findings: DriftFinding[] = checkPlanDrift(plan, read);
    const finding: DriftFinding | null = findings.find((f) => f.story === nextStory) ?? null;
    return { blocked: finding !== null, finding, findings };
}
