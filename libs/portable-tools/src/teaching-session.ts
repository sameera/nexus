/**
 * The teaching session (epic #407, decision record #469): one run per sitting, from the sweep that
 * opens it to the single lesson it writes.
 *
 * Everything the epic guarantees is a fact about a repository, and a fact an agent asserts about a
 * repository is unverifiable and unrepeatable. So the session is a fixed chain decided in code:
 * sweep the probe's scratch path, resolve where the learner is from the lessons already written,
 * run the declared suite, verify the fence when returning from a pause, check the next slice
 * against the state it was pinned to, choose the drill, and then write one lesson or hand a fenced
 * prompt to a separate coding agent and pause.
 *
 * Exactly one step in that chain produces judgement: the lesson's prose. The chain hands out a
 * brief naming the story, the concepts, the drill it chose and the exercise's facts, and takes the
 * prose back on the next call. Running the chain twice over an unchanged repository reaches the
 * same verdict and hands out the same brief (invariant 22), which is what makes a session
 * something a test can assert about rather than something a transcript reports.
 *
 * The session moves no git state. It writes files under the workbook and the learner folder, names
 * the branch the learner works on, and creates, switches, merges, commits and pushes nothing
 * (invariant 12) — the return checks have to verify a tree the session did not itself change.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { type Runner, defaultRunner } from "@nexus/workspace/run";
import { chooseDrill, conceptsToRevisit, type HintCounts, type LessonConceptHistory } from "./drill-selection.js";
import {
    interpretReturn,
    proveProbe,
    runProbe,
    runSuite,
    renderBreachReport,
    renderUncheckedReport,
    sweepProbe,
    type FenceState,
    type ProbeProof,
    type SuiteResult,
} from "./fence-probe.js";
import { allHandoffs, resolveHandoff, type Handoff } from "./handoffs.js";
import { pauseForHandoff, siblingSlices } from "./handoff-prompt.js";
import { readLearnerRecord } from "./learner-store.js";
import {
    composeLesson,
    resolveArrival,
    renderExerciseSection,
    type ArrivalAction,
    type AuthoredProse,
    type HandoffState,
    type LessonBrief,
    type StagedLesson,
} from "./lesson-writer.js";
import { gateNextLesson, type DriftFinding, type IssueReader, type LessonGate, type TeachingPlan } from "./teaching-plan.js";
import { planStubs, toTeachingPlan, type PlanSliceRecord, type WorkbookPlan } from "./workbook-plan.js";
import { parseLesson, pageNameFor, renderWorkbookInto, type Lesson, type LessonSource } from "./workbook-render.js";
import { lessonsDir, readLessons, readWorkbookPlan, workbookRoot, writtenLessonFiles } from "./workbook-store.js";

/** The learner record the drill's ranking reads: how many hints were taken, by concept. */
export const HINT_LOG_FILENAME: string = "hints.json";

export interface SessionInputs {
    repoRoot: string;
    slug: string;
    /** Reads a story's live issue state. The session never fetches it itself. */
    read: IssueReader;
    /** The prose an agent wrote for the lesson the previous run briefed. */
    prose?: AuthoredProse;
    run?: Runner;
    /** The clock, injected so a session's records are reproducible in a test. */
    now?: () => string;
}

export type SessionOutcome =
    | { kind: "no-plan"; report: string }
    | { kind: "suite-red"; report: string; output: string }
    | { kind: "unintegrated"; story: number; report: string }
    | { kind: "unplanned-handoff"; story: number; report: string }
    | { kind: "unchecked"; story: number; report: string }
    | { kind: "breach"; story: number; report: string }
    | { kind: "drift"; finding: DriftFinding; report: string }
    | { kind: "handoff"; story: number; promptPath: string; report: string }
    | { kind: "brief"; brief: LessonBrief; report: string }
    | { kind: "written"; story: number; lesson: string; page: string; report: string }
    | { kind: "open"; story: number; page: string; report: string }
    | { kind: "done"; report: string };

export interface SessionResult {
    outcome: SessionOutcome;
    /** Every drift the check found, whether or not it blocked. Reported; only the next slice blocks. */
    drift: DriftFinding[];
    /** What the session could not read under the learner folder. Reported and skipped, never fatal. */
    skipped: string[];
    /**
     * What the session checked and found in order. A clean check says so here rather than saying
     * nothing at all: a learner who is told only when something is wrong cannot tell a check that
     * passed from a check that never ran (story #460's third criterion).
     */
    notes: string[];
}

/** The concepts one written lesson contributes to the history the drill is chosen from. */
function conceptsOf(lesson: Lesson): LessonConceptHistory {
    const declared: unknown = lesson.frontMatter["concepts"];
    const drilled: unknown = lesson.frontMatter["drill"];
    return {
        file: lesson.file,
        introduces: Array.isArray(declared) ? declared.map((c) => String(c)) : [],
        drilled: typeof drilled === "string" && drilled.trim() !== "" ? [drilled] : [],
    };
}

/**
 * How many hints the learner has taken, by concept — what ranks the drill, and what says which
 * ideas the last lesson left them struggling with. Every read of the learner folder is total
 * (invariant 6): an absent log is an empty history, and a log that cannot be read is reported and
 * skipped rather than failing the session — the drill then falls back to the most overdue concept
 * and nothing is asked about again, and the learner is told so rather than finding out from a
 * worse lesson.
 */
function readHints(repoRoot: string, skipped: string[]): HintCounts {
    let raw: string | null = null;
    try {
        raw = readLearnerRecord(repoRoot, "hint-log", HINT_LOG_FILENAME);
    } catch {
        raw = null;
    }
    if (raw === null) return {};
    try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("not a record");
        const counts: Record<string, number> = {};
        for (const [concept, count] of Object.entries(parsed as Record<string, unknown>)) {
            counts[concept] = Number(count) || 0;
        }
        return counts;
    } catch {
        skipped.push(
            `the hint log could not be read, so the drill fell back to the concept you met longest ` +
            `ago rather than the ones you have asked for most help on, and nothing from your last ` +
            `lesson is asked about again.`,
        );
        return {};
    }
}

/** The story a handoff record names, as a number. Handoff records carry it as the learner wrote it. */
function storyNumber(handoff: Handoff): number {
    return Number(handoff.story.replace(/^#/, ""));
}

/**
 * What the learner folder says about this workbook's pauses. A record names the workbook it paused
 * in, and only that workbook's own records are read here: "at most one handoff is outstanding" is a
 * per-workbook rule (invariant 18), and claiming a record that names no workbook would let one
 * workbook resume at another's pause.
 */
function handoffState(repoRoot: string, slug: string): { state: HandoffState; open: Handoff | null } {
    const mine: Handoff[] = allHandoffs(repoRoot).filter((h) => h.workbook === slug);
    const open: Handoff | null = mine.find((h) => h.resolvedAt === null) ?? null;
    return {
        state: {
            resolved: mine.filter((h) => h.resolvedAt !== null).map(storyNumber),
            outstanding: open === null ? null : storyNumber(open),
        },
        open,
    };
}

/**
 * A slice's exercise is finished when the learner has written the pinning test where the lesson
 * said to write it. That is the one text the lesson and the fence probe already share, so it is
 * reused here rather than inventing a second notion of "done" — and grading is another epic's.
 *
 * Whether the tree is green is deliberately no part of this. Position is derived from committed
 * lessons and files in the tree, so it is the same on every run (invariant 22), and the suite has
 * its own gate: writing the next lesson needs a green suite, so a session that writes one is still
 * a session in which the current exercise is finished.
 */
function isFinished(repoRoot: string, slice: PlanSliceRecord): boolean {
    return fs.existsSync(path.join(repoRoot, slice.pinningTest.file));
}

/** Re-render the workbook so the pages match the lessons, and name the page a lesson renders to. */
function render(repoRoot: string, slug: string, plan: WorkbookPlan): void {
    const lessons: LessonSource[] = readLessons(repoRoot, slug);
    if (lessons.length === 0) return;
    renderWorkbookInto(workbookRoot(repoRoot, slug), {
        lessons,
        stubs: planStubs(plan, writtenLessonFiles(repoRoot, slug)).map((stub) => `Story #${stub.story}`),
    });
}

function pagePath(repoRoot: string, slug: string, lessonFile: string): string {
    return path.join(workbookRoot(repoRoot, slug), pageNameFor(lessonFile));
}

/** The slice the plan teaches next after the one that was handed off, or null when there is none. */
function sliceAfter(plan: WorkbookPlan, story: number): PlanSliceRecord | null {
    const at: number = plan.slices.findIndex((slice) => slice.story === story);
    if (at === -1) return null;
    return plan.slices.slice(at + 1).find((slice) => slice.learnerBuilds) ?? null;
}

/** The brief the chain hands the agent: everything about the lesson that is not its prose. */
function briefFor(
    plan: WorkbookPlan,
    slice: PlanSliceRecord,
    drill: string | null,
    revisit: readonly string[] = [],
): LessonBrief {
    return {
        story: slice.story,
        lesson: slice.lesson,
        title: slice.pinned.title,
        concepts: slice.concepts,
        drill,
        revisit,
        exercise: {
            story: slice.story,
            branch: slice.branch,
            pinningTest: slice.pinningTest.file,
            pinningTestText: slice.pinningTest.text,
            gradingCommand: plan.grading.join(" "),
        },
    };
}

/**
 * Run one session. The chain is fixed, and every step in it produces a fact a test can assert.
 */
export function runTeachingSession(inputs: SessionInputs): SessionResult {
    const { repoRoot, slug, read } = inputs;
    const run: Runner = inputs.run ?? defaultRunner;
    const now: () => string = inputs.now ?? (() => new Date().toISOString());
    const skipped: string[] = [];
    const notes: string[] = [];

    // 1. Sweep whatever a previous probe left behind, before anything else runs (invariant 11).
    sweepProbe(repoRoot);

    const plan: WorkbookPlan | null = readWorkbookPlan(repoRoot, slug);
    if (plan === null) {
        return {
            outcome: {
                kind: "no-plan",
                report:
                    `${slug} declares no plan of slices, so there is nothing to teach from. A teaching ` +
                    `workbook's plan names each slice's story, its learner-or-handoff mark, the state ` +
                    `that story was pinned to, and the concepts it teaches.`,
            },
            drift: [],
            skipped,
            notes,
        };
    }

    // 2. Resolve the learner's position from the lessons already written — the session's memory.
    const written: LessonSource[] = readLessons(repoRoot, slug);
    const parsed: Lesson[] = written.map(parseLesson);
    const history: LessonConceptHistory[] = parsed.map(conceptsOf);
    const teaching: TeachingPlan = toTeachingPlan(plan);
    const { state, open } = handoffState(repoRoot, slug);

    // 3. The suite gate. It runs before the probe, and its result gates everything (invariants 8, 10).
    const suite: SuiteResult = runSuite(repoRoot, plan.suite, run);

    const staged: StagedLesson[] = plan.slices
        .filter((slice) => slice.lesson !== "" && written.some((lesson) => lesson.file === slice.lesson))
        .map((slice) => ({ story: slice.story, pinningTestPassed: isFinished(repoRoot, slice) }));

    /** What the walk settles on once any outstanding handoff has been verified and resolved. */
    type SettledArrival = Exclude<ArrivalAction, { kind: "resume" }>;
    let arrival: SettledArrival;

    if (open !== null) {
        const paused: number = storyNumber(open);
        if (!suite.passed) {
            return {
                outcome: {
                    kind: "suite-red",
                    report:
                        `The declared suite is failing, so no lesson is written and the handoff at ` +
                        `#${paused} stays open. A lesson written on a red suite is built on sand.`,
                    output: suite.output,
                },
                drift: [],
                skipped,
                notes,
            };
        }

        // 4. The fence probe, on a green suite only. The handed-off slice's own test must pass —
        // otherwise either its work is not in this tree, or this stack cannot run one test file on
        // its own and no probe result here means anything. The control test tells the two apart.
        const handedOff: PlanSliceRecord | undefined = plan.slices.find((slice) => slice.story === paused);
        if (handedOff === undefined) {
            // The plan teaches no slice for the story this pause names, so it names no pinning test
            // and there is nothing to probe. A handoff resolves on a green suite and an intact fence
            // (invariant 18), and a fence nobody could check is never an intact one — so the pause
            // stays open and the session says why rather than stamping "verified" on nothing.
            return {
                outcome: {
                    kind: "unplanned-handoff",
                    story: paused,
                    report:
                        `The open pause names #${paused}, and this workbook's plan teaches no slice ` +
                        `for it — so it names no pinning test, nothing can be probed, and nothing ` +
                        `here can verify that the handed-off work landed. The pause stays open. ` +
                        `Either the plan is the wrong one for this pause, or the pause was recorded ` +
                        `at a story the plan does not build; resolving it by hand records that it ` +
                        `was an override rather than something checked.`,
                },
                drift: [],
                skipped,
                notes,
            };
        }
        let fence: FenceState | null = null;
        let fenced: number = paused;
        const landed: boolean = runProbe(repoRoot, handedOff.pinningTest.file, handedOff.pinningTest.text, plan.grading, run);
        if (!landed) {
            const proof: ProbeProof = proveProbe(repoRoot, plan.probeControl, plan.grading, run);
            if (proof !== "unrunnable") {
                return {
                    outcome: {
                        kind: "unintegrated",
                        story: paused,
                        report:
                            `The work handed off for #${paused} is not in this tree, so the session ` +
                            `stays paused. Integrating that branch is yours to do — the session ` +
                            `moves no git state and will not merge it for you.` +
                            (proof === "proven"
                                ? ""
                                : ` Nothing here has shown that the grading command can run one ` +
                                  `test file on its own, so this may instead be a probe that cannot ` +
                                  `run at all — declare a 'probe_control' in the plan to tell the ` +
                                  `two apart.`),
                    },
                    drift: [],
                    skipped,
                    notes,
                };
            }
            // The control test does not pass either, so the probe cannot run here at all and
            // nothing it says about the fence can be believed.
            fence = "unchecked";
        }

        const next: PlanSliceRecord | null = sliceAfter(plan, paused);
        if (fence === null && next !== null) {
            // The handed-off slice's own test passed, which is itself proof that one test file can
            // run alone here — so this probe's answer is a fact about the fence and not about the
            // stack (record #469's fifth ADDRESS risk).
            fenced = next.story;
            fence = runProbe(repoRoot, next.pinningTest.file, next.pinningTest.text, plan.grading, run) ? "breached" : "intact";
        }
        const verdict = interpretReturn(suite.passed, fence, fenced);
        if (!verdict.canTeach && verdict.reason === "breach") {
            return {
                outcome: { kind: "breach", story: verdict.story, report: renderBreachReport(verdict.story) },
                drift: [],
                skipped,
                notes,
            };
        }
        if (!verdict.canTeach && verdict.reason === "unchecked") {
            return {
                outcome: { kind: "unchecked", story: verdict.story, report: renderUncheckedReport(verdict.story) },
                drift: [],
                skipped,
                notes,
            };
        }
        notes.push(
            next === null
                ? `the handed-off work for #${paused} is in this tree, and there was no next slice to fence.`
                : `the handed-off work for #${paused} is in this tree, and the fence around #${next.story} is intact.`,
        );

        // A green suite and an intact fence are what resolve a handoff — never an assertion that it
        // is done (invariant 18).
        resolveHandoff(repoRoot, open.id, now(), run, "verified");
        arrival = resolveArrival(teaching, staged, {
            resolved: [...state.resolved, paused],
            outstanding: null,
        }) as SettledArrival;
    } else {
        arrival = resolveArrival(teaching, staged, state) as SettledArrival;
    }

    if (arrival.kind === "done") {
        return {
            outcome: { kind: "done", report: `Every slice of ${slug} has been taught and finished.` },
            drift: [],
            skipped,
            notes,
        };
    }

    if (arrival.kind === "open") {
        const story: number = arrival.story;
        const slice: PlanSliceRecord = plan.slices.find((s) => s.story === story) as PlanSliceRecord;
        render(repoRoot, slug, plan);
        return {
            outcome: {
                kind: "open",
                story: slice.story,
                page: pagePath(repoRoot, slug, slice.lesson),
                report:
                    `The lesson for #${slice.story} is written and its exercise is not finished, so ` +
                    `this session opens it again rather than writing another.\n\n` +
                    renderExerciseSection(briefFor(plan, slice, null).exercise),
            },
            drift: [],
            skipped,
            notes,
        };
    }

    // 5. The drift check, on the slice about to be taught or handed off. Drift found elsewhere in
    // the plan is reported and the session teaches on.
    const slice: PlanSliceRecord = plan.slices.find((s) => s.story === arrival.slice.story) as PlanSliceRecord;
    const gate: LessonGate = gateNextLesson(teaching, slice.story, read);
    if (gate.blocked && gate.finding !== null) {
        return {
            outcome: {
                kind: "drift",
                finding: gate.finding,
                report:
                    `${gate.finding.detail} No lesson is written for #${slice.story}. Re-pinning the ` +
                    `plan is the plan approver's act, so report this rather than teaching past it.`,
            },
            drift: gate.findings,
            skipped,
            notes,
        };
    }
    if (gate.findings.length === 0) {
        // A clean check that says nothing is indistinguishable from a check that never ran, and the
        // learner is the one who has to trust it (story #460's third criterion).
        notes.push("every story in the plan still matches the state it was pinned to, so nothing stops this lesson.");
    }

    // The handoff comes before the suite gate: that gate exists so no *lesson* is written on a red
    // suite, and a handoff writes none. A slice that is not the learner's to build may be the very
    // thing that fixes a red suite, so blocking the pause on it would strand the workbook.
    if (arrival.kind === "handoff") {
        const { promptPath } = pauseForHandoff(
            repoRoot,
            slug,
            {
                repo: plan.repo,
                branch: slice.branch,
                epic: plan.epic,
                story: slice.story,
                siblings: siblingSlices(teaching, slice.story),
                issue: { title: slice.pinned.title, body: slice.pinned.body },
            },
            run,
            now,
        );
        return {
            outcome: {
                kind: "handoff",
                story: slice.story,
                promptPath,
                report:
                    `#${slice.story} is not yours to build. The prompt for a separate coding-agent ` +
                    `session is at ${promptPath}, and this session pauses until you come back.`,
            },
            drift: gate.findings,
            skipped,
            notes,
        };
    }

    if (!suite.passed) {
        return {
            outcome: {
                kind: "suite-red",
                report:
                    `The declared suite is failing, so no lesson is written. A lesson written on a red ` +
                    `suite is built on sand, whoever broke the suite.`,
                output: suite.output,
            },
            drift: gate.findings,
            skipped,
            notes,
        };
    }

    // 6. The drill: a concept the learner met at least one lesson earlier, ranked by the hints they
    // have taken on it — and, from the same hints, the concepts the lesson just finished left them
    // struggling with, which this lesson asks about again (story #463). The two are complements:
    // the drill is only ever on a cold concept, and these are only ever from the last lesson.
    const hints: HintCounts = readHints(repoRoot, skipped);
    const drill: string | null = chooseDrill(history, hints);
    const revisit: string[] = conceptsToRevisit(history, hints);
    const brief: LessonBrief = briefFor(plan, slice, drill, revisit);

    // 7. The one generative step. Without the prose the chain hands out the brief and stops; with
    // it, the lesson is written, the workbook re-rendered, and the exercise handed over.
    if (inputs.prose === undefined) {
        return {
            outcome: {
                kind: "brief",
                brief,
                report:
                    `Ready to write the lesson for #${slice.story} into ${slice.lesson}. Every fact it ` +
                    `states is decided; what it needs is the theory prose` +
                    (drill === null ? "" : `, the drill's question and answer on ${drill}`) +
                    (revisit.length === 0
                        ? "."
                        : `, and a question and answer on ${revisit.join(", ")} — asked about again ` +
                          `because the last lesson took a hint on ${revisit.length === 1 ? "it" : "them"}.`),
            },
            drift: gate.findings,
            skipped,
            notes,
        };
    }

    fs.mkdirSync(lessonsDir(repoRoot, slug), { recursive: true });
    fs.writeFileSync(path.join(lessonsDir(repoRoot, slug), slice.lesson), composeLesson(brief, inputs.prose));
    render(repoRoot, slug, plan);
    return {
        outcome: {
            kind: "written",
            story: slice.story,
            lesson: slice.lesson,
            page: pagePath(repoRoot, slug, slice.lesson),
            report:
                `Wrote the lesson for #${slice.story} and opened it at ${pagePath(repoRoot, slug, slice.lesson)}.\n\n` +
                renderExerciseSection(brief.exercise),
        },
        drift: gate.findings,
        skipped,
        notes,
    };
}
