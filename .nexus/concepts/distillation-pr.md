---
title: "Distillation PR"
aliases: ["distillation pull request", "reviewed concept write", "gated apply", "curated apply"]
touches: ["distiller", "taxonomy-filing-gate", "drift-advisory"]
last_updated_by: "#94"
status: active
verification: verified
---

# Distillation PR

The distiller does not write the concept store directly; it opens a reviewed pull request against the store. That pull request is the authoritative write — the concept pages update only when it merges, and the consumed queue entries are deleted at the same moment.

## How It Works

On its post-merge drain, the distiller builds the deltas and lands them on a branch as a pull request, naturally batching the epics drained in that window. A human reviews the what-abstraction and the page-patch mapping — the parts most worth a second look, since the why was already reviewed when the feature merged. The merge is the authoritative write, and deleting the consumed queue entries is bound to that merge as a post-merge step. This routes the store's non-regenerable payload through the same review gate every other tracked change passes, adding no new pre-merge machinery. Two later additions ride this same PR without new machinery: a domain or subdomain the taxonomy filing gate coined, authored beside its motivating page, and the drift advisory's findings printed into the PR body. It accepts a real cost: knowledge review is decoupled from code review — a different reviewer, later, with less code context — and an undrained backlog can form, making drain cadence an operational target.

## Key Invariants

1. The distiller never writes the concept store directly; every write is a reviewed pull request.
2. The pull request merge is the authoritative write.
3. Consumed queue entries are deleted only when that merge lands.
4. Review targets the what-abstraction and the page mapping; the why was already reviewed at feature-merge time.

## Integration Points

- [distiller](distiller.md) — the producer whose output is gated through this reviewed pull request.
- [taxonomy-filing-gate](taxonomy-filing-gate.md) — an approved domain or subdomain is authored onto this same pull request, beside its motivating page.
- [drift-advisory](drift-advisory.md) — its findings are written into this pull request's body for the reviewer.

## Decision Log

### 2026-06-21 — bootstrap — 0007: apply via a reviewed pull request

Routed the distiller's write through a reviewed pull request instead of an unattended write to the trunk, so the store's non-regenerable judgment passes human review. The considered alternative — authoring the delta inside the feature pull request before merge, applied by a merge hook — was rejected on three real costs: it re-derives the code-derivable what twice and can go stale against the final merge; two concurrent feature branches editing the same concept apply blindly to each other; and it welds the knowledge write to a pull-request-shaped feature workflow. A single post-merge reviewed apply keeps the review and loses all three.

### 2026-07-20 — #94 — The reviewed write now also carries taxonomy growth and the drift advisory

The distillation-PR gained two riders that need no new machinery: a domain or subdomain the filing gate coined is authored onto the same branch beside the page that motivated it, so vocabulary growth is reviewed exactly where the page is, and the non-blocking drift advisory prints its findings into the PR body. Both keep the single reviewed write as the sole authoritative store write. This drain also re-checked the page against current code and flipped it from unverified to verified. Refuted alternative: author an approved registry change as its own separate PR ahead of the page — rejected because it splits one decision across two reviews and opens a window where the page references a domain the trunk does not yet define.
