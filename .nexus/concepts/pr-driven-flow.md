---
title: "PR-Driven Post-Merge Flow"
aliases: ["pr mode", "pull-request post-merge flow", "worktree pr flow", "merge-commit range derivation", "conformance against a pull request"]
touches: ["nexus-pipeline", "distiller", "distillation-pr", "committed-queue", "conformance-gate", "pr-worktree", "pre-epic-discovery", "pr-story-resolution", "aggregated-epic-receipt", "multi-pr-close"]
last_updated_by: "#215"
status: active
verification: verified
---

# PR-Driven Post-Merge Flow

The lead can run the conformance, closure, and distillation stages against a pull request instead of a live branch. Conformance checks the pull request while it may still be open; after it merges, closure and distillation run against the merged pull request in one shared isolated worktree, so the diff the drain reads cannot drift. It runs in single-repo and hub checkouts; conformance also runs against a declared member's pull request, which closure and distillation still refuse. The local flow is untouched.

## How It Works

One tested helper the stage specs call resolves a pull request's merge state and commit identifiers, and a merge-strategy-safe commit range. Conformance runs in a worktree at the pull-request head and publishes its verdict as a review carrying the machine-readable receipt closure reads back, falling back to a comment if the lead authored it. After the merge, closure runs in a worktree on a fresh distillation branch off the trunk, reads that verdict, commits and pushes the close artifacts, and hands off; distillation continues there and opens its pull request. The stamped range anchors on the merge commit, permanent on the trunk, and verified against the pull-request head, so it holds for any merge strategy.

A conformance run takes one pull-request reference. A bare number means this checkout's own repository, and a repository-qualified reference names a member the hub's manifest declares. The manifest is the only source of that repository.

## Key Invariants

1. Only conformance runs against a member repository; closure and distillation refuse one, a member epic closing from the hub instead.
2. The stamped range anchors on commits permanent on the trunk, never the pull-request branch tip; an empty, non-ancestor, or unverifiable range is refused rather than guessed.
3. The flow is additive and mutually exclusive with the local path.
4. A conformance verdict is trusted only from a maintainer-authored review or comment in the pull request's own repository, and only when its stamped repository and pull request match those read. Staleness is exact full-identifier equality against the pull-request head.
5. Closure and distillation share one worktree on the distillation branch.
6. A conformance run reads its diff, its code and the engineer's scratch from the target repository's checkout, and everything it is judged against from a main checkout. An undeclared repository, or a declared member absent from its expected checkout, stops the run.

## Integration Points

- [nexus-pipeline](nexus-pipeline.md) — the pipeline whose conformance and closure stages this flow runs against a pull request.
- [distiller](distiller.md) — the drain that continues in the shared worktree and derives its diff from the stamped range.
- [distillation-pr](distillation-pr.md) — the reviewed write the closure hand-off prepares and distillation opens.
- [committed-queue](committed-queue.md) — the queue whose close record travels on the distillation branch here, there being no feature pull request after the merge.
- [conformance-gate](conformance-gate.md) — here the gate's receipt is a published review, not a local artifact, since the worktree holding one is already gone.
- [pr-worktree](pr-worktree.md) — the worktree these stages run in: where it lands, its isolation, reuse, and removal.
- [pre-epic-discovery](pre-epic-discovery.md) — excluded from the stamped range too, so that range matches the diff the drain later recomputes.
- [pr-story-resolution](pr-story-resolution.md) — resolves which stories a conformance run covers, and narrows that run's findings to them.
- [aggregated-epic-receipt](aggregated-epic-receipt.md) — collects the per-story verdicts this flow publishes into one answer for the epic they belong to.
- [multi-pr-close](multi-pr-close.md) — generalizes this flow's closure stage to an epic that shipped as several pull requests; one pull request is the one-entry case.

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

### 2026-09-10 — #211 — The member refusal narrows by stage, and a conformance run names the repository it reads

The refusal that kept every member repository out of this flow was protecting a real incompatibility that has not gone away: a member's close still runs on its feature branch and migrates its entry to the hub, and that path is retired by separate work. Deleting the refusal now would let a post-merge close cut a trunk worktree in a repository whose close contract is still the migration path, and it would do so silently. So the gate stopped being about role alone and became about role per stage. Conformance accepts a member; closure and distillation still refuse one, and the refusal now names closure specifically. A member checkout running conformance against its own pull request is the same path with the member selecting itself, and it is allowed.

The reference the lead supplies is the only token that names the repository, so a pull-request address and a stale repository flag can never disagree. That reference may only select among the members the manifest declares: an externally supplied string may choose a locally declared member, and it may never supply a remote or a path. The worktree lands under the target's own base, so a hub run and a member run cannot collide. Matching a reference to a member lowercases both the host and the repository path, which is narrower than the normalization the resolver otherwise applies. That rule preserves path case because a self-hosted forge may be case-sensitive, while a lead pasting a pull-request address reproduces the platform's own casing rather than the manifest's spelling.

Refuted alternative: fetch the member's pull-request head into the hub's own git directory, so no member checkout is needed. That removes the missing-checkout refusal entirely. It loses on writing foreign objects into the hub repository, on having no member configuration to resolve against, and on contradicting the sibling-checkout model the workspace resolver already guarantees. One piece of the approved design did not ship: configuration is still resolved with the worktree as its root in this mode, so a pull request can still redirect where the gate reads its own settings from. That residue is carried as deferred scope rather than reopening a merged pull request.

Mechanical reciprocity fan-out: the pull-request story resolution page names this flow's conformance stage as what resolves its scope through the candidate ladder, and its findings as what that ladder narrows.

### 2026-09-10 — #212 — Reciprocal link from aggregated-epic-receipt

Mechanical reciprocity fan-out: the verdicts this flow publishes on story pull requests are now read back and combined into one epic-level receipt, so an epic that shipped story by story has an answer the close gate can read without a second conformance run.

### 2026-09-10 — #213 — Reciprocal link from multi-pr-close

Close over several pull requests generalizes this flow's closure stage, so the edge is recorded on both pages.

### 2026-09-11 — #215 — A member is still refused, for a different reason

The refusal on closure and distillation in a member checkout is unchanged, but what it points the lead at is not. It used to name the member's own close-and-migrate path as the alternative; that path is deleted, so the refusal now names the hub and the epic-addressed close over merged pull requests. The invariant survives because the reasoning behind it survives: a queue entry born in a member checkout sits in a repository whose drain refuses to run, which is the stranding the retirement exists to end. Refuted alternative: lift the refusal as well, so a member close works locally and the entry reaches the hub some other way. It is better for the lead, who never switches repository, but that other way is the relocation path under a new name, and the entry would still be born where nothing drains it.
