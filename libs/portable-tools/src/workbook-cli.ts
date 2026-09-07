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
 * stale.
 */

import * as path from "node:path";
import { takeTargetRoot } from "@nexus/workspace/target-root";
import { type Runner, defaultRunner } from "@nexus/close-migration/run";
import { outstandingHandoffs, recordHandoff, resolveHandoff, startWorkbookSession, type Handoff, type WorkbookSession } from "./handoffs.js";
import { LESSONS_DIRNAME, createWorkbook, lessonsDir, readLessons, workbookRoot, type CreatedWorkbook } from "./workbook-store.js";
import { renderWorkbookInto } from "./workbook-render.js";
import { resolveWorkbookHome, type WorkbookHomeResult } from "./workbook-placement.js";

/** The subverbs `nexus workbook` dispatches. */
export const WORKBOOK_SUBVERBS: readonly string[] = ["create", "render", "session", "handoff", "resolve"];

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
        else if (token.startsWith("--")) {
            flags.unknown = token;
            return flags;
        } else flags.positional.push(token);
    }
    return flags;
}

const USAGE: string = [
    "usage: nexus workbook <create|render|session|handoff|resolve> <slug> [--root <dir>] [--repo <member>]",
    "  create <slug>                       make the workbook and ensure the learner folder is ignored",
    "  render <slug>                       render every authored lesson to its page",
    "  session <slug>                      start a session: the pages, and the handoff it resumes at",
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

        if (sub === "render") {
            const lessons = readLessons(repoRoot, slug);
            if (lessons.length === 0) {
                io.stderr(`${lessonsDir(repoRoot, slug)} holds no authored lesson, so there is nothing to render.`);
                return 1;
            }
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
        const resolved: Handoff = resolveHandoff(repoRoot, id, new Date().toISOString());
        const left: Handoff[] = outstandingHandoffs(repoRoot).filter((h) => h.workbook === "" || h.workbook === slug);
        io.stdout(`resolved ${resolved.id} (story ${resolved.story}); ${left.length} handoff${left.length === 1 ? "" : "s"} still outstanding.`);
        return 0;
    } catch (error) {
        io.stderr(messageOf(error));
        return 1;
    }
}
