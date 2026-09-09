/**
 * Close's role gate: which of the three checkout roles a close runs in.
 *
 * Role comes from the same committed artifacts {@link resolveWorkspace} keys on — never a new
 * heuristic. Read-only.
 *
 * Epic #215 retired the member-mode hub-location-and-branch lookup this gate used to carry
 * (arming the now-deleted close-and-migrate path was its only purpose): the gate reports the
 * role and the repo's own identity and nothing about where a member's hub is checked out.
 */

import { git, type Runner, defaultRunner } from "./run.js";
import { deriveRepoIdentity, type RepoIdentity } from "./identity.js";
import * as fs from "node:fs";
import * as path from "node:path";

export type CloseRole = "single-repo" | "hub" | "member";

export interface ClosePreflight {
    role: CloseRole;
    repoRoot: string;
    repo: RepoIdentity;
}

export interface CloseRoleDiagnostic {
    file: string;
    problem: "not-a-git-repo";
    message: string;
}

export type PreflightResult =
    | { ok: true; preflight: ClosePreflight }
    | { ok: false; error: CloseRoleDiagnostic };

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

    return { ok: true, preflight: { role, repoRoot, repo } };
}
