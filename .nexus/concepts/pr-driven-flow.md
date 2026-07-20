---
title: "PR-Driven Post-Merge Flow"
aliases: ["pr mode", "pull-request post-merge flow", "worktree pr flow", "merge-commit range derivation", "conformance against a pull request"]
touches: ["nexus-pipeline", "distiller", "distillation-pr", "committed-queue"]
last_updated_by: "#101"
status: active
verification: verified
---

# PR-Driven Post-Merge Flow

The lead can run the conformance, closure, and distillation stages against a pull request instead of a live branch. Conformance checks the pull request while it may still be open; after it merges, closure and distillation run against the merged pull request in one shared isolated worktree, so the diff the drain reads cannot drift. It runs in single-repo and hub checkouts, refuses a member repo, and leaves the local flow untouched.

## How It Works

Two new shared pieces live in one tested helper the stage specs call: resolving a pull request's merge state and commit identifiers, and the worktree lifecycle with a merge-strategy-safe commit range. Conformance runs in a worktree at the pull-request head and publishes its verdict as a review carrying a machine-readable receipt the closure reads back, falling back to a comment when the lead authored the pull request. After the merge, closure runs in a worktree on a fresh distillation branch cut from the trunk, reads that verdict, commits and pushes the close artifacts, and hands off; distillation continues in the same worktree and opens the distillation pull request. The stamped range anchors on the merge commit, permanent on the trunk, and is verified against the pull-request head, so it is correct for a squash, a true merge, or a rebase.

## Key Invariants

1. A member repo never runs this flow; its close-and-migrate path is the mutually-exclusive alternative.
2. The stamped range anchors on commits permanent on the trunk, never the pull-request branch tip; an empty, non-ancestor, or unverifiable range is refused rather than guessed.
3. The flow is additive and mutually exclusive with the local path.
4. A conformance verdict is trusted only from a maintainer-authored review or comment; staleness is exact full-identifier equality against the pull-request head.
5. Closure and distillation share one worktree on the distillation branch, and it is always removed when the work is done or on error.

## Integration Points

- [nexus-pipeline](nexus-pipeline.md) — the pipeline whose conformance and closure stages this flow runs against a pull request.
- [distiller](distiller.md) — the drain that continues in the shared worktree and derives its diff from the stamped range.
- [distillation-pr](distillation-pr.md) — the reviewed write the closure hand-off prepares and distillation opens.
- [committed-queue](committed-queue.md) — the queue whose close record travels on the distillation branch here, there being no feature pull request after the merge.

## Decision Log

### 2026-07-20 — #101 — Run conformance, closure, and distillation against a pull request in a shared worktree

The conformance, closure, and distillation stages gained an additive pull-request mode: conformance checks the possibly-open pull request and posts its verdict to the merge box, and after the merge closure and distillation run in one shared worktree cut from the trunk, so the drain reads an already-merged diff that cannot drift. The must-be-correct git mechanics — merge-state resolution, a range anchored on the merge commit and verified against the pull-request head, and the worktree lifecycle — live in one tested helper rather than inline spec prose, because worktree cleanup and range correctness would otherwise be unverified model discipline. Refuted alternative: describe the git commands inline in the specs — lighter, and needing no new package, but it leaves the deterministic parts untested.
