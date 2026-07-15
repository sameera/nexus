/**
 * Close's role gate. Role comes from the same committed artifacts the resolver keys on —
 * never a new heuristic; the hub location comes from resolveWorkspace, never re-derived.
 * Read-only.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { resolveWorkspace } from "@nexus/workspace/resolve";
import { type MigrationDiagnostic } from "./diagnostic.js";
import { type RepoIdentity, deriveRepoIdentity } from "./identity.js";
import { type Runner, defaultRunner, git } from "./run.js";

export type CloseRole = "single-repo" | "hub" | "member";

export interface ClosePreflight {
    role: CloseRole;
    repoRoot: string;
    repo: RepoIdentity;
    /** Present only in member mode. */
    hub?: { name: string; normalizedRemote: string; root: string; branch: string };
}

export type PreflightResult =
    | { ok: true; preflight: ClosePreflight }
    | { ok: false; error: MigrationDiagnostic };

export function closePreflight(startDir: string, run: Runner = defaultRunner): PreflightResult {
    const repoRoot = git(run, startDir, "rev-parse", "--show-toplevel");
    if (!repoRoot) {
        return {
            ok: false,
            error: {
                file: startDir,
                problem: "not-a-git-repo",
                message: `${startDir} is not inside a git checkout; /nxs.close must run inside one`,
            },
        };
    }

    const hasManifest = fs.existsSync(path.join(repoRoot, ".nexus", "config", "workspace.yml"));
    const hasPointer = fs.existsSync(path.join(repoRoot, ".nexus", "config", "hub.yml"));
    const role: CloseRole = hasManifest ? "hub" : hasPointer ? "member" : "single-repo";
    const repo = deriveRepoIdentity(repoRoot, run);

    if (role !== "member") {
        return { ok: true, preflight: { role, repoRoot, repo } };
    }

    const resolved = resolveWorkspace(repoRoot);
    if (!resolved.ok) {
        return { ok: false, error: resolved.error };
    }
    if (resolved.workspace.mode !== "workspace") {
        return { ok: true, preflight: { role, repoRoot, repo } };
    }
    const ws = resolved.workspace;
    const rawBranch = git(run, ws.hubRoot, "rev-parse", "--abbrev-ref", "HEAD");
    const branch = rawBranch === "HEAD" ? "(detached HEAD)" : (rawBranch ?? "(detached HEAD)");

    return {
        ok: true,
        preflight: {
            role,
            repoRoot,
            repo,
            hub: {
                name: ws.hub.name,
                normalizedRemote: ws.hub.normalizedRemote,
                root: ws.hubRoot,
                branch,
            },
        },
    };
}
