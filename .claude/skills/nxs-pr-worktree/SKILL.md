---
name: nxs-pr-worktree
description: Resolve a PR's merge state and SHAs and manage the git worktree for the --pr post-merge flow of /nxs.analyze and /nxs.close. Single-repo and hub only; rejects member repos.
---

# nxs-pr-worktree

Run the helper that gives `/nxs.analyze --pr` and `/nxs.close --pr` their deterministic git and
`gh` mechanics: the role gate, the PR lookup, the merge-strategy-safe range derivation, and the
git-worktree lifecycle. All the risky, exactly-must-be-correct parts live here (tested), so the
command specs stay declarative.

## Purpose

The post-merge flow runs a stage against a PR inside an isolated worktree:

-   **analyze** reads conformance against a detached worktree at the PR head (fetched via
    `pull/<N>/head`, so forks work), then removes it.
-   **close** runs its phases in a worktree on a fresh `distill/<date>-<slug>` branch cut from
    the trunk, which `/nxs.distill` later continues in.

This helper answers: is this repo allowed to run the flow (single-repo/hub yes, member no)? is
the PR merged (required for close)? what is the trunk-permanent `range:` for the close record
(squash-, merge-, and rebase-safe)? and where is the worktree?

## Where the worktrees are created

The directory the flow creates its worktrees under — the **worktree base** — is declared by the
`worktree-path` key in the `github:` block of `.nexus/config/settings.yml`. The key names the base,
never an individual worktree: every worktree lands in a per-checkout subdirectory of it, so two
checkouts pointed at one base cannot collide.

```yaml
github:
    worktree-path: /srv/nexus-worktrees
```

-   **Absolute** values are used as given. **Relative** values resolve against the **repo root** —
    not the current working directory — so the same configuration yields the same base wherever the
    command was invoked from. A leading `~` expands to the home directory, and one matched pair of
    surrounding quotes is stripped.
-   **Declare nothing and nothing changes:** the base is the system temp directory's
    `nexus-pr-worktrees` directory, exactly as before the key existed.
-   The base is resolved from the main checkout's settings, never from content carried by the pull
    request — a PR head from a fork must not get to choose where a checkout is written.
-   One resolved base serves the whole flow: `/nxs.analyze --pr`, `/nxs.close --pr`, and the
    `/nxs.distill` continuation of close's worktree.

**Prefer a base outside the repository.** An in-repo base is allowed once git ignores it, but the
ignore rule only protects git: project discovery, test collection, linters, and file globs still
recurse into what is a second complete checkout of the same repo, and an aggressive clean of ignored
files in the outer repo will destroy a live worktree. A base git does *not* ignore is refused
outright (`worktree-base-in-repo`), before anything is created.

A **workspace hub** can declare the same key in its manifest's `github:` defaults, and every repo in
the workspace that declares none inherits it; a repo's own value always wins. Note that a *relative*
hub default anchors on each consuming repo's own root, so it gives every repo a different location —
a hub that wants one shared location must declare an **absolute** path.

## Usage

Preflight — read-only gate. `--mode close` exits non-zero unless the PR is merged:

```bash
tsx ./.claude/skills/nxs-pr-worktree/scripts/pr_worktree.ts preflight --pr <N> --mode analyze|close
```

Open the analyze worktree (detached, at the PR head). Prints `{ wtPath, analyzedHead, base }`:

```bash
tsx ./.claude/skills/nxs-pr-worktree/scripts/pr_worktree.ts open --pr <N> --mode analyze
```

Open the close worktree on a distill branch and derive the range. Prints
`{ wtPath, range: { repo, base, head } }` (full SHAs for the close record's `range:`):

```bash
tsx ./.claude/skills/nxs-pr-worktree/scripts/pr_worktree.ts open --pr <N> --mode close --branch distill/<date>-<slug>
```

Remove a worktree (force + prune; safe to call from inside the target or twice):

```bash
tsx ./.claude/skills/nxs-pr-worktree/scripts/pr_worktree.ts remove <wtPath>
```

## Contract

-   Success prints exactly one JSON object on stdout; a failure prints a `pr-worktree <problem>:
    <message>` diagnostic on stderr. Exit codes: `0` success · `1` a named diagnostic · `2` usage.
-   **Member repos are rejected** (`member-unsupported`) — a member's close runs on its feature
    branch and migrates to the hub; the post-merge worktree flow does not apply.
-   The range anchors on the **merge commit**, never the PR branch tip (which is garbage-collected
    after a squash + branch delete, and the distiller never fetches). It refuses to stamp an
    ambiguous (squash-vs-rebase) range it cannot verify against the PR head, and refuses an empty
    or non-ancestor range — a wrong range would distill the wrong pages later.
-   Read-only except the worktree add/remove and the fetches it performs; it never pushes, commits,
    or edits tracked files.
-   An unusable worktree base stops the run before any directory is created and before any `git
    worktree add` is attempted, leaving the checkout as it was found: `worktree-base-in-repo` (in the
    working tree and not ignored), `worktree-base-uncreatable` (quoting the underlying reason), and
    `worktree-base-unresolved` (the shared publishing resolver failed — never a silent fallback to
    the temp base, which would write a commit-bearing checkout where the operator configured away
    from).
