/**
 * The workbook store (epic #405, story #444): the committed folder a learner's workbook lives in.
 *
 * A workbook is a reading surface for one repository's roadmap, so the store sits beside the queue
 * and the discovery store under the same hidden Nexus root — one location convention and one
 * exclusion family for all three (decision record #450). It is committed, because a page must be
 * readable by anyone who checks the repository out, and it is deliberately NOT under
 * `.nexus/queue/`: the queue is a close-time drain buffer, and nothing ever drains a workbook.
 *
 * In a workspace with a hub and members the store lives in the member repository whose roadmap the
 * workbook teaches (invariant 6). That is enforced here rather than left to callers: creation asks
 * `workbook-placement.ts` first, so a hub checkout cannot gain a workbook store even by mistake.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "yaml";
import { type Runner, defaultRunner } from "@nexus/close-migration/run";
import { ensureLearnerIgnored } from "./learner-store.js";
import { assertWorkbookHome } from "./workbook-placement.js";
import { PLAN_FILENAME, parsePlan, type WorkbookPlan } from "./workbook-plan.js";
import { NEXUS_ROOT_DIRNAME, WORKBOOK_STORE_DIRNAME, WORKBOOK_STORE_PATH } from "./pipeline-stores.js";
import { type LessonSource } from "./workbook-render.js";

/** Absolute path of the workbook store inside a checkout. */
export function workbookStoreRoot(repoRoot: string): string {
    return path.join(repoRoot, NEXUS_ROOT_DIRNAME, WORKBOOK_STORE_DIRNAME);
}

/** Absolute path of one workbook inside the store. */
export function workbookRoot(repoRoot: string, slug: string): string {
    return path.join(workbookStoreRoot(repoRoot), slug);
}

/** The authored lessons' folder inside one workbook. Prose in, pages out beside it. */
export const LESSONS_DIRNAME: string = "lessons";

export interface CreatedWorkbook {
    /** Absolute path of the created workbook folder. */
    root: string;
    /** Repo-relative path of the created workbook folder, forward-slashed. */
    relativePath: string;
    /** False when the folder already existed — creation is idempotent. */
    created: boolean;
}

/**
 * Create a workbook inside the store, making the store itself on first use. A repository may hold
 * one workbook per roadmap, so the store is a parent of many.
 *
 * Creation also ensures the one rule that excludes the learner folder. Ignore rules are seeded at
 * setup while the store is created on first use, so a repository set up before workbooks existed
 * would otherwise gain the store without the rule — and a personal record committed to a shared
 * repository cannot be taken back.
 *
 * A hub checkout is refused: a workbook teaches one repository's roadmap, so it belongs to the
 * member repository holding that roadmap.
 */
export function createWorkbook(repoRoot: string, slug: string, run: Runner = defaultRunner): CreatedWorkbook {
    if (slug.trim() === "" || slug.includes("/") || slug.includes("\\") || slug.startsWith(".")) {
        throw new Error(`invalid workbook slug ${JSON.stringify(slug)}: expected a single plain directory name`);
    }
    assertWorkbookHome(repoRoot);
    const root: string = workbookRoot(repoRoot, slug);
    const created: boolean = !fs.existsSync(root);
    fs.mkdirSync(path.join(root, LESSONS_DIRNAME), { recursive: true });
    ensureLearnerIgnored(repoRoot, run);
    return { root, relativePath: `${WORKBOOK_STORE_PATH}/${slug}`, created };
}

/** One lesson page a learner can open, named by its file name inside the workbook. */
export interface OpenedWorkbook {
    /** Every page in the workbook, sorted, so opening it is deterministic. */
    pages: string[];
}

/**
 * Open a workbook: what a learner sees when they come to it. Pages come from the workbook folder
 * alone — no personal record is an input (record #450, invariant 10), so a checkout whose learner
 * folder is empty reads exactly like one that is full.
 */
export function openWorkbook(repoRoot: string, slug: string): OpenedWorkbook {
    const root: string = workbookRoot(repoRoot, slug);
    if (!fs.existsSync(root)) return { pages: [] };
    const pages: string[] = fs
        .readdirSync(root, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith(".html"))
        .map((e) => e.name)
        .sort();
    return { pages };
}

/** Absolute path of one workbook's authored lessons. */
export function lessonsDir(repoRoot: string, slug: string): string {
    return path.join(workbookRoot(repoRoot, slug), LESSONS_DIRNAME);
}

/**
 * The authored lessons of one workbook, in the order the plan gives them.
 *
 * The plan is the second input the renderer takes (record #450): `plan.yml` names the lessons in
 * teaching order. Without one the order is the lessons' file names, which is deterministic but
 * says nothing about teaching — a workbook that cares about sequence writes the plan.
 *
 * A plan that describes *slices* (epic #407) is a teaching plan, and there an absent lesson is the
 * normal state: lessons are written on arrival, so every slice past the frontier is a stub. The
 * refusal that fires when the plan names a lesson the folder does not hold therefore narrows to
 * slices marked as written (record #469). The other half of the agreement stands either way — a
 * lesson the plan does not name still has no place in the workbook.
 */
export function readLessons(repoRoot: string, slug: string): LessonSource[] {
    const dir: string = lessonsDir(repoRoot, slug);
    if (!fs.existsSync(dir)) return [];
    const present: string[] = writtenLessonFiles(repoRoot, slug);
    const read = (file: string): LessonSource => ({ file, source: fs.readFileSync(path.join(dir, file), "utf8") });

    const planText: string | null = readPlanText(repoRoot, slug);
    if (planText === null) return present.map(read);

    const order: string[] = plannedOrder(planText);
    const stubs: string[] = order.filter((file) => !present.includes(file));
    if (stubs.length > 0 && !hasSlices(planText)) {
        throw new Error(
            `${PLAN_FILENAME} names ${stubs.join(", ")}, which ${LESSONS_DIRNAME}/ does not hold. ` +
            `The plan and the lessons must agree before a workbook renders.`,
        );
    }
    const unplanned: string[] = present.filter((file) => !order.includes(file));
    if (unplanned.length > 0) {
        throw new Error(
            `${LESSONS_DIRNAME}/ holds ${unplanned.join(", ")}, which ${PLAN_FILENAME} does not name. ` +
            `A lesson with no place in the plan has no place in the workbook.`,
        );
    }
    return order.filter((file) => present.includes(file)).map(read);
}

/** The lesson files this workbook actually holds, sorted, so reading them is deterministic. */
export function writtenLessonFiles(repoRoot: string, slug: string): string[] {
    const dir: string = lessonsDir(repoRoot, slug);
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith(".md"))
        .map((e) => e.name)
        .sort();
}

/** The plan file's text, or null when the workbook declares no plan at all. */
function readPlanText(repoRoot: string, slug: string): string | null {
    const planFile: string = path.join(workbookRoot(repoRoot, slug), PLAN_FILENAME);
    return fs.existsSync(planFile) ? fs.readFileSync(planFile, "utf8") : null;
}

/** True when the plan describes slices, which is what makes an absent lesson a stub. */
function hasSlices(planText: string): boolean {
    const doc: unknown = parse(planText);
    return Array.isArray((doc as Record<string, unknown> | null)?.["slices"]);
}

/** The teaching order the plan gives, from its slices or from a plain list of lesson files. */
function plannedOrder(planText: string): string[] {
    if (hasSlices(planText)) {
        // A handoff slice names no lesson: it is neither built nor taught by the learner, so it is
        // no part of the workbook's reading order.
        return parsePlan(planText).slices.map((slice) => slice.lesson).filter((lesson) => lesson !== "");
    }
    const named: unknown = (parse(planText) as Record<string, unknown> | null)?.["lessons"];
    if (!Array.isArray(named)) {
        throw new Error(`${PLAN_FILENAME} declares no 'lessons' list, so the workbook has no order to render in`);
    }
    return named.map((entry) => String(entry));
}

/**
 * The workbook's plan, or null when it declares none. A workbook with no slices is one the earlier
 * epic's renderer serves — it orders lessons and teaches nothing, so there is no plan to teach from.
 */
export function readWorkbookPlan(repoRoot: string, slug: string): WorkbookPlan | null {
    const planText: string | null = readPlanText(repoRoot, slug);
    if (planText === null || !hasSlices(planText)) return null;
    return parsePlan(planText);
}
