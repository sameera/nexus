/**
 * The workbook store (epic #405, story #444): the committed folder a learner's workbook lives in.
 *
 * A workbook is a reading surface for one repository's roadmap, so the store sits beside the queue
 * and the discovery store under the same hidden Nexus root — one location convention and one
 * exclusion family for all three (decision record #450). It is committed, because a page must be
 * readable by anyone who checks the repository out, and it is deliberately NOT under
 * `.nexus/queue/`: the queue is a close-time drain buffer, and nothing ever drains a workbook.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { type Runner, defaultRunner } from "@nexus/close-migration/run";
import { ensureLearnerIgnored } from "./learner-store.js";
import { NEXUS_ROOT_DIRNAME, WORKBOOK_STORE_DIRNAME, WORKBOOK_STORE_PATH } from "./pipeline-stores.js";

/** Absolute path of the workbook store inside a checkout. */
export function workbookStoreRoot(repoRoot: string): string {
    return path.join(repoRoot, NEXUS_ROOT_DIRNAME, WORKBOOK_STORE_DIRNAME);
}

/** Absolute path of one workbook inside the store. */
export function workbookRoot(repoRoot: string, slug: string): string {
    return path.join(workbookStoreRoot(repoRoot), slug);
}

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
 */
export function createWorkbook(repoRoot: string, slug: string, run: Runner = defaultRunner): CreatedWorkbook {
    if (slug.trim() === "" || slug.includes("/") || slug.includes("\\") || slug.startsWith(".")) {
        throw new Error(`invalid workbook slug ${JSON.stringify(slug)}: expected a single plain directory name`);
    }
    const root: string = workbookRoot(repoRoot, slug);
    const created: boolean = !fs.existsSync(root);
    fs.mkdirSync(root, { recursive: true });
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
