---
title: "Distillation PR"
aliases: ["distillation pull request", "reviewed concept write", "gated apply", "curated apply"]
touches: ["distiller"]
last_updated_by: "bootstrap"
status: active
verification: unverified
---

# Distillation PR

The distiller does not write the concept store directly; it opens a reviewed pull request against the store. That pull request is the authoritative write — the concept pages update only when it merges, and the consumed queue entries are deleted at the same moment.

## How It Works

On its post-merge drain, the distiller builds the deltas and lands them on a branch as a pull request, naturally batching the epics drained in that window. A human reviews the what-abstraction and the page-patch mapping — the parts most worth a second look, since the why was already reviewed when the feature merged. The merge is the authoritative write, and deleting the consumed queue entries is bound to that merge as a post-merge step. This routes the store's non-regenerable payload through the same review gate every other tracked change passes, adding no new pre-merge machinery. It accepts a real cost: knowledge review is decoupled from code review — a different reviewer, later, with less code context — and an undrained backlog can form, making drain cadence an operational target.

## Key Invariants

1. The distiller never writes the concept store directly; every write is a reviewed pull request.
2. The pull request merge is the authoritative write.
3. Consumed queue entries are deleted only when that merge lands.
4. Review targets the what-abstraction and the page mapping; the why was already reviewed at feature-merge time.

## Integration Points

- [distiller](distiller.md) — the producer whose output is gated through this reviewed pull request.

## Decision Log

### 2026-06-21 — bootstrap — 0007: apply via a reviewed pull request

Routed the distiller's write through a reviewed pull request instead of an unattended write to the trunk, so the store's non-regenerable judgment passes human review. The considered alternative — authoring the delta inside the feature pull request before merge, applied by a merge hook — was rejected on three real costs: it re-derives the code-derivable what twice and can go stale against the final merge; two concurrent feature branches editing the same concept apply blindly to each other; and it welds the knowledge write to a pull-request-shaped feature workflow. A single post-merge reviewed apply keeps the review and loses all three.
