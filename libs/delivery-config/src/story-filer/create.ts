/**
 * Pass 1: file every issue, and record each one the moment it exists (story #369).
 *
 * The ordering here is the whole point. The issue exists on GitHub the instant `gh issue create`
 * returns, so the ledger is written before any typing, parent linking or project work is attempted
 * (Invariant 3) — a crash inside that decoration costs a warning on the next run, not a duplicate
 * issue. Everything after the ledger write is best-effort: an issue that already exists is never
 * abandoned over its decoration (Invariant 8).
 */

import { type GhRunner, setIssueType } from "../gh.js";
import { type ToolkitIo } from "../io.js";
import { type FilerConfig } from "./configure.js";
import { type WorkItem, fileStem } from "./frontmatter.js";
import { type Ledger, type LedgerEntry, saveLedger } from "./ledger.js";
import { type Platform, extractIssueNumber } from "./platform.js";

/** What pass 1 hands the later passes about one work item. */
export interface CreatedRecord {
    ref: string;
    number: string | null;
    dbId: string | null;
    blockedBy: string[];
    parent: string;
    /** True when the ledger already carried this ref and no issue was created. */
    reused: boolean;
}

/** Where an issue's board membership comes from. Wired by story #370; inert until then. */
export interface ProjectAssignment {
    /** The project node id this item's issue belongs in, or null for none. */
    idFor: (item: WorkItem) => string | null;
    add: (projectId: string, issueNodeId: string) => boolean;
}

export const NO_PROJECT: ProjectAssignment = { idFor: () => null, add: () => false };

export interface CreatePassResult {
    created: CreatedRecord[];
    /** The work items whose issue could not be created, by file name. */
    failed: string[];
}

export interface CreatePassDeps {
    platform: Platform;
    /** The non-retrying runner the shared helpers take, exactly as they take it today. */
    plainRun: GhRunner;
    /** The issue type to apply, or null when this run classifies by label. */
    issueTypeId: string | null;
    ledger: Ledger;
    ledgerPath: string;
    projects: ProjectAssignment;
}

export function createPass(
    items: WorkItem[],
    config: FilerConfig,
    deps: CreatePassDeps,
    io: ToolkitIo,
): CreatePassResult {
    const created: CreatedRecord[] = [];
    const failed: string[] = [];

    for (const item of items) {
        const record: CreatedRecord | null = fileOne(item, config, deps, io);
        if (record === null) failed.push(item.fileName);
        else created.push(record);
    }

    const fresh: number = created.filter((record) => !record.reused).length;
    io.stdout("");
    io.stdout(`Pass 1: ${fresh} created, ${created.length - fresh} reused, ${failed.length} failed (of ${items.length})`);
    return { created, failed };
}

function fileOne(
    item: WorkItem,
    config: FilerConfig,
    deps: CreatePassDeps,
    io: ToolkitIo,
): CreatedRecord | null {
    io.stdout(`Processing: ${item.filePath}`);

    const carried: LedgerEntry | undefined = deps.ledger[item.ref];
    if (carried !== undefined) return resume(item, carried, deps, io);

    const labels: string[] =
        config.classification !== "types" && !item.labels.includes(config.classificationLabel)
            ? [config.classificationLabel, ...item.labels]
            : item.labels;

    let title: string = item.title;
    if (title === "") {
        io.stderr("  Warning: No title in frontmatter, using filename");
        title = fileStem(item.fileName);
    }

    const url: string | null = deps.platform.createIssue(title, labels, item.body);
    if (url === null || url === "") {
        io.stderr(`  Failed to create issue for ${item.filePath}`);
        return null;
    }
    io.stdout(`  Created issue: ${url}`);

    const number: string | null = extractIssueNumber(url);
    const dbId: string | null = number !== null ? deps.platform.issueDbId(number) : null;

    // Before anything else. The issue exists now; a duplicate is the one failure this capability
    // cannot take back.
    if (number !== null) {
        deps.ledger[item.ref] = { number, db_id: dbId, url, title };
        saveLedger(deps.ledgerPath, deps.ledger, io);
    }

    if (number !== null) decorate(item, number, deps, io);

    return { ref: item.ref, number, dbId, blockedBy: item.blockedBy, parent: item.parent, reused: false };
}

/** A ref the ledger already carries: reuse the issue, and backfill a database id an older run missed. */
function resume(item: WorkItem, carried: LedgerEntry, deps: CreatePassDeps, io: ToolkitIo): CreatedRecord {
    const number: string | null = carried.number ?? null;
    let dbId: string | null = carried.db_id ?? null;
    if ((dbId === null || dbId === "") && number !== null) {
        dbId = deps.platform.issueDbId(number);
        if (dbId !== null && dbId !== "") {
            carried.db_id = dbId;
            saveLedger(deps.ledgerPath, deps.ledger, io);
        }
    }
    io.stdout(`  Resuming: ref '${item.ref}' already created as #${number} — skipping creation`);
    return { ref: item.ref, number, dbId, blockedBy: item.blockedBy, parent: item.parent, reused: true };
}

/** Issue type, project membership and the parent link — every one of them best-effort. */
function decorate(item: WorkItem, number: string, deps: CreatePassDeps, io: ToolkitIo): void {
    if (deps.issueTypeId !== null) {
        const nodeId: string | null = deps.platform.issueNodeId(number);
        if (nodeId !== null && nodeId !== "" && setIssueType(nodeId, deps.issueTypeId, deps.plainRun)) {
            io.stdout("  Issue type set");
        } else {
            io.stderr(`  Warning: could not set issue type on #${number}`);
        }
    }

    const projectId: string | null = deps.projects.idFor(item);
    if (projectId !== null && projectId !== "") {
        const nodeId: string | null = deps.platform.issueNodeId(number);
        if (nodeId !== null && nodeId !== "") {
            if (deps.projects.add(projectId, nodeId)) io.stdout("  Added to project");
            else io.stderr("  Warning: Failed to add issue to project");
        }
    }

    if (item.parent !== "") {
        if (deps.platform.assignParent(number, item.parent)) io.stdout(`  Linked as sub-issue of: ${item.parent}`);
        else io.stderr("  Warning: Failed to create sub-issue relationship");
    }
}
