/**
 * Which git remote names the repository a pull request actually lives in.
 *
 * A lead normally works from a fork: `origin` is their own copy, and `upstream` is the
 * repository the pull requests, the issues and the merged trunk live in. Every read the
 * `--pr` flow makes means that second repository — the `pull/<N>/head` fetch, the trunk
 * refresh the distill branch is cut from, the identity a close record stamps into its
 * `range:` block. Reading them from `origin` in a fork checkout fetches a ref that is not
 * there and cuts a branch from a `main` that may be months behind.
 *
 * Pushes are the one deliberate exception and keep naming `origin`: the lead pushes their
 * distill branch to their own fork and opens a pull request from it.
 *
 * "Declared" means the remote exists in the checkout — nothing is configured, and a
 * checkout with no `upstream` behaves exactly as it always has.
 */

import { normalizeRemote } from "./remote.js";
import { type Runner, git } from "./run.js";

/** The remote naming the repository work is contributed *to*. */
export const UPSTREAM_REMOTE = "upstream";

/** The remote naming the checkout's own copy — the push target, and the fallback read. */
export const ORIGIN_REMOTE = "origin";

/** Remote names declared in `repoRoot`, in git's own order. */
export function listRemotes(run: Runner, repoRoot: string): string[] {
    const out = git(run, repoRoot, "remote");
    return out === null ? [] : out.split("\n").map((l) => l.trim()).filter(Boolean);
}

/**
 * The declared remote to read the canonical repository from, or null when none is declared.
 *
 * Exact-name matching, not a prefix: a mirror called `upstream-mirror` is somebody's extra
 * remote, not the repository pull requests are opened against.
 */
export function canonicalRemoteName(run: Runner, repoRoot: string): string | null {
    const remotes = listRemotes(run, repoRoot);
    if (remotes.includes(UPSTREAM_REMOTE)) return UPSTREAM_REMOTE;
    if (remotes.includes(ORIGIN_REMOTE)) return ORIGIN_REMOTE;
    return null;
}

/**
 * The remote name to fetch under.
 *
 * A checkout with no remote at all answers `origin`, so a failing fetch reports the same
 * "origin" git has always reported rather than an empty argument.
 */
export function canonicalRemote(run: Runner, repoRoot: string): string {
    return canonicalRemoteName(run, repoRoot) ?? ORIGIN_REMOTE;
}

/** The canonical remote's configured URL, or null when no remote is declared. */
export function canonicalRemoteUrl(run: Runner, repoRoot: string): string | null {
    const name = canonicalRemoteName(run, repoRoot);
    if (name === null) return null;
    return git(run, repoRoot, "remote", "get-url", name);
}

/** The remote-tracking ref for the trunk, e.g. `upstream/main`. */
export function canonicalTrunkRef(run: Runner, repoRoot: string, branch = "main"): string {
    return `${canonicalRemote(run, repoRoot)}/${branch}`;
}

/**
 * A forge repository reference is a dotted host followed by exactly an owner and a repo.
 *
 * A remote may perfectly well be a local path or a bare mirror — the acceptance fixtures use
 * both — and neither names anything `gh` can be pointed at. Matching the shape rather than
 * hard-coding github.com keeps a self-hosted Enterprise host working.
 */
const FORGE_REF_RE = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+\/[^/\s]+\/[^/\s]+$/i;

/**
 * The canonical repository as `host/owner/repo`, the form `gh --repo` accepts, or null when
 * no declared remote names a forge repository.
 *
 * `gh` resolves a base repository on its own when it is not told one, and in a fork checkout
 * its answer and the git fetch's answer can differ — two remotes, two repositories, and the
 * same PR number meaning different pull requests in each. Naming the repository explicitly
 * makes the gh read and the git read agree by construction.
 */
export function canonicalRepoRef(run: Runner, repoRoot: string): string | null {
    const url = canonicalRemoteUrl(run, repoRoot);
    if (url === null) return null;
    const normalized = normalizeRemote(url);
    return FORGE_REF_RE.test(normalized) ? normalized : null;
}
