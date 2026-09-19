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
import { chooseDrill, conceptsToRevisit, earnedConcepts, earnedReference, type HintCounts, type LessonConceptHistory } from "./drill-selection.js";
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
    type AuthoredPinningTest,
    type AuthoredProse,
    type HandoffState,
    type LessonBrief,
    type PinningTestRequest,
    type StagedLesson,
} from "./lesson-writer.js";
import { gateNextLesson, type DriftFinding, type IssueReader, type LessonGate, type TeachingPlan } from "./teaching-plan.js";
import { sliceId, sliceLabel, toTeachingPlan, type PlanSliceRecord, type WorkbookPlan } from "./workbook-plan.js";
import {
    REFERENCE_PAGE_PREFIX,
    REFERENCE_WORD_BUDGET,
    parseLesson,
    parseReference,
    pageNameFor,
    referencePageNameFor,
    renderWorkbookInto,
    type Lesson,
    type LessonSource,
} from "./workbook-render.js";
import {
    lessonsDir,
    planRenderOptions,
    readLessons,
    readReferences,
    readWorkbookPlan,
    referenceDir,
    workbookRoot,
    writeWorkbookPlan,
} from "./workbook-store.js";

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
    | { kind: "tests"; story: number; requests: PinningTestRequest[]; report: string }
    | { kind: "brief"; brief: LessonBrief; report: string }
    | { kind: "written"; story?: number; lesson: string; page: string; report: string }
    | { kind: "open"; story?: number; lesson: string; page: string; report: string }
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

/**
 * The concepts this workbook already holds a reference page for. A file the render would refuse is
 * skipped here rather than failing the session: the render names it, and a concept it fails to cover
 * is simply still owed.
 */
function conceptsWithPages(repoRoot: string, slug: string): Set<string> {
    const covered: Set<string> = new Set();
    for (const source of readReferences(repoRoot, slug)) {
        try {
            covered.add(parseReference(source).concept);
        } catch {
            // Reported by the render, which refuses it by name.
        }
    }
    return covered;
}

/**
 * The authored source of a reference page on this concept: the one concept it covers, and the
 * prose. Checked as the render will check it before anything is written, so a page the render would
 * refuse never leaves a lesson written with no render behind it.
 */
function referenceSource(concept: string, prose: string): LessonSource {
    const source: LessonSource = {
        file: `reference/${referenceFileFor(concept)}`,
        source: `---\nconcept: ${JSON.stringify(concept)}\n---\n\n${prose.trim()}\n`,
    };
    parseReference(source);
    return source;
}

/** The authored file a reference page on this concept is written to, named from its concept. */
function referenceFileFor(concept: string): string {
    return referencePageNameFor(concept).slice(REFERENCE_PAGE_PREFIX.length).replace(/\.html$/, ".md");
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
    if (slice.pinningTest === null) return true;
    return fs.existsSync(path.join(repoRoot, slice.pinningTest.file));
}

/**
 * Re-render the workbook so the pages match the lessons and the plan — the home page included, so it
 * links a lesson's slice the moment the lesson is written (record #591, invariant 46).
 */
function render(repoRoot: string, slug: string, plan: WorkbookPlan): void {
    renderWorkbookInto(workbookRoot(repoRoot, slug), planRenderOptions(repoRoot, slug, plan));
}

function pagePath(repoRoot: string, slug: string, lessonFile: string): string {
    return path.join(workbookRoot(repoRoot, slug), pageNameFor(lessonFile));
}

/**
 * The slice that builds a story next after the one that was handed off, or null when there is none.
 * A scaffold is skipped: it builds nothing, so it has no pinning test a fence could be probed with
 * (record #591, invariant 7).
 */
function sliceAfter(plan: WorkbookPlan, handedOff: PlanSliceRecord): PlanSliceRecord | null {
    const at: number = plan.slices.indexOf(handedOff);
    return plan.slices.slice(at + 1).find((slice) => slice.learnerBuilds && slice.scaffold === undefined) ?? null;
}

/** What a pinning test for this slice is written against, for the agent that writes it. */
function testRequest(plan: WorkbookPlan, slice: PlanSliceRecord): PinningTestRequest {
    return {
        slice: sliceId(slice),
        story: slice.story as number,
        title: slice.pinned?.title ?? "",
        branch: slice.branch,
        gradingCommand: plan.grading.join(" "),
    };
}

/** True for a story slice the session has reached and whose pinning test nobody has written yet. */
function needsTest(slice: PlanSliceRecord | null): slice is PlanSliceRecord {
    return slice !== null && slice.story !== undefined && slice.pinningTest === null;
}

/**
 * The plan with the pinning tests an arrival wrote, each under its own slice. A test is written once
 * and never rewritten (record #591, invariant 29), so a slice that already holds one keeps it. A test
 * must name a file inside this repository and carry its text, because the lesson shows it and the
 * probe materializes it under that name. Pure: the caller writes the plan once nothing else can fail.
 */
function withPinningTests(plan: WorkbookPlan, authored: readonly AuthoredPinningTest[]): WorkbookPlan {
    const slices: PlanSliceRecord[] = plan.slices.map((slice) => {
        const test: AuthoredPinningTest | undefined = authored.find((entry) => entry.slice === sliceId(slice));
        if (test === undefined || !needsTest(slice)) return slice;
        const file: string = test.file.trim();
        if (file === "" || path.isAbsolute(file) || path.normalize(file).split(path.sep)[0] === ".." || test.text.trim() === "") {
            throw new Error(
                `the pinning test for ${sliceLabel(slice)} names ${JSON.stringify(test.file)}. A pinning test is a file inside ` +
                `this repository, given by a relative path, and carries the text the learner writes.`,
            );
        }
        return { ...slice, pinningTest: { file, text: test.text } };
    });
    return { ...plan, slices };
}

/** The brief the chain hands the agent: everything about the lesson that is not its prose. */
function briefFor(
    plan: WorkbookPlan,
    slice: PlanSliceRecord,
    drill: string | null,
    revisit: readonly string[] = [],
    earned: LessonBrief["earned"] = null,
): LessonBrief {
    return {
        ...(slice.story === undefined ? {} : { story: slice.story }),
        ...(slice.part === undefined ? {} : { part: slice.part }),
        ...(slice.scaffold === undefined ? {} : { scaffold: slice.scaffold }),
        lesson: slice.lesson,
        title: slice.pinned === null ? `Teaching step — ${slice.scaffold}` : slice.pinned.title,
        concepts: slice.concepts,
        drill,
        revisit,
        earned,
        exercise:
            slice.story === undefined || slice.pinningTest === null
                ? null
                : {
                      story: slice.story,
                      branch: slice.branch,
                      pinningTest: slice.pinningTest.file,
                      pinningTestText: slice.pinningTest.text,
                      gradingCommand: plan.grading.join(" "),
                  },
        ...(needsTest(slice) ? { writeTest: testRequest(plan, slice) } : {}),
    };
}

/** What a brief asks for on the concept this sitting's drill earned a reference page for. */
function earnedReport(earned: LessonBrief["earned"]): string {
    if (earned === null) return "";
    if (earned.written) return ` ${earned.concept} has been drilled again, and its reference page is already written.`;
    return (
        ` ${earned.concept} is drilled here a second time, so it has earned a reference page: its prose, at most ` +
        `${REFERENCE_WORD_BUDGET} words restating only what a lesson already taught, goes under 'reference'. ` +
        `The lesson is written without it if it does not come.`
    );
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

    let plan: WorkbookPlan | null = readWorkbookPlan(repoRoot, slug);
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

    // A page an earlier sitting earned and nobody wrote is named on every run, so the backlog stays
    // visible rather than silent (record #659, invariant 6).
    const withPages: Set<string> = conceptsWithPages(repoRoot, slug);
    const owed: string[] = earnedConcepts(history).filter((concept) => !withPages.has(concept));
    if (owed.length > 0) {
        notes.push(
            `${owed.join(", ")} ${owed.length === 1 ? "has" : "have"} earned a reference page, drilled a second time ` +
            `in an earlier lesson, and none is written yet.`,
        );
    }
    const { state, open } = handoffState(repoRoot, slug);

    // 3. The suite gate. It runs before the probe, and its result gates everything (invariants 8, 10).
    const suite: SuiteResult = runSuite(repoRoot, plan.suite, run);

    const staged: StagedLesson[] = plan.slices
        .filter((slice) => slice.lesson !== "" && written.some((lesson) => lesson.file === slice.lesson))
        .map((slice) => ({ lesson: slice.lesson, pinningTestPassed: isFinished(repoRoot, slice) }));

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
        const handedOff: PlanSliceRecord | undefined = plan.slices.find((slice) => slice.story === paused && !slice.learnerBuilds);
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
        const landed: boolean =
            handedOff.pinningTest !== null && runProbe(repoRoot, handedOff.pinningTest.file, handedOff.pinningTest.text, plan.grading, run);
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

        const next: PlanSliceRecord | null = sliceAfter(plan, handedOff);
        if (fence === null && next !== null && next.pinningTest !== null && next.story !== undefined) {
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
                : `the handed-off work for #${paused} is in this tree, and the fence around ${sliceLabel(next)} is intact.`,
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
        // The teaching view is built from the plan in the same order, so a slice's position is its identity here.
        const slice: PlanSliceRecord = plan.slices[teaching.slices.indexOf(arrival.slice)];
        const exercise = briefFor(plan, slice, null).exercise;
        render(repoRoot, slug, plan);
        return {
            outcome: {
                kind: "open",
                ...(slice.story === undefined ? {} : { story: slice.story }),
                lesson: slice.lesson,
                page: pagePath(repoRoot, slug, slice.lesson),
                report:
                    `The lesson for ${sliceLabel(slice)} is written and its exercise is not finished, so ` +
                    `this session opens it again rather than writing another.` +
                    (exercise === null ? "" : `\n\n${renderExerciseSection(exercise)}`),
            },
            drift: [],
            skipped,
            notes,
        };
    }

    // 5. The drift check, on the slice about to be taught or handed off. Drift found elsewhere in
    // the plan is reported and the session teaches on.
    const slice: PlanSliceRecord = plan.slices[teaching.slices.indexOf(arrival.slice)];
    const gate: LessonGate = gateNextLesson(teaching, slice.story, read);
    if (gate.blocked && gate.finding !== null) {
        return {
            outcome: {
                kind: "drift",
                finding: gate.finding,
                report:
                    `${gate.finding.detail} No lesson is written for ${sliceLabel(slice)}. Re-pinning the ` +
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
    if (arrival.kind === "handoff" && slice.story !== undefined && slice.pinned !== null) {
        // The handed-off slice's test is what the return probe runs, and the next story slice's test is
        // what it fences — both are written on arrival here, before the prompt, because a pause that
        // names no test could never be verified (record #591, invariant 29).
        const needed: PlanSliceRecord[] = [slice, sliceAfter(plan, slice)].filter(needsTest);
        const authored: readonly AuthoredPinningTest[] = inputs.prose?.pinningTests ?? [];
        if (needed.some((each) => !authored.some((test) => test.slice === sliceId(each)))) {
            const requests: PinningTestRequest[] = needed.map((each) => testRequest(plan as WorkbookPlan, each));
            return {
                outcome: {
                    kind: "tests",
                    story: slice.story,
                    requests,
                    report:
                        `Before #${slice.story} is handed off, its pinning test has to exist — the return probe runs it — ` +
                        `and so does the test of the next slice that builds a story, which the probe fences. Write ` +
                        `${requests.map((request) => request.slice).join(" and ")} under 'pinning_tests', each with its file and text.`,
                },
                drift: gate.findings,
                skipped,
                notes,
            };
        }
        if (needed.length > 0) {
            plan = withPinningTests(plan, authored);
            writeWorkbookPlan(repoRoot, slug, plan);
        }
        const { promptPath } = pauseForHandoff(
            repoRoot,
            slug,
            {
                repo: plan.repo,
                branch: slice.branch,
                // The epic this slice's story belonged to at approval, never a plan-wide one (invariant 8).
                epic: slice.epic as number,
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
    // A drill on a concept an earlier lesson already drilled earns it a reference page. Counted over
    // the committed lessons alone; the hints above only ranked the drill (record #659, invariant 4).
    const earnedConcept: string | null = earnedReference(history, drill);
    const earned: LessonBrief["earned"] = earnedConcept === null ? null : { concept: earnedConcept, written: withPages.has(earnedConcept) };
    let brief: LessonBrief = briefFor(plan, slice, drill, revisit, earned);

    // 7. The one generative step. Without the prose the chain hands out the brief and stops; with
    // it, the lesson is written, the workbook re-rendered, and the exercise handed over.
    if (inputs.prose === undefined) {
        return {
            outcome: {
                kind: "brief",
                brief,
                report:
                    `Ready to write the lesson for ${sliceLabel(slice)} into ${slice.lesson}. Every fact it ` +
                    `states is decided; what it needs is the theory prose` +
                    (drill === null ? "" : `, the drill's question and answer on ${drill}`) +
                    (revisit.length === 0
                        ? "."
                        : `, and a question and answer on ${revisit.join(", ")} — asked about again ` +
                          `because the last lesson took a hint on ${revisit.length === 1 ? "it" : "them"}.`) +
                    earnedReport(earned),
            },
            drift: gate.findings,
            skipped,
            notes,
        };
    }

    let pinned: WorkbookPlan | null = null;
    if (brief.writeTest !== undefined) {
        const request: PinningTestRequest = brief.writeTest;
        const authored: AuthoredPinningTest[] = (inputs.prose.pinningTests ?? []).filter((test) => test.slice === request.slice);
        if (authored.length === 0) {
            throw new Error(
                `the lesson for ${sliceLabel(slice)} has no pinning test to set as its exercise. A slice's test is ` +
                `written when the learner arrives at it: write it under 'pinning_tests' as ${request.slice}, with its file and text.`,
            );
        }
        const index: number = plan.slices.indexOf(slice);
        pinned = withPinningTests(plan, authored);
        brief = briefFor(pinned, pinned.slices[index], drill, revisit, earned);
    }
    // Composed before anything is written, so a lesson that cannot be composed records no test either.
    const lesson: string = composeLesson(brief, inputs.prose);
    // Earning a page and writing it are two events: prose that did not come back leaves the page owed
    // and the lesson written (record #659). Prose that did is checked before anything is written.
    const authoredReference: string = inputs.prose.reference?.trim() ?? "";
    const reference: LessonSource | null =
        earned === null || earned.written || authoredReference === "" ? null : referenceSource(earned.concept, authoredReference);
    if (reference !== null && earned !== null && fs.existsSync(path.join(referenceDir(repoRoot, slug), referenceFileFor(earned.concept)))) {
        // Another concept's page already holds the file this one would be written to; overwriting it
        // would lose that page, so nothing is written and the collision is named instead.
        throw new Error(
            `the reference page on ${earned.concept} would be written to ${reference.file}, which already holds a ` +
            `page on another concept. Rename one of the two files by hand and re-run.`,
        );
    }
    if (pinned !== null) {
        plan = pinned;
        writeWorkbookPlan(repoRoot, slug, plan);
    }
    fs.mkdirSync(lessonsDir(repoRoot, slug), { recursive: true });
    fs.writeFileSync(path.join(lessonsDir(repoRoot, slug), slice.lesson), lesson);
    if (reference !== null && earned !== null) {
        fs.mkdirSync(referenceDir(repoRoot, slug), { recursive: true });
        fs.writeFileSync(path.join(referenceDir(repoRoot, slug), referenceFileFor(earned.concept)), reference.source);
    }
    render(repoRoot, slug, plan);
    const referencePage: string | null =
        earned === null || (!earned.written && reference === null)
            ? null
            : path.join(workbookRoot(repoRoot, slug), referencePageNameFor(earned.concept));
    return {
        outcome: {
            kind: "written",
            ...(slice.story === undefined ? {} : { story: slice.story }),
            lesson: slice.lesson,
            page: pagePath(repoRoot, slug, slice.lesson),
            report:
                `Wrote the lesson for ${sliceLabel(slice)} and opened it at ${pagePath(repoRoot, slug, slice.lesson)}.` +
                (earned === null
                    ? ""
                    : referencePage === null
                      ? ` ${earned.concept} has earned a reference page, drilled a second time, and none is written yet — ` +
                        `the next session names it again.`
                      : ` ${earned.concept} has earned a reference page, drilled a second time; it is at ${referencePage}, ` +
                        `and the warm-up of every lesson that drilled it links there.`) +
                (brief.exercise === null ? "" : `\n\n${renderExerciseSection(brief.exercise)}`),
        },
        drift: gate.findings,
        skipped,
        notes,
    };
}
