---
title: "Distill Run Record and Cleanup"
aliases: ["distill run record", "live-run marker", "outcome record", "nexus distill cleanup", "distill cleanup", "one run per epic"]
touches: ["distill-command", "drain-invocation", "pr-driven-flow"]
last_updated_by: "#952"
status: active
verification: verified
---

# Distill Run Record and Cleanup

The distill run record is the scratch folder that holds one distill run's log, outcome and live-run marker, keyed by the epic's number. The cleanup command removes an epic's distill worktrees and then that epic's run record. A live run for the epic blocks both a second start and the cleanup.

## How It Works

The distill command writes the run record in ignored scratch space in the main checkout, in a folder named for the epic. The live-run marker names the process that owns a run in progress. A second start for the same epic refuses while that process exists, whatever form each start used. The cleanup command takes one epic number. It reads only git's local list of worktrees, so it needs no network and works in a hub and from inside the worktree. It removes every worktree on any of the epic's distillation branches, whatever their date and whether or not they hold uncommitted changes, and prints each removed path. It then deletes the epic's run record. With nothing to remove, it says no worktree was found and exits successfully. Every distill ending, and a background run's final line, names the cleanup command with the epic's number filled in.

## Key Invariants

1. Every file the distill command writes lies in ignored scratch space in the main checkout, and no file it writes can be read as a drainable entry.
2. A second start for the same epic refuses while the first run's process still exists, whether each start named the epic or one of its pull requests.
3. Cleanup deletes only the named epic's run record and the worktrees on that epic's distillation branches, never a branch or a pull request.
4. Cleanup removes nothing and exits with an error while that epic's run is live.
5. Every distill ending names the cleanup command for its epic.

## Integration Points

- [distill-command](distill-command.md) — the command that writes this record, checks the live-run marker before it starts a session, and names the cleanup in every ending.
- [drain-invocation](drain-invocation.md) — cleanup refuses during a live run so that a stopped unattended drain can still leave the branch as close left it.
- [pr-driven-flow](pr-driven-flow.md) — cleanup removes this flow's shared worktree by epic number once the distillation pull request is dealt with.

## Decision Log

### 2026-10-18 — #952 — Split from distill-command

Split from distill-command when the run record and the new cleanup command pushed that page over its size cap. The run record is keyed by epic number, not pull request number, because a start by epic number and a start by any pull request of the same epic must count as one run. Refuted alternative: keep one record per pull request. Two pull requests of one epic would then get two records. Cleanup reads only git's local worktree list and removes the worktrees on every one of the epic's distillation branches, because a close on an earlier day can leave a second branch with its own worktree. Refuted alternative: reuse the start command's finder, which fails offline and removes only the newest worktree. Cleanup refuses while the epic's run is live, because removing the worktree under a running session stops that session from undoing its own commits. Cleanup also deletes the run record, because the lead wants one command to leave nothing of the run behind. Refuted alternative: keep the log after cleanup so a stopped run stays diagnosable.
