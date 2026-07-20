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
