---
title: "PR-Driven Post-Merge Flow"
aliases: ["pr mode", "pull-request post-merge flow", "worktree pr flow", "merge-commit range derivation", "conformance against a pull request"]
touches: ["nexus-pipeline", "distiller", "distillation-pr", "committed-queue", "conformance-gate", "pr-worktree", "pre-epic-discovery"]
last_updated_by: "#228"
status: active
verification: verified
---

# PR-Driven Post-Merge Flow

The lead can run the conformance, closure, and distillation stages against a pull request instead of a live branch. Conformance checks the pull request while it may still be open; after it merges, closure and distillation run against the merged pull request in one shared isolated worktree, so the diff the drain reads cannot drift. It runs in single-repo and hub checkouts, refuses a member repo, and leaves the local flow untouched.

## How It Works

One tested helper the stage specs call resolves a pull request's merge state and commit identifiers, and a merge-strategy-safe commit range. Conformance runs in a worktree at the pull-request head and publishes its verdict as a review carrying the machine-readable receipt closure reads back, falling back to a comment if the lead authored it. After the merge, closure runs in a worktree on a fresh distillation branch off the trunk, reads that verdict, commits and pushes the close artifacts, and hands off; distillation continues there and opens its pull request. The stamped range anchors on the merge commit, permanent on the trunk, and verified against the pull-request head, so it holds for any merge strategy.

## Key Invariants

1. A member repo never runs this flow; its close-and-migrate path is the mutually-exclusive alternative.
2. The stamped range anchors on commits permanent on the trunk, never the pull-request branch tip; an empty, non-ancestor, or unverifiable range is refused rather than guessed.
3. The flow is additive and mutually exclusive with the local path.
4. A conformance verdict is trusted only from a maintainer-authored review or comment; staleness is exact full-identifier equality against the pull-request head.
5. Closure and distillation share one worktree on the distillation branch.

## Integration Points

- [nexus-pipeline](nexus-pipeline.md) — the pipeline whose conformance and closure stages this flow runs against a pull request.
- [distiller](distiller.md) — the drain that continues in the shared worktree and derives its diff from the stamped range.
- [distillation-pr](distillation-pr.md) — the reviewed write the closure hand-off prepares and distillation opens.
- [committed-queue](committed-queue.md) — the queue whose close record travels on the distillation branch here, there being no feature pull request after the merge.
- [conformance-gate](conformance-gate.md) — here the gate's receipt is a published review, not a local artifact, since the worktree holding one is already gone.
- [pr-worktree](pr-worktree.md) — the worktree these stages run in: where it lands, its isolation, reuse, and removal.
- [pre-epic-discovery](pre-epic-discovery.md) — excluded from the stamped range too, so that range matches the diff the drain later recomputes.

## Decision Log

### 2026-07-20 — #101 — Run conformance, closure, and distillation against a pull request in a shared worktree

The conformance, closure, and distillation stages gained an additive pull-request mode: conformance checks the possibly-open pull request and posts its verdict to the merge box, and after the merge closure and distillation run in one shared worktree cut from the trunk, so the drain reads an already-merged diff that cannot drift. The must-be-correct git mechanics — merge-state resolution, a range anchored on the merge commit and verified against the pull-request head, and the worktree lifecycle — live in one tested helper rather than inline spec prose, because worktree cleanup and range correctness would otherwise be unverified model discipline. Refuted alternative: describe the git commands inline in the specs — lighter, and needing no new package, but it leaves the deterministic parts untested.

### 2026-07-28 — manual — Reciprocal link from conformance-gate

Mechanical reciprocity fan-out: the conformance-gate page names this flow as the mode where
its receipt takes the form of a published review instead of a local artifact.

### 2026-08-01 — #178 — The worktree this flow runs in splits out to its own concept

Where the flow's worktrees are created stopped being a hidden temp-derived constant and became a declared publishing key, and with it the worktree gained a resolution seam, a normalization rule, a pre-creation safety gate, and three named refusals — enough that it no longer reads as a detail of this flow. The lifecycle material moved to pr-worktree: the base and its resolution, the per-checkout isolation segment, path-based reuse, the refusal conditions, and removal from the main checkout. This page keeps what is asked about the flow itself — the stage shape, the merge-strategy-safe range, the review-carried verdict, and the member-repo refusal — so a question about where a checkout lands loads one page and a question about what range closure stamps loads the other. Refuted alternative: keep the worktree material here and split the range derivation out instead — the range is the more self-contained topic on paper, but it is also the flow's whole reason for running post-merge, so removing it would leave a page that cannot explain itself.

### 2026-08-11 — #228 — The stamped range carries the drain's discovery exclusion

The range this flow stamps must equal the diff the drain later recomputes from it, so widening the drain's exclusion without widening this one would let the two disagree. The range derivation now excludes the committed discovery store alongside the queue. A merged pull request whose only remaining content is discovery prose is therefore refused as an empty range rather than stamped, which is the existing refusal applied to a wider exclusion. The live-acceptance harness's cross-check against the platform's own list of changed files still excludes the queue only, because it filters names by prefix instead of sharing the exclusion the other two use; that gap is filed as deferred scope. Refuted alternative: widen the cross-check in the same change — rejected because the conformance finding this answered named only the diff exclusion as load-bearing, and the consequence of leaving the cross-check is bounded to it reporting a mismatch that is not real.
