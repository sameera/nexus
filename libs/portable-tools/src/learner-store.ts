/**
 * The learner's folder (epic #405, story #445): everything a workbook retains about one person.
 *
 * A workbook is committed, so the team shares it. What the workbook retains about a person — what
 * they have learned, how far they got, where they asked for a hint — is committed by the same act,
 * and a repository may reasonably not want to commit a person's stumbles. Putting all of it under
 * one folder makes excluding it a single line rather than an audit.
 *
 * The folder is a direct child of the store rather than of each workbook (decision record #450),
 * so a repository holding a second workbook needs no second ignore rule. And nothing writes a
 * personal record until git confirms the target path is ignored: the failure is asymmetric —
 * a missing rule commits a person's stumbles to a shared repository, and git history makes that
 * effectively irreversible. Asking git also works when the rule lives in a nested or a global
 * ignore file, which matching text in one file would miss.
 *
 * Nothing here is an input to a lesson page. A page is derived from the authored lesson and the
 * plan that orders it and from nothing else (invariant 10), so an empty learner folder cannot
 * change what any page reads.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { type Runner, defaultRunner } from "@nexus/close-migration/run";
import { WORKBOOK_STORE_PATH } from "./pipeline-stores.js";
import { workbookStoreRoot } from "./workbook-store.js";

/** The learner folder's name, directly beneath the workbook store. */
export const LEARNER_DIRNAME: string = ".learner";

/** Repo-relative path of the learner folder. */
export const LEARNER_PATH: string = `${WORKBOOK_STORE_PATH}/${LEARNER_DIRNAME}`;

/** The one ignore rule that covers the learner folder, whatever the store holds. */
export const LEARNER_IGNORE_RULE: string = `${LEARNER_PATH}/`;

/**
 * The kinds of record the workbook retains about a person. Every one of them lives under the
 * learner folder; none exists anywhere else.
 */
export const LEARNER_RECORD_KINDS: readonly string[] = [
    "concept-ledger",
    "progress",
    "learning-records",
    "hint-log",
    "handoffs",
];

export type LearnerRecordKind = (typeof LEARNER_RECORD_KINDS)[number];

/** Absolute path of the learner folder inside a checkout. */
export function learnerFolder(repoRoot: string): string {
    return path.join(workbookStoreRoot(repoRoot), LEARNER_DIRNAME);
}

/** Absolute path of one kind's folder inside the learner folder. */
export function learnerRecordDir(repoRoot: string, kind: LearnerRecordKind): string {
    return path.join(learnerFolder(repoRoot), kind);
}

/** True when git — asked, not guessed — ignores the path. */
export function isIgnoredByGit(repoRoot: string, target: string, run: Runner = defaultRunner): boolean {
    const rel: string = path.relative(repoRoot, target).split(path.sep).join("/");
    return run("git", ["check-ignore", "-q", "--", rel], { cwd: repoRoot }).status === 0;
}

/**
 * True when the learner folder is covered. The question is asked about a path *inside* the folder,
 * because a directory-only rule tells git nothing about a directory that does not exist yet, and
 * the folder is created on first write. What matters is that no record under it can be committed.
 */
export function isLearnerFolderIgnored(repoRoot: string, run: Runner = defaultRunner): boolean {
    return isIgnoredByGit(repoRoot, path.join(learnerFolder(repoRoot), "progress", "progress.json"), run);
}

/**
 * Ensure the one rule that excludes the learner folder exists. Ignore rules are seeded at setup,
 * but the store is created on first use, so a repository set up before the workbook existed has
 * the store without the rule — the step that creates a workbook ensures the rule itself rather
 * than assuming setup did.
 */
export function ensureLearnerIgnored(repoRoot: string, run: Runner = defaultRunner): { added: boolean } {
    if (isLearnerFolderIgnored(repoRoot, run)) return { added: false };
    const file: string = path.join(repoRoot, ".gitignore");
    const existing: string = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    const separator: string = existing === "" || existing.endsWith("\n") ? "" : "\n";
    const block: string =
        `${separator}\n# Everything the workbook retains about one person. One rule, whatever the\n` +
        `# store holds — a page is never derived from any of it.\n${LEARNER_IGNORE_RULE}\n`;
    fs.writeFileSync(file, existing + block);
    return { added: true };
}

/** Raised instead of writing a personal record git would let the repository commit. */
export class UnignoredLearnerPathError extends Error {
    readonly target: string;
    constructor(target: string) {
        super(
            `refusing to write ${target}: git does not ignore it. Everything the workbook retains ` +
            `about a person lives under ${LEARNER_PATH}/, excluded by one rule (${LEARNER_IGNORE_RULE}). ` +
            `Add that rule — a personal record committed to a shared repository cannot be taken back.`,
        );
        this.name = "UnignoredLearnerPathError";
        this.target = target;
    }
}

/**
 * Write one personal record, but only once git confirms the path is ignored. The check is per
 * write, not per session: a rule removed between two writes must stop the second one.
 */
export function writeLearnerRecord(
    repoRoot: string,
    kind: LearnerRecordKind,
    name: string,
    body: string,
    run: Runner = defaultRunner,
): string {
    const target: string = path.join(learnerRecordDir(repoRoot, kind), name);
    if (!isIgnoredByGit(repoRoot, target, run)) throw new UnignoredLearnerPathError(target);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
    return target;
}

/** Read one personal record back, or null when the learner folder holds none. */
export function readLearnerRecord(repoRoot: string, kind: LearnerRecordKind, name: string): string | null {
    const target: string = path.join(learnerRecordDir(repoRoot, kind), name);
    return fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null;
}

/** The names of every record of one kind, sorted, so a read over them is deterministic. */
export function listLearnerRecords(repoRoot: string, kind: LearnerRecordKind): string[] {
    const dir: string = learnerRecordDir(repoRoot, kind);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).sort();
}
