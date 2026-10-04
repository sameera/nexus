---
title: "Close-and-Distill Command"
aliases: ["close-epic command", "one-command close", "close and distill in one command", "hand-off note", "close-epic run folder", "outcome record"]
touches: ["pr-driven-flow", "drain-invocation", "conformance-gate", "shipped-ledger", "published-verdict-selection", "epic-coverage-run"]
last_updated_by: "#827"
status: active
verification: verified
---

# Close-and-Distill Command

The close-and-distill command takes a merged epic pull request to a closed epic and an open distillation pull request, with one command and one approval. It runs the conformance stage, the close stage and the distill stage as three separate sessions. Only close is interactive, and distill runs unattended in the worktree close left.

## How It Works

The command first checks the pull request. A merged pull request goes ahead. An open pull request goes ahead only when the lead asked the command to merge it, and only when it is not a draft, the platform reports it mergeable, and it carries a clean conformance verdict. Every other state is refused before any stage starts, and the refusal names the state. The command then runs the post-merge conformance run with nobody watching. It reads that run's outcome from the platform: a published verdict on the pull request and this pull request's shipped record on the epic issue. Close then runs interactively. When close has closed the epic issue and pushed the distillation branch, it writes a short hand-off note. The command checks the note against the platform and git before it starts distill. Distill runs with the unattended flag. When distill exits, the command writes an outcome record to a run folder in the lead's checkout. The outcome record reads success from the platform, never from distill's own words. In the background, distill's log goes to the same folder and the command returns at once.

## Key Invariants

1. Conformance, close and distill each run in a fresh session, and only close asks the lead anything.
2. A stage's exit status is never read as its outcome; every outcome is read from the platform or git.
3. The command merges a pull request only when asked to, and only when it is open, not a draft, mergeable, and carries a clean conformance verdict.
4. Close starts only after the post-merge conformance run succeeded.
5. Distill starts only when the hand-off note exists, the epic issue it names is closed, the worktree it names is registered on the named branch, and that branch is pushed.
6. The lead never changes directory between close and distill.
7. It runs only in a single-repo checkout; a hub or member checkout is refused before any stage starts.

## Integration Points

- [pr-driven-flow](pr-driven-flow.md) — the post-merge flow this command runs end to end, in one worktree.
- [drain-invocation](drain-invocation.md) — the unattended drain it starts in the worktree close left.
- [conformance-gate](conformance-gate.md) — the stage it runs with nobody watching before close, reading the result from the platform.
- [shipped-ledger](shipped-ledger.md) — the record it requires on the epic issue before close starts.
- [published-verdict-selection](published-verdict-selection.md) — the rule that picks the clean verdict its merge option requires.
- [epic-coverage-run](epic-coverage-run.md) — the run whose error on a failed story read stops this command before close starts.

## Decision Log

### 2026-09-27 — #814 — One command closes and distills a merged epic pull request

After a merge the lead ran close, changed into the worktree close opened, and ran distill there, answering a second approval. The command runs the three stages as separate sessions, because one session carrying two stages' instructions loses accuracy, and distill reading the diff again costs less. Close writes a hand-off note only when the command asks for one, because close runs interactively and its worktree path cannot be predicted. Refuted alternative: find the worktree through git by listing distillation branches. It needs no change to close, but a worktree left by an earlier aborted run makes the choice ambiguous. The command reads each stage's outcome from the platform because a headless run exits 0 when the stage stops and reports the stop in words. Refuted alternative: trust the exit status. It would start an interactive close that the shipped-record gate then stops. The merge option requires a clean verdict because the merge is the one step that cannot be undone. Refuted alternative: check only mergeability and branch protection. A solo repository usually has no protection, so the command could merge code with known critical findings.

### 2026-10-01 — #827 — Reciprocal link from epic-coverage-run

Mechanical reciprocity fan-out: when the epic coverage run cannot read a story's pull requests, it exits with an error and prints no coverage, and this command stops before it starts close.
