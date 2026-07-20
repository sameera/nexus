---
feature: "PR-Driven Delivery"
feature_path: docs/features/pr-driven-delivery
epic: "PR-Driven Post-Merge Flow for Analyze, Close, and Distill"
slug: pr-driven-flow
created: 2026-07-20
type: enhancement
complexity: L
complexity_drivers:
  - New git-worktree + PR-lookup capability with no prior infrastructure to extend
  - Merge-strategy-safe range derivation (squash / merge-commit / rebase) that the distiller recomputes
  - Two-mode forks added to three commands (analyze, close, distill) plus a cross-command worktree hand-off
  - A durable, doctrinally-consistent home for post-merge close artifacts (no feature PR to ride)
concepts: ["distiller", "distillation-pr", "committed-queue", "nexus-pipeline"]
link: "#101"
---

# Epic: PR-Driven Post-Merge Flow for Analyze, Close, and Distill

## Goal

Let the lead run the conformance, closure, and distillation stages against a **pull request** rather
than a live branch: analyze the (possibly open) PR, merge it, then close and distill against the
merged PR in one shared isolated worktree. Because the code is already merged when close and distill
run, the diff the distiller reads cannot drift. The existing local (non-`--pr`) flow and the
member-repo migration flow are preserved unchanged.

## User Stories

### STORY 1 — PR/worktree helper library

- **story_type:** system
- **size:** M

As the pipeline, I need one tested helper for the deterministic git/`gh` mechanics so the command
specs stay declarative.

- **AC1:** A `@nexus/pr-worktree` package resolves a PR's merge state and SHAs via `gh pr view`,
  returning a typed record; an open PR and a not-found PR are distinguished.
- **AC2:** It derives the close record's range anchored on the **merge commit** (permanent on the
  trunk), correct for squash, true-merge, and rebase merges; it refuses (rather than guesses) an
  ambiguous range it cannot verify against the PR head, and refuses an empty or non-ancestor range.
- **AC3:** It creates and force-removes worktrees idempotently (analyze: detached at the PR head;
  close: a fresh distill branch cut from the trunk), and rejects member repos.
- **AC4:** The mechanics are covered by unit tests against real git topologies and injected `gh`.

### STORY 2 — Helper skill (CLI shim)

- **story_type:** system
- **size:** S

As a command spec, I need to call the helper the same way `/nxs.close` calls its migration helper.

- **AC1:** A `nxs-pr-worktree` skill exposes `preflight` / `open` / `remove` subcommands over the
  library, printing one JSON object on success and a named diagnostic on failure, with exit codes
  0/1/2.
- **AC2:** It runs via `tsx` in single-repo and hub checkouts without a bundling step.

### STORY 3 — `/nxs.analyze --pr <N>`

- **story_type:** user
- **size:** S

As the lead, I want to check conformance against a PR before merging it.

- **AC1:** `--pr <N>` runs the conformance read inside a worktree at the PR head; the PR may be open.
- **AC2:** The result is published as a PR review (`--approve` / `--request-changes`), falling back to
  a comment when the lead authored the PR, carrying a machine-readable receipt block (full head SHA).
- **AC3:** The worktree is always removed at the end and on error; local (non-`--pr`) mode still
  writes `analyze-receipt.md` unchanged.

### STORY 4 — `/nxs.close --pr <N>`

- **story_type:** user
- **size:** M

As the lead, I want to close an epic against its merged PR, in a worktree, and hand off to distill.

- **AC1:** `--pr <N>` blocks unless the PR is merged and rejects member repos; it runs in a worktree
  on a fresh `distill/<date>-<slug>` branch cut from the trunk.
- **AC2:** The conformance gate reads the analyze result from the PR review's machine block (trusting
  only maintainer-authored blocks), with exact full-SHA staleness.
- **AC3:** The close-from-diff pass and the `range:` stamp both use the merge-commit range (not
  `merge-base HEAD origin/main`, which is empty in the worktree).
- **AC4:** The close record, backlog append, and lesson are committed on the distill branch and
  pushed; the run ends by directing the lead to continue with `/nxs.distill` in the worktree.

### STORY 5 — `/nxs.distill` range-first + continuation

- **story_type:** system
- **size:** S

As the distiller, I want to continue in the close worktree and derive the diff from the stamped range.

- **AC1:** Single-repo diff derivation prefers the recorded `range:`; the introducing-commit path is a
  fallback only when the range SHAs are unreachable.
- **AC2:** On a close-prepared `distill/*` branch, distill drains exactly that one entry (no
  whole-queue batching), skips branch creation, and uses a range-head-reachability merge precondition.

### STORY 6 — Design-doc import (`/nxs.hld --from <path>`)

- **story_type:** user
- **size:** M

As the lead, I want to seed a decision record from an out-of-band design doc so out-of-pipeline work
becomes distillable.

- **AC1:** `--from <path>` derives the decision record from the design doc at `<path>` (abstracting away
  code/paths), while the queued `epic.md` still supplies the scope the record must cover.
- **AC2:** A decision the doc states without a *why* or a viable-alternative note raises an Open
  Clarification rather than shipping an unsupported entry.

## Success Metrics

- Analyze, close, and distill run against a PR with **no manual range computation** by the lead.
- Range derivation is correct for squash, merge-commit, and rebase merges (proven by tests).
- Member mode is rejected for `--pr`; single-repo and hub are supported; the local and migration
  flows are unchanged (regression-green).
- An out-of-band design doc can seed a decision record via `--from`, closing the "capture a session"
  gap.

## Implementation Sequence

| STORY | Issue | blocked_by |
| --- | --- | --- |
| STORY-101.01 | #102 | none |
| STORY-101.02 | #103 | STORY-101.01 |
| STORY-101.03 | #104 | STORY-101.02 |
| STORY-101.04 | #105 | STORY-101.02, STORY-101.03 |
| STORY-101.05 | #106 | STORY-101.04 |
| STORY-101.06 | #107 | none |
