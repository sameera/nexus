/**
 * Role gate for the --pr post-merge flow.
 *
 * Single-repo and hub may run the post-merge worktree flow; a member repo may not
 * (its close runs on the feature branch and migrates the entry to the hub, which
 * is incompatible with a post-merge worktree cut from the trunk). Role comes from
 * the same committed artifacts close's preflight keys on — a member pointer
 * (`.nexus/config/hub.yml`) is rejected up front, before any hub resolution, so a
 * member is refused even when its hub is not checked out. Identity for the
 * single-repo/hub path comes from close's preflight. Read-only.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { closePreflight } from "@nexus/close-migration/preflight";
import { type PrWorktreeDiagnostic } from "./diagnostic.js";
import { type Runner, defaultRunner, git } from "./run.js";

export type SupportedRole = "single-repo" | "hub";

export interface ResolvedRole {
    role: SupportedRole;
    repoRoot: string;
    /** Normalized host/owner/repo identity for the close record's range `repo`. */
    repoIdentity: string;
}

export type ResolveRoleResult =
    | { ok: true; resolved: ResolvedRole }
    | { ok: false; error: PrWorktreeDiagnostic };

export function resolveRole(startDir: string, run: Runner = defaultRunner): ResolveRoleResult {
    const repoRoot = git(run, startDir, "rev-parse", "--show-toplevel");
    if (repoRoot === null) {
        return {
            ok: false,
            error: { problem: "not-a-git-repo", message: `${startDir} is not inside a git checkout; the --pr flow must run inside one.` },
        };
    }

    const hasManifest = fs.existsSync(path.join(repoRoot, ".nexus", "config", "workspace.yml"));
    const hasPointer = fs.existsSync(path.join(repoRoot, ".nexus", "config", "hub.yml"));
    if (hasPointer && !hasManifest) {
        return {
            ok: false,
            error: {
                problem: "member-unsupported",
                message:
                    `the --pr post-merge flow is not supported in a member repo; a member's /nxs.close runs on its ` +
                    `feature branch and migrates the entry to the hub. Run /nxs.close without --pr, or drain from the hub.`,
            },
        };
    }

    // single-repo or hub: reuse close's preflight for the normalized repo identity.
    const pre = closePreflight(startDir, run);
    if (!pre.ok) {
        return { ok: false, error: { problem: pre.error.problem, message: pre.error.message } };
    }
    const { role, repoRoot: root, repo } = pre.preflight;
    if (role === "member") {
        // Belt-and-suspenders: should have been caught above.
        return {
            ok: false,
            error: { problem: "member-unsupported", message: `member repos do not support the --pr post-merge flow.` },
        };
    }
    return { ok: true, resolved: { role, repoRoot: root, repoIdentity: repo.identity } };
}
