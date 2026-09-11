/**
 * `nexus workbook` (epic #405): the verb that makes a workbook, renders it, and starts a session
 * on it.
 *
 * Without this verb the store, the renderer and the handoff records are code nobody can reach: a
 * lesson author has no way to turn prose into a page, and a learner has no way to come back to the
 * story a session handed off. Each subverb is a thin caller over one capability, and none of them
 * re-implements any of it — placement comes from `workbook-placement.ts`, the store's layout from
 * `workbook-store.ts`, the rendering from `workbook-render.ts`, and the pause from `handoffs.ts`.
 *
 * Rendering is deliberately all-or-nothing at this surface too: `render` reports the lesson that
 * failed and leaves no pages behind, so a learner never opens a workbook that is part new and part
 * stale. `check` is the other half of committing generated output: it re-renders and compares, so a
 * page edited by hand — or left behind by a lesson that changed — is caught in review rather than
 * read as if it were current.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "yaml";
import { takeTargetRoot } from "@nexus/workspace/target-root";
import { type Runner, defaultRunner } from "@nexus/workspace/run";
import { outstandingHandoffs, recordHandoff, resolveHandoff, startWorkbookSession, type Handoff, type WorkbookSession } from "./handoffs.js";
import {
    LESSONS_DIRNAME,
    createWorkbook,
    lessonsDir,
    readLessons,
    readWorkbookPlan,
    workbookRoot,
    type CreatedWorkbook,
} from "./workbook-store.js";
import { checkWorkbook, renderWorkbookInto, type LessonSource, type WorkbookDrift } from "./workbook-render.js";
import { resolveWorkbookHome, type WorkbookHomeResult } from "./workbook-placement.js";
import { type AuthoredProse, type RevisitProse } from "./lesson-writer.js";
import { type IssueReader, type LiveStory } from "./teaching-plan.js";
import { runTeachingSession, type SessionResult } from "./teaching-session.js";
import { type WorkbookPlan } from "./workbook-plan.js";
import {
    epicsFromQuery,
    readRoadmap,
    resolveRoadmap,
    writeRoadmap,
    type Roadmap,
    type RoadmapProblem,
    type RoadmapResult,
    type RoadmapStory,
} from "./roadmap.js";
import { interviewSlate, readInterview, recordInterview, type GivenAnswer, type InterviewRecord } from "./interview.js";
import { draftFromExtractions, extractionsDir, proposedVocabulary, readExtractions, recordExtraction, type CheckResult, type DraftResult } from "./concept-extraction.js";
import { resolveEpic } from "@nexus/epic-resolve/resolve";
import { resolveWorkspace } from "@nexus/workspace/resolve";

/** The subverbs `nexus workbook` dispatches. */
export const WORKBOOK_SUBVERBS: readonly string[] = [
    "create",
    "roadmap",
    "interview",
    "extract",
    "vocabulary",
    "draft",
    "render",
    "check",
    "session",
    "teach",
    "handoff",
    "resolve",
];

export interface WorkbookCliIo {
    cwd: string;
    stdout: (line: string) => void;
    stderr: (line: string) => void;
}

interface Flags {
    root: string;
    /** The member repository whose roadmap the workbook teaches, when run from a hub. */
    repo?: string;
    story?: string;
    note?: string;
    /** The file holding the prose an agent wrote for the lesson a previous run briefed. */
    prose?: string;
    /** The epic issue a roadmap resolves from. */
    epic?: string;
    /** The backlog query a roadmap resolves from. */
    query?: string;
    /** The file holding the answers an agent brought back from the interview. */
    answers?: string;
    /** The file holding the concept list an extraction subagent wrote for one story. */
    list?: string;
    /** The file holding the groups of identifiers the planning session decided name one concept. */
    merge?: string;
    positional: string[];
    unknown?: string;
}

/** Parse the flags every subverb shares, plus the two the handoff subverbs add. */
function parseFlags(argv: string[], cwd: string): Flags {
    const { root, rest } = takeTargetRoot(argv, cwd);
    const flags: Flags = { root, positional: [] };
    for (let i = 0; i < rest.length; i++) {
        const token: string = rest[i];
        if (token === "--repo") flags.repo = rest[++i];
        else if (token === "--story") flags.story = rest[++i];
        else if (token === "--note") flags.note = rest[++i];
        else if (token === "--prose") flags.prose = rest[++i];
        else if (token === "--epic") flags.epic = rest[++i];
        else if (token === "--query") flags.query = rest[++i];
        else if (token === "--answers") flags.answers = rest[++i];
        else if (token === "--list") flags.list = rest[++i];
        else if (token === "--merge") flags.merge = rest[++i];
        else if (token.startsWith("--")) {
            flags.unknown = token;
            return flags;
        } else flags.positional.push(token);
    }
    return flags;
}

const USAGE: string = [
    `usage: nexus workbook <${WORKBOOK_SUBVERBS.join("|")}> <name> [--root <dir>] [--repo <member>]`,
    "  create <slug>                       make the workbook and ensure the learner folder is ignored",
    "  roadmap [<name>] --epic <n>         resolve a roadmap from one epic issue",
    "  roadmap <name> --query <expr>       resolve a roadmap from a backlog query",
    "  interview <name> [--answers <file>] the slate to ask from, or the answers to record",
    "  extract <name> [--story <n> [--list <file>]]",
    "                                      the stories still to extract, one story's text, or its list to check",
    "  vocabulary <name>                   every proposed concept identifier and its glosses",
    "  draft <name> --merge <file>         write the plan's stubs once every story has a checked list",
    "  render <slug>                       render every authored lesson to its page",
    "  check <slug>                        report any committed page that has drifted from its lesson",
    "  session <slug>                      start a session: the pages, and the handoff it resumes at",
    "  teach <slug> [--prose <file>]       run the teaching session: check, drill, and write one lesson",
    "  handoff <slug> --story <s> [--note] record a pause at a story",
    "  resolve <slug> <handoff-id>         mark a recorded handoff resolved",
].join("\n");

/** The message an error carries, whatever kind of error it is. */
function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * Find the repository the workbook belongs in. In a workspace that is the member repository whose
 * roadmap the workbook teaches, never the hub (record #450, invariant 6).
 */
function repoRootFor(flags: Flags, io: WorkbookCliIo): string | null {
    const home: WorkbookHomeResult = resolveWorkbookHome(flags.root, flags.repo);
    if (!home.ok) {
        io.stderr(home.message);
        return null;
    }
    return home.home.repoRoot;
}

/** How a drifted file reads in the report — what is wrong with it, in the reader's terms. */
const DRIFT_WORDING: Record<WorkbookDrift["state"], string> = {
    changed: "does not match the lesson it was generated from",
    missing: "was never rendered",
    extra: "is left over from a lesson that is gone",
};

/**
 * Report every committed file that is not what the lessons render to (record #450: pages are
 * generated, committed and deterministic, and a check mode catches the drift that follows from
 * committing generated output). It reports and repairs nothing — re-rendering is the fix, and it is
 * the author's to run.
 */
function reportDrift(repoRoot: string, slug: string, lessons: readonly LessonSource[], io: WorkbookCliIo): number {
    const drift: WorkbookDrift[] = checkWorkbook(workbookRoot(repoRoot, slug), { lessons });
    if (drift.length === 0) {
        io.stdout(`every page in ${slug} matches the lesson it was generated from.`);
        return 0;
    }
    io.stderr(`${drift.length} file${drift.length === 1 ? "" : "s"} in ${slug} drifted from the lessons:`);
    for (const { name, state } of drift) io.stderr(`  ${name} — ${DRIFT_WORDING[state]}`);
    io.stderr(`Run 'nexus workbook render ${slug}' and commit the result; a page is never edited by hand.`);
    return 1;
}

/**
 * Read one story's live state through `gh`. The session compares pinned state against live state
 * and never fetches it itself, so the fetch lives here, in the wiring, and goes through the same
 * argument-vector seam as everything else the session runs (invariants 13, 14).
 *
 * A story that cannot be read is null, never a story that looks unchanged: the whole point of the
 * check is that no lesson is written against a plan nobody confirmed.
 */
export function ghIssueReader(repoRoot: string, run: Runner): IssueReader {
    return (story: number): LiveStory | null => {
        const result = run("gh", ["issue", "view", String(story), "--json", "title,body,closedAt"], { cwd: repoRoot });
        if (result.status !== 0) return null;
        try {
            const parsed: Record<string, unknown> = JSON.parse(result.stdout) as Record<string, unknown>;
            return {
                title: String(parsed["title"] ?? ""),
                body: String(parsed["body"] ?? ""),
                closed: parsed["closedAt"] !== null && parsed["closedAt"] !== undefined,
            };
        } catch {
            return null;
        }
    };
}

/**
 * Read the prose an agent wrote: the theory half, with the drill's question and answer in front
 * matter when the brief asked for a drill, and a `revisit` list carrying one question and answer
 * per concept the brief asked to come back to. The chain chose the concepts; this file carries only
 * what an agent contributes.
 */
export function readProse(file: string): AuthoredProse {
    const source: string = fs.readFileSync(file, "utf8");
    const lines: string[] = source.split("\n");
    if (lines[0]?.trim() !== "---") return { theory: source };
    const end: number = lines.slice(1).findIndex((l) => l.trim() === "---");
    if (end === -1) return { theory: source };
    const front: Record<string, unknown> = (parse(lines.slice(1, end + 1).join("\n")) as Record<string, unknown> | null) ?? {};
    const question: unknown = front["question"];
    const answer: unknown = front["answer"];
    const revisit: RevisitProse[] = readRevisits(front["revisit"]);
    const theory: string = lines.slice(end + 2).join("\n");
    return {
        theory,
        ...(typeof question === "string" && typeof answer === "string" ? { drill: { question, answer } } : {}),
        ...(revisit.length === 0 ? {} : { revisit }),
    };
}

/**
 * The questions and answers for the concepts the brief asked to come back to (story #463). Each
 * entry names its concept, because the brief names the concepts and the composer matches them up —
 * an entry that is not a concept with both halves is dropped here, so the composer's refusal fires
 * with the concept's name rather than the lesson being written with a question and nothing behind it.
 */
function readRevisits(raw: unknown): RevisitProse[] {
    if (!Array.isArray(raw)) return [];
    const written: RevisitProse[] = [];
    for (const item of raw) {
        const entry: Record<string, unknown> = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
        const concept: unknown = entry["concept"];
        const question: unknown = entry["question"];
        const answer: unknown = entry["answer"];
        if (typeof concept === "string" && typeof question === "string" && typeof answer === "string") {
            written.push({ concept, question, answer });
        }
    }
    return written;
}

/** The outcomes that mean the session stopped rather than taught. They exit non-zero. */
const STOPPED: readonly string[] = [
    "no-plan",
    "suite-red",
    "unintegrated",
    "unplanned-handoff",
    "unchecked",
    "breach",
    "drift",
];

/** Report one session: what it did, what drift it saw on the way, and what it could not read. */
function reportSession(result: SessionResult, io: WorkbookCliIo): number {
    const stopped: boolean = STOPPED.includes(result.outcome.kind);
    (stopped ? io.stderr : io.stdout)(result.outcome.report);
    for (const note of result.notes) io.stdout(`checked: ${note}`);
    for (const note of result.skipped) io.stdout(note);
    for (const finding of result.drift) {
        if (result.outcome.kind === "drift" && finding.story === result.outcome.finding.story) continue;
        io.stdout(`also drifted, which does not stop this lesson: ${finding.detail}`);
    }
    if (result.outcome.kind === "brief") {
        io.stdout(`Write the theory into a file and re-run with --prose <file>. The lesson goes to ${result.outcome.brief.lesson}.`);
    }
    return stopped ? 1 : 0;
}

function describeHandoff(handoff: Handoff): string {
    const note: string = handoff.note === "" ? "" : ` — ${handoff.note}`;
    return `  ${handoff.id}  story ${handoff.story}${note}`;
}

/** The repo whose issues a roadmap is resolved from: the workspace hub, or the single-repo checkout. */
function issuesRoot(startDir: string): string {
    const resolved = resolveWorkspace(startDir);
    if (!resolved.ok) return startDir;
    return resolved.workspace.mode === "workspace" ? resolved.workspace.hubRoot : resolved.workspace.root;
}

/** How a named refusal reads: the diagnostic's own name, then what to do about it. */
function reportRoadmapProblem(error: RoadmapProblem, io: WorkbookCliIo): number {
    io.stderr(`${error.problem}: ${error.message}`);
    return 1;
}

/**
 * `nexus workbook roadmap` — resolve the roadmap, then make the workbook it will be taught in.
 *
 * Every epic is validated as a planned epic before anything else happens (invariant 3): the learner
 * types this number, so it is untrusted input, and a run against something that is not an epic has
 * to stop before the interview exists to be asked. The workbook is created only once resolution has
 * succeeded, because the workbook slug is the identity one interview per roadmap is keyed on and
 * creating it is also what guarantees the learner folder is ignored.
 */
function runRoadmap(repoRoot: string, name: string | undefined, flags: Flags, io: WorkbookCliIo, run: Runner): number {
    const named: boolean = flags.epic !== undefined;
    const queried: boolean = flags.query !== undefined;
    if (named === queried) {
        io.stderr(`workbook roadmap resolves from exactly one of --epic <n> and --query <expr>\n${USAGE}`);
        return 2;
    }
    if (queried && (name === undefined || name.trim() === "")) {
        io.stderr(`a query-resolved roadmap has no epic to take its name from, so name it: nexus workbook roadmap <name> --query <expr>`);
        return 2;
    }

    const root: string = issuesRoot(repoRoot);
    let epics: number[];
    if (named) {
        const epic: number = Number(String(flags.epic).replace(/^#/, ""));
        if (!Number.isInteger(epic) || epic <= 0) {
            io.stderr(`workbook roadmap --epic takes an issue number, not ${JSON.stringify(flags.epic)}`);
            return 2;
        }
        epics = [epic];
    } else {
        const found = epicsFromQuery(run, root, flags.query as string);
        if (!found.ok) return reportRoadmapProblem(found.error, io);
        epics = found.epics;
    }

    const result: RoadmapResult = resolveRoadmap(
        (epic: number) => resolveEpic(run, root, epic, { requireEpic: true }),
        epics,
        name === undefined ? {} : { name },
    );
    if (!result.ok) return reportRoadmapProblem(result.error, io);

    const roadmap: Roadmap = result.roadmap;
    createWorkbook(repoRoot, roadmap.name, run);
    const written: string = writeRoadmap(repoRoot, roadmap);
    io.stdout(
        `resolved the roadmap ${roadmap.name}: ${roadmap.stories.length} stor${roadmap.stories.length === 1 ? "y" : "ies"} ` +
        `across ${roadmap.epics.map((n) => `#${n}`).join(", ")}.`,
    );
    io.stdout(`  ${written}`);
    return 0;
}

/**
 * `nexus workbook interview` — the one seam between the slate code owns and the wording an agent
 * contributes. Asked with no answers it hands back the slate to phrase; asked with them it records
 * what the learner said. Asked about a roadmap that already has an interview it asks nothing and
 * reads the recorded answers back, because exactly one interview exists per roadmap.
 */
function runInterview(repoRoot: string, name: string, flags: Flags, io: WorkbookCliIo, run: Runner): number {
    const roadmap: Roadmap | null = readRoadmap(repoRoot, name);
    if (roadmap === null) {
        io.stderr(
            `no roadmap named ${name} has been resolved, so there is nothing to interview about. ` +
            `Run 'nexus workbook roadmap ${name} --epic <n>' first.`,
        );
        return 1;
    }

    const already: InterviewRecord | null = readInterview(repoRoot, name);
    if (already !== null) {
        io.stdout(JSON.stringify(already, null, 4));
        return 0;
    }

    if (flags.answers === undefined) {
        io.stdout(JSON.stringify({ roadmap: name, slots: interviewSlate() }, null, 4));
        return 0;
    }

    const recorded: InterviewRecord = recordInterview(repoRoot, roadmap, readAnswers(flags.answers), run);
    const answered: number = recorded.slots.filter((slot) => slot.answered).length;
    io.stdout(`recorded the interview for ${name}: ${answered} of ${recorded.slots.length} slots answered.`);
    return 0;
}

/**
 * Read the answers an agent brought back. Only the wording and the learner's own words come from
 * this file — the slots, their number and their order are the stage's, so anything naming a slot
 * the slate does not declare is refused rather than filed.
 */
export function readAnswers(file: string): GivenAnswer[] {
    const doc: unknown = parse(fs.readFileSync(file, "utf8"));
    const raw: unknown = (doc as Record<string, unknown> | null)?.["answers"];
    if (!Array.isArray(raw)) return [];
    return raw.map((item): GivenAnswer => {
        const entry: Record<string, unknown> = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
        return {
            slot: String(entry["slot"] ?? ""),
            question: String(entry["question"] ?? ""),
            answer: entry["answer"] === undefined ? undefined : String(entry["answer"]),
        };
    });
}

/** The resolved roadmap a planning subverb works over, or null once the refusal has been reported. */
function resolvedRoadmap(repoRoot: string, name: string, io: WorkbookCliIo): Roadmap | null {
    const roadmap: Roadmap | null = readRoadmap(repoRoot, name);
    if (roadmap === null) {
        io.stderr(`no roadmap named ${name} has been resolved. Run 'nexus workbook roadmap ${name} --epic <n>' first.`);
    }
    return roadmap;
}

/**
 * `nexus workbook extract` — the seam between the planning session and each extraction subagent
 * (epic #456, story #546).
 *
 * Asked with no story it prints the story numbers still to extract and nothing any story says,
 * because the planning session starts subagents from numbers and never holds the text. It refuses
 * before any subagent can start when the roadmap has no interview. Asked with a story it prints that
 * one story, for the one subagent reading it. Asked with a list it checks the subagent's output and
 * prints only the identifiers and glosses that passed — the one form in which anything a subagent
 * read reaches the planning session.
 */
function runExtract(repoRoot: string, name: string, flags: Flags, io: WorkbookCliIo, run: Runner): number {
    if (flags.story === undefined && flags.list !== undefined) {
        io.stderr(`workbook extract --list checks one story's list, so it needs --story\n${USAGE}`);
        return 2;
    }
    const roadmap: Roadmap | null = resolvedRoadmap(repoRoot, name, io);
    if (roadmap === null) return 1;
    // The focus comes from the recorded interview and from nowhere else: the pass asks the learner
    // nothing, so a roadmap with no interview stops here, before any subagent can start.
    const interview: InterviewRecord | null = readInterview(repoRoot, name);
    if (interview === null) {
        io.stderr(
            `the roadmap ${name} has no interview, so nothing records what the learner came to learn. ` +
            `Run 'nexus workbook interview ${name}' first — no story was extracted.`,
        );
        return 1;
    }

    if (flags.story === undefined) {
        const { current, missing } = readExtractions(repoRoot, roadmap);
        io.stdout(JSON.stringify({ roadmap: name, extract: missing, checked: current.map((list) => list.story) }, null, 4));
        return 0;
    }

    const number: number = Number(flags.story.replace(/^#/, ""));
    const story: RoadmapStory | undefined = roadmap.stories.find((s) => s.number === number);
    if (story === undefined) {
        io.stderr(`${flags.story} is not a story on the roadmap ${name}, so there is nothing of it to extract.`);
        return 1;
    }
    if (flags.list === undefined) {
        // A subagent's only inputs are its story and, when one was named, the recorded focus words.
        const focus: { focus?: string } = interview.focus.whole ? {} : { focus: interview.focus.stated };
        io.stdout(JSON.stringify({ story: story.number, title: story.title, body: story.body, ...focus }, null, 4));
        return 0;
    }
    const listFile: string = path.resolve(io.cwd, flags.list);
    const output: string = fs.readFileSync(listFile, "utf8");
    // A proposal written where the extractor agent writes it can carry a verdict's reason, and a saved
    // reason is a personal record (invariant 16). Once it is read, only the checked list and the guarded
    // learner-folder write keep anything; a list kept anywhere else is the caller's file, left alone.
    const fromExtractor: string = path.relative(extractionsDir(repoRoot, name), listFile);
    if (fromExtractor !== "" && !fromExtractor.startsWith("..") && !path.isAbsolute(fromExtractor)) fs.rmSync(listFile, { force: true });
    const result: CheckResult = recordExtraction(repoRoot, roadmap, number, output, run);
    if (!result.ok) {
        io.stderr(`no readable list for #${number}: ${result.problem}`);
        return 1;
    }
    io.stdout(JSON.stringify({ story: number, introduces: result.list.introduces, assumes: result.list.assumes }, null, 4));
    return 0;
}

/** `nexus workbook vocabulary` — every proposed identifier and its glosses, the only material the merge reads. */
function runVocabulary(repoRoot: string, name: string, io: WorkbookCliIo): number {
    const roadmap: Roadmap | null = resolvedRoadmap(repoRoot, name, io);
    if (roadmap === null) return 1;
    const { current, missing } = readExtractions(repoRoot, roadmap);
    io.stdout(JSON.stringify({ roadmap: name, identifiers: proposedVocabulary(current), missing }, null, 4));
    return 0;
}

/** `nexus workbook draft` — the one step that writes stubs: every one of them, or none. */
function runDraft(repoRoot: string, name: string, flags: Flags, io: WorkbookCliIo): number {
    if (flags.merge === undefined) {
        io.stderr(`workbook draft needs --merge <file>: the groups of identifiers that name one concept\n${USAGE}`);
        return 2;
    }
    const roadmap: Roadmap | null = resolvedRoadmap(repoRoot, name, io);
    if (roadmap === null) return 1;
    if (readInterview(repoRoot, name) === null) {
        io.stderr(`the roadmap ${name} has no interview, so no slice can be marked. Run 'nexus workbook interview ${name}' first — nothing was written.`);
        return 1;
    }

    const doc: unknown = parse(fs.readFileSync(flags.merge, "utf8"));
    const groups: unknown = (doc as Record<string, unknown> | null)?.["concepts"];
    const result: DraftResult = draftFromExtractions(repoRoot, roadmap, groups);
    if (!result.ok) {
        io.stderr(result.problem);
        return 1;
    }
    const handoffs: number = result.slices.filter((stub) => stub.builds === "handoff").length;
    io.stdout(
        `wrote the plan draft for ${name}: ${result.slices.length} slice${result.slices.length === 1 ? "" : "s"}, ` +
        `${result.slices.length - handoffs} learner and ${handoffs} handoff. It is not a plan anyone can be taught from until it is approved.`,
    );
    if (result.focusMatchedNothing) {
        io.stdout(
            `the recorded focus matched no story on the roadmap, so every slice is marked handoff. ` +
            `Whether the focus boundary is right is the reviewer's call at approval.`,
        );
    }
    io.stdout(`  ${result.path}`);
    return 0;
}

export function runWorkbookCli(argv: string[], io: WorkbookCliIo, run: Runner = defaultRunner): number {
    const [sub, ...rest] = argv;
    if (sub === undefined || !WORKBOOK_SUBVERBS.includes(sub)) {
        io.stderr(sub === undefined ? USAGE : `unknown subverb '${sub}' for workbook\n${USAGE}`);
        return 2;
    }
    const flags: Flags = parseFlags(rest, io.cwd);
    if (flags.unknown !== undefined) {
        io.stderr(`unknown argument for workbook ${sub}: ${flags.unknown}\n${USAGE}`);
        return 2;
    }
    const slug: string | undefined = flags.positional[0];
    if (slug === undefined && sub !== "roadmap") {
        io.stderr(`workbook ${sub} needs the workbook's name\n${USAGE}`);
        return 2;
    }
    const repoRoot: string | null = repoRootFor(flags, io);
    if (repoRoot === null) return 1;

    try {
        if (sub === "roadmap") return runRoadmap(repoRoot, slug, flags, io, run);

        if (sub === "interview") return runInterview(repoRoot, slug as string, flags, io, run);

        if (sub === "extract") return runExtract(repoRoot, slug as string, flags, io, run);

        if (sub === "vocabulary") return runVocabulary(repoRoot, slug as string, io);

        if (sub === "draft") return runDraft(repoRoot, slug as string, flags, io);

        if (sub === "create") {
            const made: CreatedWorkbook = createWorkbook(repoRoot, slug as string, run);
            io.stdout(
                made.created
                    ? `made the workbook ${made.relativePath}. Author lessons in ${LESSONS_DIRNAME}/ and run 'nexus workbook render ${slug}'.`
                    : `the workbook ${made.relativePath} is already there.`,
            );
            return 0;
        }

        if (sub === "render" || sub === "check") {
            const lessons = readLessons(repoRoot, slug);
            if (lessons.length === 0) {
                io.stderr(`${lessonsDir(repoRoot, slug)} holds no authored lesson, so there is nothing to ${sub}.`);
                return 1;
            }
            if (sub === "check") return reportDrift(repoRoot, slug, lessons, io);
            const written: string[] = renderWorkbookInto(workbookRoot(repoRoot, slug), { lessons });
            io.stdout(`rendered ${lessons.length} lesson${lessons.length === 1 ? "" : "s"} to ${workbookRoot(repoRoot, slug)}`);
            for (const name of written) io.stdout(`  ${name}`);
            io.stdout(`Open ${path.join(workbookRoot(repoRoot, slug), written.find((n) => n.endsWith(".html")) ?? "")} to read it — nothing needs to be started.`);
            return 0;
        }

        if (sub === "session") {
            const session: WorkbookSession = startWorkbookSession(repoRoot, slug);
            if (session.pages.length === 0) {
                io.stderr(`the workbook ${slug} holds no page yet. Run 'nexus workbook render ${slug}' first.`);
                return 1;
            }
            if (session.resumeAt === null) {
                io.stdout(`no handoff is outstanding — start at ${session.pages[0]}.`);
                return 0;
            }
            io.stdout(`resuming at the story that was handed off: ${session.resumeAt.story} (${session.resumeAt.id})`);
            io.stdout(`every outstanding handoff (${session.outstanding.length}):`);
            for (const handoff of session.outstanding) io.stdout(describeHandoff(handoff));
            return 0;
        }

        if (sub === "teach") {
            return reportSession(
                runTeachingSession({
                    repoRoot,
                    slug,
                    read: ghIssueReader(repoRoot, run),
                    prose: flags.prose === undefined ? undefined : readProse(flags.prose),
                    run,
                }),
                io,
            );
        }

        if (sub === "handoff") {
            if (flags.story === undefined || flags.story.trim() === "") {
                io.stderr(`workbook handoff needs --story: a handoff that names no story is not a handoff\n${USAGE}`);
                return 2;
            }
            // A pause at a story the plan does not teach can never be verified: the plan is where a
            // slice's pinning test lives, so there would be nothing for the return probe to run and
            // the pause could only ever be resolved by hand (invariant 18). A workbook with no plan
            // of slices teaches nothing, and its pauses keep the earlier contract untouched.
            const planned: WorkbookPlan | null = readWorkbookPlan(repoRoot, slug);
            const named: number = Number(flags.story.replace(/^#/, ""));
            if (planned !== null && !planned.slices.some((slice) => slice.story === named)) {
                io.stderr(
                    `${slug} teaches no slice for story ${flags.story}, so nothing here could ever ` +
                    `verify a pause at it — the plan is where a slice's pinning test lives. The ` +
                    `plan's stories are ${planned.slices.map((slice) => `#${slice.story}`).join(", ")}.`,
                );
                return 2;
            }
            const handoff: Handoff = recordHandoff(
                repoRoot,
                { story: flags.story, workbook: slug, recordedAt: new Date().toISOString(), note: flags.note },
                run,
            );
            io.stdout(`recorded ${handoff.id}: paused at story ${handoff.story}. The next session resumes there.`);
            return 0;
        }

        // sub === "resolve", the last declared subverb.
        const id: string | undefined = flags.positional[1];
        if (id === undefined) {
            io.stderr(`workbook resolve needs the handoff's id — 'nexus workbook session ${slug}' lists them\n${USAGE}`);
            return 2;
        }
        // Resolving by hand asserts what a session's return checks would have verified, so the
        // record says it was an override rather than saying the same word for both (record #469).
        const resolved: Handoff = resolveHandoff(repoRoot, id, new Date().toISOString(), run, "override");
        const left: Handoff[] = outstandingHandoffs(repoRoot).filter((h) => h.workbook === "" || h.workbook === slug);
        io.stdout(
            `resolved ${resolved.id} (story ${resolved.story}) as a manual override; ` +
            `${left.length} handoff${left.length === 1 ? "" : "s"} still outstanding.`,
        );
        return 0;
    } catch (error) {
        io.stderr(messageOf(error));
        return 1;
    }
}
