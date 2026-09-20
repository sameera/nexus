---
name: nxs-distill-continuation
description: The continuation-mode contract of /nxs.distill. Read it only when that stage has resolved its run mode as continuation, the hand-off from a /nxs.close --pr run that already prepared the branch.
---

# nxs-distill-continuation

`/nxs.distill` resolves its run mode before it reads any mode-specific instruction. This file is
what it reads when that mode is **continuation**, and nothing else reads it. Continuation mode is
the `/nxs.close --pr` hand-off: the close already cut the `distill/*` branch, committed its
artifacts on it, and pushed it, and the drain runs inside the close worktree.

Every rule below is keyed to the base stage's own phase numbering and overrides the base stage at
that number. The base stage's phase order and numbering are unchanged, and a phase this file does
not name runs exactly as the base stage states it.

Nothing here writes to GitHub, the concept store, the queue or a branch on its own. Branch creation,
the checkpoint stop and the pull-request opening stay in the base stage.

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
concept/anchor/atlas commits on it. **Do not run `git checkout -`**. You are inside the close
worktree, which stays on this branch, and there is no prior branch to return to. The worktree is
removed after the PR is dealt with (Phase 8).

The entry's `close-record.md` was added by the close earlier on this same branch and is `git rm`'d
here, so it is **add-then-deleted within the branch** and invisible in the net "Files changed". Its
prose lives durably in the epic-issue close comment; quote or link that comment in the PR body so
the reviewer can see the *why* without a dangling queue path.

## Phase 8 — end with the worktree-cleanup instruction

`/nxs.distill` runs *inside* the close worktree, so it cannot remove that worktree itself; the lead
removes it once done reviewing:

    Worktree: <wtPath> (the close/distill worktree, still checked out on this branch)
    CLEANUP (after the distillation-PR is merged or closed):
        git worktree remove --force <wtPath>
