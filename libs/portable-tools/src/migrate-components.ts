/**
 * The repository migration verb (story #315): remove a repository's committed Nexus component set,
 * deliberately, so nobody is surprised by tracked files vanishing from a branch they were working
 * on.
 *
 * It is the removal mirror pointed at a repository rather than at the account, and it carries three
 * guards the other two call sites do not have and must not acquire (decision record #339):
 *
 * - It runs only when an install location resolves AND holds a component set, and it reports that
 *   location and which of the two contents it holds before removing anything. Migrating a
 *   repository off its copy while no account-level copy exists would leave the owner with nothing.
 * - It removes only namespaced files git TRACKS. The epic buys out of a dry-run flag, per-file
 *   confirmation and backups with one argument — the files are tracked, so git is the undo — and
 *   that argument is simply false for an untracked file. Untracked ones are listed and left.
 * - It touches neither the index nor a commit. The removals land as unstaged working-tree changes
 *   for the owner to review, and every git command it prints names explicit paths rather than
 *   sweeping a working tree that already holds the owner's other work.
 *
 * Its namespace match is one level wider than the install location's: repositories carry
 * Nexus-named files directly at the component directory's top level, and a migration that leaves
 * them behind has not removed Nexus. That widening belongs here only — the install location's top
 * level holds the harness's own account state.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { deployComponents, EMPTY_PAYLOAD, type DeployResult } from "./deploy-components.js";
import { COMPONENT_SUBTREES } from "./vendor-components.js";

/** The component directory name a repository carries. */
export const REPO_COMPONENT_DIRNAME = ".claude";

/** Run a git command in `cwd`, returning its stdout, or null when it fails. */
export type GitRunner = (args: string[], cwd: string) => string | null;

export const defaultGitRunner: GitRunner = (args: string[], cwd: string): string | null => {
    try {
        return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch {
        return null;
    }
};

/**
 * The ignore entries the migration appends: namespace-prefixed names WITHIN the three managed
 * subtrees. Never the subtrees wholesale and never the component directory as a whole — a blanket
 * ignore would hide an adopter's own components, which is the harm the no-blanket rule names.
 */
export const IGNORE_ENTRIES: readonly string[] = COMPONENT_SUBTREES.flatMap((subtree) => [
    `${REPO_COMPONENT_DIRNAME}/${subtree}/nxs.*`,
    `${REPO_COMPONENT_DIRNAME}/${subtree}/nxs-*`,
]);

/** The header written above the entries the first time any of them is appended. */
export const IGNORE_HEADER = "# Nexus components are installed per account, not committed per repository (nexus install).";

export type MigrationResult =
    | { ok: false; message: string }
    | {
          ok: true;
          /** Component-root-relative paths removed from the working tree. */
          removed: string[];
          /** Namespaced paths left in place because git does not track them. */
          untracked: string[];
          /** Ignore entries appended by this run (empty on a re-run). */
          ignoreAdded: string[];
          /** The git commands the owner may run, each naming explicit paths. */
          gitCommands: string[];
      };

export interface MigrationOptions {
    repoRoot: string;
    git?: GitRunner;
}

/** Every path git tracks under the repository's component directory, repo-relative. */
function trackedComponentPaths(git: GitRunner, repoRoot: string): Set<string> | null {
    const inside: string | null = git(["rev-parse", "--is-inside-work-tree"], repoRoot);
    if (inside === null || inside.trim() !== "true") {
        return null;
    }
    const listed: string | null = git(["ls-files", "--", REPO_COMPONENT_DIRNAME], repoRoot);
    return new Set<string>(
        (listed ?? "")
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line !== ""),
    );
}

/**
 * Append the namespaced ignore entries. Append-only and idempotent: an entry already present is
 * left where it is, nothing is reordered, and nothing already written is rewritten.
 */
export function appendIgnoreEntries(repoRoot: string): string[] {
    const ignorePath: string = path.join(repoRoot, ".gitignore");
    const existing: string = fs.existsSync(ignorePath) ? fs.readFileSync(ignorePath, "utf8") : "";
    const present = new Set<string>(existing.split("\n").map((line) => line.trim()));
    const missing: string[] = IGNORE_ENTRIES.filter((entry) => !present.has(entry));
    if (missing.length === 0) {
        return [];
    }
    const separator: string = existing === "" || existing.endsWith("\n") ? "" : "\n";
    const header: string = present.has(IGNORE_HEADER) ? "" : `${IGNORE_HEADER}\n`;
    fs.appendFileSync(ignorePath, `${separator}${existing === "" ? "" : "\n"}${header}${missing.join("\n")}\n`);
    return missing;
}

/**
 * Migrate `repoRoot` off its committed component set. The caller has already established that an
 * install location resolves and is populated — that gate is the verb's, so this function is never
 * reached in the state where removing would leave the owner with no components at all.
 */
export function migrateComponents(options: MigrationOptions): MigrationResult {
    const { repoRoot } = options;
    const git: GitRunner = options.git ?? defaultGitRunner;

    const tracked: Set<string> | null = trackedComponentPaths(git, repoRoot);
    if (tracked === null) {
        return { ok: false, message: `${repoRoot} is not inside a git work tree; migration removes only files git tracks, so it will not run here` };
    }

    const componentRoot: string = path.join(repoRoot, REPO_COMPONENT_DIRNAME);
    const result: DeployResult = deployComponents(EMPTY_PAYLOAD, componentRoot, {
        includeRootLevel: true,
        removable: (rel: string): boolean => tracked.has(`${REPO_COMPONENT_DIRNAME}/${rel}`),
    });

    const ignoreAdded: string[] = appendIgnoreEntries(repoRoot);

    // Explicit paths, never a working-tree sweep: this verb runs against a branch the owner was
    // already working on, and a command that swept the tree would offer a commit of the rest of it.
    const gitCommands: string[] = [
        `git add -- ${REPO_COMPONENT_DIRNAME} .gitignore`,
        'git commit -m "chore: remove committed Nexus components"',
    ];

    return { ok: true, removed: result.removed, untracked: result.retained, ignoreAdded, gitCommands };
}
