/**
 * Derive the code repo's identity for the close record's range block.
 *
 * The identity is the same normalized `host/owner/repo` form the workspace
 * manifest stores for every member (normalizeRemote), so the future
 * hub-side consumer can match a recorded range to a manifest member by
 * string equality. Weak fallbacks are labeled by `source` so the operator
 * can see when the identity did not come from `origin`.
 */

import * as path from "node:path";
import { normalizeRemote } from "@nexus/workspace/remote";
import { type Runner, defaultRunner, git } from "./run.js";

export interface RepoIdentity {
    identity: string;
    source: "origin" | "first-remote" | "directory-name";
}

export function deriveRepoIdentity(repoRoot: string, run: Runner = defaultRunner): RepoIdentity {
    const origin = git(run, repoRoot, "remote", "get-url", "origin");
    if (origin) {
        return { identity: normalizeRemote(origin), source: "origin" };
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
