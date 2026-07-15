/**
 * migrate → verify → gated-remove; removal fires only on a verified hub commit.
 *
 * The safety invariant is the order: the code repo's queue entry is committed into the
 * hub, the hub commit is read back and compared byte-for-byte against the source, and
 * only on that confirmation does step 7 remove the entry from the code repo. Never
 * reorder these steps.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { type MigrationDiagnostic } from "./diagnostic.js";
import { closePreflight } from "./preflight.js";
import { type Runner, defaultRunner, git } from "./run.js";

export interface MigrateOutcome {
    entryName: string;
    hubRoot: string;
    hubBranch: string;
    hubCommit: string; // full SHA
    alreadyMigrated: boolean; // true on the idempotent re-run path
    removalCommit: string | null; // null when the entry had no tracked files
}

export type MigrateResult =
    | { ok: true; outcome: MigrateOutcome }
    | { ok: false; error: MigrationDiagnostic };

/** Sorted relative-path → git blob SHA for every file under entryDir (untracked included). */
function sourceManifest(entryDir: string, run: Runner): Map<string, string> {
    const manifest = new Map<string, string>();
    const walk = (dir: string, relPrefix: string) => {
        for (const name of fs.readdirSync(dir).sort()) {
            const abs = path.join(dir, name);
            const rel = relPrefix ? `${relPrefix}/${name}` : name;
            if (fs.statSync(abs).isDirectory()) {
                walk(abs, rel);
            } else {
                const sha = git(run, entryDir, "hash-object", abs);
                if (sha) {
                    manifest.set(rel, sha);
                }
            }
        }
    };
    walk(entryDir, "");
    return manifest;
}

/** Parse `git ls-tree -r HEAD -- <relPath>` output into relative-path → blob SHA. */
function parseLsTree(output: string, relPath: string): Map<string, string> {
    const map = new Map<string, string>();
    for (const line of output.split("\n")) {
        if (!line) {
            continue;
        }
        const tab = line.indexOf("\t");
        if (tab === -1) {
            continue;
        }
        const sha = line.slice(0, tab).split(" ")[2];
        const filePath = line.slice(tab + 1);
        const prefix = `${relPath}/`;
        if (!sha || !filePath.startsWith(prefix)) {
            continue;
        }
        map.set(filePath.slice(prefix.length), sha);
    }
    return map;
}

function manifestsEqual(a: Map<string, string>, b: Map<string, string>): boolean {
    if (a.size !== b.size) {
        return false;
    }
    for (const [key, sha] of a) {
        if (b.get(key) !== sha) {
            return false;
        }
    }
    return true;
}

export function migrateEntry(entryDir: string, run: Runner = defaultRunner): MigrateResult {
    // --- 1. Gate ---------------------------------------------------------
    if (!fs.existsSync(path.join(entryDir, "epic.md"))) {
        return {
            ok: false,
            error: {
                file: entryDir,
                problem: "entry-not-found",
                message: `${entryDir} does not exist or has no epic.md; nothing to migrate`,
            },
        };
    }
    const codeRoot = git(run, entryDir, "rev-parse", "--show-toplevel");
    if (!codeRoot) {
        return {
            ok: false,
            error: {
                file: entryDir,
                problem: "not-a-git-repo",
                message: `${entryDir} is not inside a git checkout`,
            },
        };
    }
    const preflightResult = closePreflight(codeRoot, run);
    if (!preflightResult.ok) {
        return { ok: false, error: preflightResult.error };
    }
    const preflight = preflightResult.preflight;
    if (preflight.role !== "member" || !preflight.hub) {
        return {
            ok: false,
            error: {
                file: codeRoot,
                problem: "wrong-role",
                message:
                    "migration runs only in a workspace member repo; in single-repo and hub mode the entry stays put",
            },
        };
    }
    if (preflight.hub.branch === "(detached HEAD)") {
        return {
            ok: false,
            error: {
                file: preflight.hub.root,
                problem: "hub-detached-head",
                message: `hub '${preflight.hub.name}' at ${preflight.hub.root} is on a detached HEAD; check out a branch in the hub before closing`,
            },
        };
    }

    const hubRoot = preflight.hub.root;
    const hubBranch = preflight.hub.branch;
    const entryName = path.basename(entryDir);
    const relPath = `.nexus/queue/${entryName}`;
    const dest = path.join(hubRoot, ".nexus", "queue", entryName);

    // --- 2. Source manifest -----------------------------------------------
    const manifest = sourceManifest(entryDir, run);

    let alreadyMigrated = false;
    let hubCommit: string;

    if (fs.existsSync(dest)) {
        // --- 3. Collision / idempotency ------------------------------------
        const committedTree = parseLsTree(
            git(run, hubRoot, "ls-tree", "-r", "HEAD", "--", relPath) ?? "",
            relPath,
        );
        const dirty = git(run, hubRoot, "status", "--porcelain", "--", relPath);
        if (manifestsEqual(committedTree, manifest) && dirty === "") {
            alreadyMigrated = true;
            hubCommit = git(run, hubRoot, "rev-parse", "HEAD") ?? "";
        } else {
            return {
                ok: false,
                error: {
                    file: dest,
                    entry: entryName,
                    problem: "entry-conflict",
                    message: `the hub queue already holds '${relPath}' and it differs from this repo's entry; inspect ${dest}, remove or reconcile it, then re-run /nxs.close`,
                },
            };
        }
    } else {
        // --- 4. Copy -------------------------------------------------------
        fs.mkdirSync(path.join(hubRoot, ".nexus", "queue"), { recursive: true });
        fs.cpSync(entryDir, dest, { recursive: true });

        const cleanup = () => {
            git(run, hubRoot, "reset", "-q", "--", relPath);
            fs.rmSync(dest, { recursive: true, force: true });
        };

        // --- 5. Hub commit (path-scoped) -----------------------------------
        const addResult = run("git", ["add", "--", relPath], { cwd: hubRoot });
        const commitResult =
            addResult.status === 0
                ? run(
                      "git",
                      [
                          "commit",
                          "-m",
                          `closure: migrate queue entry ${entryName} from ${preflight.repo.identity}`,
                          "--",
                          relPath,
                      ],
                      { cwd: hubRoot },
                  )
                : addResult;
        if (addResult.status !== 0 || commitResult.status !== 0) {
            cleanup();
            return {
                ok: false,
                error: {
                    file: hubRoot,
                    entry: entryName,
                    problem: "hub-commit-failed",
                    message: `failed to commit the migrated entry in the hub: ${commitResult.stderr || addResult.stderr}`,
                },
            };
        }

        // --- 6. Verify -------------------------------------------------------
        hubCommit = git(run, hubRoot, "rev-parse", "HEAD") ?? "";
        const verifyTree = parseLsTree(
            git(run, hubRoot, "ls-tree", "-r", "HEAD", "--", relPath) ?? "",
            relPath,
        );
        const verifyStatus = git(run, hubRoot, "status", "--porcelain", "--", relPath);
        if (!manifestsEqual(verifyTree, manifest) || verifyStatus !== "") {
            return {
                ok: false,
                error: {
                    file: hubRoot,
                    entry: entryName,
                    problem: "verify-mismatch",
                    message: `hub commit ${hubCommit} exists but does not match the source entry; inspect it manually — never auto-reset hub history`,
                },
            };
        }
    }

    // --- 7. Remove — only reached when step 6 verified, or on the alreadyMigrated path ---
    // `git add -A -- <path>` errors ("did not match any files") when the path has never been
    // tracked, so only touch the index when the entry actually has tracked content to remove.
    const trackedBefore = git(run, codeRoot, "ls-files", "--", relPath);
    fs.rmSync(entryDir, { recursive: true, force: true });

    let removalCommit: string | null = null;
    if (trackedBefore) {
        const addRemovalResult = run("git", ["add", "-A", "--", relPath], { cwd: codeRoot });
        if (addRemovalResult.status !== 0) {
            return {
                ok: false,
                error: {
                    file: codeRoot,
                    entry: entryName,
                    problem: "removal-failed",
                    message: `the entry is safe in the hub commit ${hubCommit} at ${hubRoot}, but staging its removal from ${codeRoot} failed: ${addRemovalResult.stderr}`,
                },
            };
        }
        const removalCommitResult = run(
            "git",
            [
                "commit",
                "-m",
                `closure: migrate queue entry ${entryName} to hub ${preflight.hub.name}`,
                "--",
                relPath,
            ],
            { cwd: codeRoot },
        );
        if (removalCommitResult.status !== 0) {
            return {
                ok: false,
                error: {
                    file: codeRoot,
                    entry: entryName,
                    problem: "removal-failed",
                    message: `the entry is safe in the hub commit ${hubCommit} at ${hubRoot}, but committing its removal from ${codeRoot} failed: ${removalCommitResult.stderr}`,
                },
            };
        }
        removalCommit = git(run, codeRoot, "rev-parse", "HEAD");
    }

    return {
        ok: true,
        outcome: { entryName, hubRoot, hubBranch, hubCommit, alreadyMigrated, removalCommit },
    };
}
