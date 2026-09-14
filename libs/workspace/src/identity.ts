/**
 * Derive the code repo's identity for the close record's range block.
 *
 * The identity is the same normalized `host/owner/repo` form the workspace
 * manifest stores for every member (normalizeRemote), so the future
 * hub-side consumer can match a recorded range to a manifest member by
 * string equality. Weak fallbacks are labeled by `source` so the operator
 * can see which remote the identity came from.
 *
 * The remote is chosen by the shared rule in `./canonical-remote.js`: `upstream`
 * when the checkout declares one, else `origin`. A lead working from a fork has
 * an `origin` naming their own copy, and a close record that stamped it would
 * claim the work landed in a repository the pull request was never opened
 * against.
 */

import * as path from "node:path";
import { canonicalRemoteName } from "./canonical-remote.js";
import { normalizeRemote } from "./remote.js";
import { type Runner, defaultRunner, git } from "./run.js";

export interface RepoIdentity {
    identity: string;
    source: "upstream" | "origin" | "first-remote" | "directory-name";
}

export function deriveRepoIdentity(repoRoot: string, run: Runner = defaultRunner): RepoIdentity {
    const canonical = canonicalRemoteName(run, repoRoot);
    if (canonical !== null) {
        const url = git(run, repoRoot, "remote", "get-url", canonical);
        if (url) {
            return { identity: normalizeRemote(url), source: canonical === "upstream" ? "upstream" : "origin" };
        }
    }
    const remotes = git(run, repoRoot, "remote");
    const first = remotes?.split("\n").filter(Boolean)[0];
    if (first) {
        const url = git(run, repoRoot, "remote", "get-url", first);
        if (url) {
            return { identity: normalizeRemote(url), source: "first-remote" };
        }
    }
    return { identity: path.basename(repoRoot), source: "directory-name" };
}
