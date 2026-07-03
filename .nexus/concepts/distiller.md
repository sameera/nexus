---
title: "Distiller"
aliases: ["System B", "distillation engine", "concept distiller", "the drain"]
touches: ["concept-store", "committed-queue", "distillation-pr", "code-anchors"]
last_updated_by: "bootstrap"
status: active
verification: unverified
---

# Distiller

The distiller is the engine that drains committed queue entries into the concept store. It derives what changed from the merged code diff and why from the queued human records, infers the per-concept mapping itself, and applies the result through a reviewed pull request rather than a direct write.

## How It Works

The distiller runs after epics merge, scanning for unconsumed queue entries. For each, it recomputes the diff from history — the diff is never stored — and reads the decision and close records for the rationale. It maps that material to a list of per-concept deltas, each a page-patch carrying the changed sections plus exactly one decision entry. Its work splits along a firm line: judgment is the model's — mapping the diff and records to concepts, writing the prose, resolving a slug collision — while the mechanical steps are code and never improvised: the neighbor-link reciprocity fan-out, the anchor refresh, and the validator. A validation failure blocks the apply; the pages are fixed and revalidated, never shipped failing. The distiller never writes the store directly, and never deletes a queue entry outside the merge that consumes it.

## Key Invariants

1. The distiller is the single producer of the concept store.
2. What changed comes from the recomputed diff; why comes from the queued human records; the diff is never stored.
3. Judgment — concept mapping and prose — is the model's; the reciprocity, anchor, and validator steps are deterministic code.
4. A validation failure blocks the apply; a failing page is never shipped.
5. The distiller infers the concept mapping itself — the pipeline emits no structured concept list.
6. Draining is a manually-invoked curated step, not an automated trigger; only detecting undrained entries and deleting consumed ones are deterministic.

## Integration Points

- [concept-store](concept-store.md) — the store the distiller is the sole producer of.
- [committed-queue](committed-queue.md) — the entries the distiller drains.
- [distillation-pr](distillation-pr.md) — the reviewed pull request through which the distiller applies its output.
- [code-anchors](code-anchors.md) — the derived sidecars the distiller regenerates for every touched concept.

## Decision Log

### 2026-06-14 — bootstrap — 0006: synthesis lives in the distiller

Located all synthesis in the distiller: the pipeline stays dumb and emits only human prose, while the distiller reads the diff and records and infers the concept mapping. The considered alternative — having the close stage pre-produce the structured concept list — was rejected because it pushes machine synthesis onto the human surface and pre-guesses concept boundaries before the final merged code exists, whereas a single post-merge synthesizer sees the final state of every drained epic and reconciles once.

### 2026-07-03 — bootstrap — 0012: draining is a manual curated step, not an auto-trigger

Fixed the drain trigger as a manually-invoked curated step: a human runs the distiller after a feature with a queue entry merges, backed only by the built-in thirty-day drain age flag. A capability ladder is climbed only as scale forces it — manual now; then a plain check that detects undrained closed entries and nags; and only at sustained volume a scheduled headless run that opens the reviewed pull request plus a deterministic deletion step on its merge. The considered alternative — an unattended trigger that runs the distiller automatically on every merge — was rejected: it reintroduces the unattended write the reviewed-pull-request rule removed, merely relocated, and is speculative machinery for a single-entry queue. Resolves the cadence question left open by 0007; reviewer assignment stays open.
