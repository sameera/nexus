---
name: nxs-distill-continuation
description: The continuation-mode contract of /nxs.distill. Read it only when that stage has resolved its run mode as continuation, the hand-off from a `nexus close` run that already prepared the branch, or a path argument as a close worktree.
---

# nxs-distill-continuation

`/nxs.distill` resolves its run mode before it reads any mode-specific instruction. This file is
what it reads when that mode is **continuation**, and nothing else reads it. Continuation mode is
the `nexus close` hand-off: the close already cut the `distill/*` branch, committed its
artifacts on it, and pushed it, and the drain runs inside the close worktree.

Every rule below is keyed to the base stage's own phase numbering and overrides the base stage at
that number. The base stage's phase order and numbering are unchanged, and a phase this file does
not name runs exactly as the base stage states it.

Nothing here writes to GitHub, the concept store, the queue or a branch on its own. Branch creation,
the checkpoint stop and the pull-request opening stay in the base stage.

## The worktree form — `/nxs.distill <worktree-path>`

The lead can name the close worktree from another checkout of the same repository, so an attended
run starts from the session they already have open. The run then drains that worktree's one entry
exactly as a run started inside it does.

**How the path was classified.** The base stage classifies a path argument at run-shape
resolution, before any entry is read. These are the reads it means, each naming the path:

```bash
WT="$(realpath -e "<path>")"                                   # fails: no such directory
git -C "$WT" rev-parse --path-format=absolute --show-toplevel  # fails: not a worktree
git -C "$WT" rev-parse --path-format=absolute --git-common-dir # compare with this checkout's
git -C "$WT" branch --show-current                             # must match distill/*
```

It is the worktree form only when all of these hold: the path is the worktree's root (the
top-level equals `$WT`); its git folder is this checkout's git folder; its branch matches
`distill/*`; and that branch passes the continuation test of the base stage's run mode, read in the
worktree. Otherwise refuse before reading any entry, and name what was found: no such directory,
not a worktree (or not its root), a worktree of another repository, a worktree on a branch that is
not a distillation branch, or a branch with commits beyond close's. A queue-entry path that lies
inside another checkout is refused too, naming that checkout's root as the path to pass instead.

**Every run-shape value is resolved against the worktree**: run mode (continuation), workspace
shape (`test -f "$WT/.nexus/config/workspace.yml"`, `test -f "$WT/.nexus/config/hub.yml"`) and
entry kind. A member worktree is therefore refused by the member rule, as it is inside it.

**The pinned root applies to every phase.** Claude Code resets the shell's directory when a command
leaves the session's working directories, and the default worktree location is outside them. So a
`cd` never lasts from one command to the next, and relying on one would send later writes and
commits into the lead's checkout without any error.

- Every git command names the worktree: `git -C "$WT" …`.
- Every other command, `nexus` and `gh` included, runs as `(cd "$WT" && <command>)` in one shell
  call.
- Every file read or written is an absolute path inside `$WT`: the entry, the concept store, the
  atlas, and the run folder `$WT/.nexus/tmp/runs/distill-<subject>/`.
- Phase 0.2's clean-tree check is `git -C "$WT" status --porcelain`. The lead's own checkout may
  carry uncommitted work; it is never checked, read for entries, or written.

Tell the lead once, at the start, that adding the worktree as a working directory (`/add-dir
"$WT"`) saves a permission prompt on each edit. Never add it for them.

## Input Resolution — drain one entry, not the queue

- **Drain exactly the one entry this branch carries**: the queue entry whose `close-record.md` is
  present on this branch but not at the trunk ref. Do **not** scan the whole queue, and do **not**
  report other closed-on-their-own-branch entries as drain-SLO breaches (each is processed on its
  own branch). Whole-queue batching applies only to the ordinary run.
- **Fetch and rebase onto the trunk first:** `git fetch "$(nexus trunk --form remote)" main` and
  rebase this distill branch onto `$(nexus trunk)` before the Phase 2 survey, so slug convergence
  sees any distillation that merged since the close (or warn if the branch base is behind and
  cannot fast-forward).

## Phase 0.2 — the clean tree is expected, not a block

The tree is clean because the close committed its artifacts, and you are already on the `distill/*`
branch. That is the expected state here, and it is never the dirty-tree block.

## Phase 0.4 — the merge precondition is range-head reachability

Use the **range-head-reachability** merge precondition, not the `epic.md`-presence proxy, because
that proxy is defeated in the `--pr` pipeline: `epic.md` reaches `main` at the *epic* PR, long
before the feature merges. Confirm instead that the entry's landed change is on the trunk by testing
the recorded range head:

```bash
TRUNK="$(git rev-parse -q --verify "$(nexus trunk)" || git rev-parse -q --verify main)"
git merge-base --is-ancestor <range.head> "$TRUNK" && echo merged || echo not-merged
```

The base stage's **merged** and **not-merged** outcomes are unchanged, except that a merged run
stays on this branch rather than cutting one.

## Phase 4.1 — do not cut a branch

Skip the branch-creation step. You are already on the close-prepared `distill/*` branch (it holds
the entry to `git rm` and the store the survey matched, rebased onto the trunk in Phase 0). Apply
the deltas and commit on it directly.

## Phase 7 — push the existing branch, and stay on it

The branch already exists and was pushed by the close (`--pr`); `git push` lands the new
concept/anchor/atlas commits on it. **Do not run `git checkout -`**. The close worktree
stays on this branch, whether the run is inside it or names it by path, and there is no prior
branch to return to. The worktree is
removed after the PR is dealt with (Phase 8).

The entry's `close-record.md` was added by the close earlier on this same branch and is `git rm`'d
here, so it is **add-then-deleted within the branch** and invisible in the net "Files changed". Its
prose lives durably in the epic-issue close comment; quote or link that comment in the PR body so
the reviewer can see the *why* without a dangling queue path.

## Phase 8 — the worktree-cleanup instruction, under Blocked on me

The run never removes the close worktree, whether it ran inside it or named it by path: the lead
removes it once done reviewing. Add this under the report's Blocked on me heading:

    Worktree: <wtPath> (the close/distill worktree, still checked out on this branch)
    CLEANUP (after the distillation-PR is merged or closed):
        nexus distill cleanup <epic>

`<epic>` is the epic's issue number. The command finds the worktree itself, so the lead never copies
`<wtPath>` into it.
