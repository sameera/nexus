---
title: "Decision Record: PR-Driven Post-Merge Flow for Analyze, Close, and Distill"
epic: ""   # unfiled — see epic.md link (retrofit entry)
feature: "PR-Driven Delivery"
rating: L
concepts: ["distiller", "distillation-pr", "committed-queue", "nexus-pipeline"]
date: 2026-07-20
---

# Decision Record: PR-Driven Post-Merge Flow for Analyze, Close, and Distill

## Summary

The conformance, closure, and distillation stages can run against a pull request instead of a live
branch: conformance checks the (possibly open) PR, and after it merges, closure and distillation run
against the merged PR inside one shared isolated worktree. Because the code is already merged when
closure and distillation run, the diff the knowledge drain reads cannot drift. The mechanics live in
one tested helper the command specs call; the pre-existing local flow and the member-repo migration
flow are untouched.

## Chosen Approach

Add an additive PR mode to the conformance and closure stages, plus a range-first, continuation
mode to the drain. The two genuinely new and shared pieces — resolving a pull request's merge state
and commit identifiers, and the git-worktree lifecycle plus the merge-strategy-safe range — go in a
single tested helper, mirroring the existing close-migration helper (shared runner seam, typed
diagnostics). Everything else is edits to the three stage specs that branch on the PR flag. Closure
and distillation share one worktree on a fresh distillation branch cut from the trunk: closure
prepares it and hands off, distillation continues in it and opens the distillation pull request.

## Key Decisions

### Put the git/PR mechanics in a tested helper, not inline spec prose

- **Decision:** The merged-state gate, the range derivation, and the worktree lifecycle live in a
  tested helper library with a thin command-line shim; the stage specs call it.
- **Why:** These are the parts that must be exactly correct and deterministic, and the codebase
  already prefers tested helpers for git mechanics; a helper makes them unit-testable.
- **Refuted alternative:** Describe the git commands inline in the specs (lighter, no new package) —
  rejected because worktree cleanup and range correctness would become model discipline, unverified.

### Support single-repo and hub; reject member repos

- **Decision:** The PR flow runs in single-repo and hub checkouts; a member repo is refused up front.
- **Why:** A member's closure runs on its feature branch and migrates the entry to the hub — a
  pre-merge, cross-repo choreography incompatible with a post-merge worktree cut from the trunk. A hub
  drains its own queue much like single-repo, so it fits.
- **Refuted alternative:** Full member support — rejected because it collides with the migration flow
  and warrants its own design pass.

### Anchor the range on the merge commit, verified against the pull-request head

- **Decision:** The stamped range anchors on the merge commit and its ancestry; the squash-versus-rebase
  ambiguity is resolved by verifying a candidate against the pull-request head's changed set, and the
  helper refuses when it cannot verify.
- **Why:** The pull-request branch tip is garbage-collected after a squash plus branch delete, and the
  drain never fetches, so the range must anchor on commits that live permanently on the trunk. A fixed
  first-parent rule silently under-captures a rebase merge; verification catches it.
- **Refuted alternative:** Use the pull request's recorded base and head directly — rejected as fragile
  once the branch is squashed and deleted.

### Publish conformance as a pull-request review carrying a machine-readable block

- **Decision:** The conformance result is posted as a review (approve or request-changes), with a
  comment fallback when the lead authored the pull request, and it carries a machine-readable receipt
  block the closure stage reads back.
- **Why:** The verdict belongs in the merge box where the decision is made, and a machine block lets
  closure read the result without a local file that would vanish with the ephemeral worktree.
- **Refuted alternative:** A plain comment (no merge-box signal) or a local receipt file (dies with the
  worktree).

### Commit and push the close artifacts on the distillation branch; the epic-issue comment is the durable why

- **Decision:** The close record, backlog append, and lesson are committed on the distillation branch
  and pushed; the durable copy of the rationale is the epic-issue close comment.
- **Why:** Post-merge there is no feature pull request for the close record to ride, so it travels on
  the distillation pull request; pushing removes the single-machine risk, and the close record is
  add-then-deleted within that branch, so the issue comment is what survives.
- **Refuted alternative:** A separate small closure pull request — rejected as process weight for a few
  prose files; leaving the artifacts uncommitted — rejected as lost if the worktree is discarded.

### Make the drain range-first and add a single-entry continuation mode

- **Decision:** Single-repo diff derivation prefers the recorded range, with the introducing-commit
  path only as a fallback; on a close-prepared distillation branch the drain handles exactly that one
  entry and does not batch.
- **Why:** On a close-prepared branch the introducing-commit diff is degenerate (its most recent add is
  the close commit), and batching across per-closure branches would strand entries and misreport them;
  range-first also converges single-repo onto how the hub already derives.
- **Refuted alternative:** Keep whole-queue batching — rejected because it strands entries closed on
  other branches and reports false drain-SLO breaches.

### Add a supported bridge to import an out-of-pipeline design doc

- **Decision:** The design stage gains an import mode that derives the decision record from an existing
  design doc while the queued epic still supplies the scope.
- **Why:** Work designed outside the pipeline has no rationale channel the drain reads; the import mode
  is the supported way to bring that rationale in, abstracted into decisions-and-rationale prose.
- **Refuted alternative:** Manual transcription only (unsupported, error-prone) or distilling the raw
  session and scratch directly (unreviewed, and the drain deliberately reads only curated records).

## Constraints & Invariants

1. A member repo never runs the PR post-merge flow; its close-and-migrate path is unchanged.
2. The stamped range anchors on trunk-permanent commits, never the pull-request branch tip; a range
   that is empty, non-ancestor, or ambiguously unverifiable is refused rather than stamped.
3. The local (non-PR) conformance, closure, and drain flows behave exactly as before; the PR mode is
   additive and mutually exclusive with the local path.
4. The close record's filename, its frontmatter, and the recorded range's list shape are unchanged, so
   the existing hub diff-derivation keeps parsing them.
5. A conformance result read from a pull request is trusted only when the review or comment is authored
   by a maintainer; staleness is exact full-identifier equality against the pull-request head.
6. Editing any command spec or adding a skill re-stamps the vendored component fingerprint — re-vendor
   after such edits or the parity check fails.
7. A decision record produced by import mode carries no code, file paths, or type names, and every
   decision retains its why; a missing rationale gates rather than ships.

## Risks (BLOCKER / ADDRESS only)

- **ADDRESS — Rebase merges:** the range helper handles them by verification, but the cheapest
  safeguard is restricting merges to squash-or-merge via branch protection; documented, not enforced.
- **ADDRESS — No live end-to-end pull-request test in the build environment:** the PR-lookup and range
  logic are unit-tested with injected command runners and real git topologies; a real PR dry-run against
  a scratch hosted repo is the recommended acceptance check.
- **ADDRESS — Concept pages describe the pre-merge flow:** the pages stating that the rationale is
  reviewed at feature-merge, and that the close record rides the feature branch, are stale until this
  epic is itself distilled; they update via this entry's distillation, not by hand.

## Open Clarifications

None.
