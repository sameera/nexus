/**
 * The cold drill (epic #407, story #462): a session opens by asking about something the learner
 * met a while ago, before it teaches anything new.
 *
 * Which concepts the learner has met, when they met them, and which have already been drilled are
 * all read from the committed lessons themselves, never from a personal record — the committed
 * lessons are the session's memory (decision record #469). The learner's own folder contributes
 * exactly one signal on top of that: how many hints they have taken on a concept, used only to rank
 * a drill that is already eligible. A first session with no lessons written yet, or no hint log at
 * all, behaves correctly by construction rather than by a special case, because the concept history
 * and the hint counts are both empty inputs this function already handles.
 *
 * "Cold" means the concept's most recent mention — whether it was introduced or drilled — is not
 * the lesson the learner has just finished. A concept only ever met in that last lesson would not
 * be a cold recall; it would be the thing they just read.
 */

/** One lesson's contribution to the concept history, in teaching order. */
export interface LessonConceptHistory {
    file: string;
    /** Concepts first taught in this lesson. */
    introduces: readonly string[];
    /** Concepts this lesson's own opening drill asked about. */
    drilled: readonly string[];
}

/** How many hints the learner has taken on a concept. Absent means never asked, i.e. zero. */
export type HintCounts = Readonly<Record<string, number>>;

/**
 * Choose the concept to drill at the start of the next session, or null when no concept is cold
 * enough to ask about — either nothing has been taught yet, or everything taught so far was taught
 * in the lesson the learner has just finished.
 *
 * Among concepts cold enough to ask about, the most overdue one wins — the one whose last mention
 * is furthest back. A tie (both last mentioned in the same lesson) is broken by whichever the
 * learner has taken more hints on, since that is the one worth checking on first; a further tie is
 * broken by name, so the choice is deterministic given the same history and the same hint counts
 * (invariant 22).
 */
export function chooseDrill(history: readonly LessonConceptHistory[], hints: HintCounts = {}): string | null {
    if (history.length === 0) return null;
    const lastLessonIndex: number = history.length - 1;

    const lastMention: Map<string, number> = new Map();
    history.forEach((lesson, index) => {
        for (const concept of [...lesson.introduces, ...lesson.drilled]) {
            lastMention.set(concept, index);
        }
    });

    const eligible: { concept: string; lastMentionIndex: number }[] = [...lastMention.entries()]
        .filter(([, index]) => index < lastLessonIndex)
        .map(([concept, index]) => ({ concept, lastMentionIndex: index }));

    if (eligible.length === 0) return null;

    eligible.sort((a, b) => {
        if (a.lastMentionIndex !== b.lastMentionIndex) return a.lastMentionIndex - b.lastMentionIndex;
        const hintDiff: number = (hints[b.concept] ?? 0) - (hints[a.concept] ?? 0);
        if (hintDiff !== 0) return hintDiff;
        return a.concept < b.concept ? -1 : a.concept > b.concept ? 1 : 0;
    });

    return eligible[0].concept;
}
