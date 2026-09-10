/**
 * Role gate for /nxs.close's --pr post-merge flow.
 *
 * Single-repo and hub may run the post-merge worktree flow; a member repo may not
 * (epic #215 retired the close-and-migrate path — a member epic closes from the hub
 * instead, over its merged pull requests, which is incompatible with a post-merge
 * worktree cut from the trunk of the member itself). Role comes from
 * the same committed artifacts close's preflight keys on — a member pointer
 * (`.nexus/config/hub.yml`) is rejected up front, before any hub resolution, so a
 * member is refused even when its hub is not checked out. Identity for the
 * single-repo/hub path comes from close's preflight. Read-only.
 *
 * The analyze mode opened by epic #211 does not use this gate — see `./member-target.js`'s
 * `resolveAnalyzeTarget`, which accepts a member.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { closePreflight } from "@nexus/workspace/close-role";
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
                    `the --pr post-merge flow is not supported in a member repo; /nxs.close does not run inside a ` +
                    `member repository. A member epic closes from the hub now, over its merged pull requests — run ` +
                    `/nxs.close --pr <N> from the hub instead.`,
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
            error: {
                problem: "member-unsupported",
                message: `member repos do not support the --pr post-merge flow; a member epic closes from the hub now.`,
            },
        };
    }
    return { ok: true, resolved: { role, repoRoot: root, repoIdentity: repo.identity } };
}
