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
import { type Runner, defaultRunner } from "@nexus/close-migration/run";
import { outstandingHandoffs, recordHandoff, resolveHandoff, startWorkbookSession, type Handoff, type WorkbookSession } from "./handoffs.js";
import { LESSONS_DIRNAME, createWorkbook, lessonsDir, readLessons, workbookRoot, type CreatedWorkbook } from "./workbook-store.js";
import { checkWorkbook, renderWorkbookInto, type LessonSource, type WorkbookDrift } from "./workbook-render.js";
import { resolveWorkbookHome, type WorkbookHomeResult } from "./workbook-placement.js";
import { type AuthoredProse } from "./lesson-writer.js";
import { type IssueReader, type LiveStory } from "./teaching-plan.js";
import { runTeachingSession, type SessionResult } from "./teaching-session.js";

/** The subverbs `nexus workbook` dispatches. */
export const WORKBOOK_SUBVERBS: readonly string[] = ["create", "render", "check", "session", "teach", "handoff", "resolve"];

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
        else if (token.startsWith("--")) {
            flags.unknown = token;
            return flags;
        } else flags.positional.push(token);
    }
    return flags;
}

const USAGE: string = [
    "usage: nexus workbook <create|render|check|session|handoff|resolve> <slug> [--root <dir>] [--repo <member>]",
    "  create <slug>                       make the workbook and ensure the learner folder is ignored",
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
 * matter when the brief asked for a drill. The chain chose the concept; this file carries only what
 * an agent contributes.
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
    const theory: string = lines.slice(end + 2).join("\n");
    return typeof question === "string" && typeof answer === "string"
        ? { theory, drill: { question, answer } }
        : { theory };
}

/** The outcomes that mean the session stopped rather than taught. They exit non-zero. */
const STOPPED: readonly string[] = ["no-plan", "suite-red", "unintegrated", "breach", "drift"];

/** Report one session: what it did, what drift it saw on the way, and what it could not read. */
function reportSession(result: SessionResult, io: WorkbookCliIo): number {
    const stopped: boolean = STOPPED.includes(result.outcome.kind);
    (stopped ? io.stderr : io.stdout)(result.outcome.report);
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
    if (slug === undefined) {
        io.stderr(`workbook ${sub} needs the workbook's name\n${USAGE}`);
        return 2;
    }
    const repoRoot: string | null = repoRootFor(flags, io);
    if (repoRoot === null) return 1;

    try {
        if (sub === "create") {
            const made: CreatedWorkbook = createWorkbook(repoRoot, slug, run);
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
        const resolved: Handoff = resolveHandoff(repoRoot, id, new Date().toISOString(), run);
        const left: Handoff[] = outstandingHandoffs(repoRoot).filter((h) => h.workbook === "" || h.workbook === slug);
        io.stdout(`resolved ${resolved.id} (story ${resolved.story}); ${left.length} handoff${left.length === 1 ? "" : "s"} still outstanding.`);
        return 0;
    } catch (error) {
        io.stderr(messageOf(error));
        return 1;
    }
}
