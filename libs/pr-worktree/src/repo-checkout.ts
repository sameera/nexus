/**
 * Find the local checkout of the repository a pull request merged in (epic #828, decision record
 * #849, D3).
 *
 * Close derives each range in the checkout of the repository the pull request merged in, so it
 * has to know where that checkout is. The answer comes from the same places distill's diff reader
 * already reads: in a hub, the workspace manifest (the hub itself, or a declared member at its
 * expected path); in a single-repo checkout, that checkout's own identity and nothing else.
 *
 * This only looks. It never clones, fetches or creates a temporary store: a member with no
 * checkout is a stop that names the path it was expected at, because the next stage, distill,
 * needs the same checkout and would fail on it anyway.
 */

import { canonicalRemoteUrl } from "@nexus/workspace/canonical-remote";
import { sameRepo } from "@nexus/workspace/issue-ref";
import { normalizeRemote } from "@nexus/workspace/remote";
import { resolveWorkspace } from "@nexus/workspace/resolve";
import { type PrWorktreeDiagnostic } from "./diagnostic.js";
import { type Runner, git } from "./run.js";

/** A pr-worktree problem, or the workspace resolver's own diagnostic passed through verbatim. */
export interface RepoCheckoutDiagnostic {
    problem: PrWorktreeDiagnostic["problem"] | string;
    message: string;
}

export type RepoCheckoutResult =
    | { ok: true; checkout: string }
    | { ok: false; error: RepoCheckoutDiagnostic; expectedPath?: string };

/** The checkout of `repo` (`owner/repo` or `host/owner/repo`), as seen from `startDir`. */
export function resolveRepoCheckout(startDir: string, run: Runner, repo: string): RepoCheckoutResult {
    const resolved = resolveWorkspace(startDir);
    if (!resolved.ok) return { ok: false, error: { problem: resolved.error.problem, message: resolved.error.message } };

    if (resolved.workspace.mode === "workspace") {
        const ws = resolved.workspace;
        if (sameRepo(repo, ws.hub.normalizedRemote)) return { ok: true, checkout: ws.hubRoot };
        const member = ws.members.find((m) => sameRepo(m.normalizedRemote, repo));
        if (member === undefined) {
            const declared = [ws.hub.normalizedRemote, ...ws.members.map((m) => m.normalizedRemote)].join(", ");
            return {
                ok: false,
                error: {
                    problem: "repo-checkout-unknown",
                    message: `a pull request merged in '${repo}', which the workspace manifest declares neither as the hub nor as a member (declared: ${declared}); declare it in .nexus/config/workspace.yml and check it out.`,
                },
            };
        }
        if (member.checkout === "missing") {
            return {
                ok: false,
                expectedPath: member.expectedPath,
                error: {
                    problem: "member-checkout-missing",
                    message: `declared member '${member.name}' (${repo}) is not checked out; expected it at ${member.expectedPath}. Check it out there and re-run — nothing is fetched in its place.`,
                },
            };
        }
        return { ok: true, checkout: member.expectedPath };
    }

    const root = git(run, resolved.workspace.root, "rev-parse", "--show-toplevel") ?? resolved.workspace.root;
    const remoteUrl = canonicalRemoteUrl(run, root);
    const identity = remoteUrl ? normalizeRemote(remoteUrl) : null;
    if (identity === null || !sameRepo(repo, identity)) {
        return {
            ok: false,
            error: {
                problem: "repo-checkout-unknown",
                message: `a pull request merged in '${repo}', but this checkout is '${identity ?? root}' and declares no workspace; run close from a hub whose manifest declares '${repo}', with that repository checked out.`,
            },
        };
    }
    return { ok: true, checkout: root };
}
