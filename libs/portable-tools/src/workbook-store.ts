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
 */
export function createWorkbook(repoRoot: string, slug: string): CreatedWorkbook {
    if (slug.trim() === "" || slug.includes("/") || slug.includes("\\") || slug.startsWith(".")) {
        throw new Error(`invalid workbook slug ${JSON.stringify(slug)}: expected a single plain directory name`);
    }
    const root: string = workbookRoot(repoRoot, slug);
    const created: boolean = !fs.existsSync(root);
    fs.mkdirSync(root, { recursive: true });
    return { root, relativePath: `${WORKBOOK_STORE_PATH}/${slug}`, created };
}
