---
title: "Committed Queue"
aliases: ["queue handoff", "distillation queue", "planning artifact queue", "queue entry"]
touches: ["distiller", "nexus-pipeline", "scratch-capture", "close-entry-migration"]
last_updated_by: "#49"
status: active
verification: verified
---

# Committed Queue

The committed queue is the single handoff surface between the delivery pipeline and the knowledge store: one committed folder per epic holding its human planning artifacts. It is not ignored by version control — it rides the feature branch to the trunk, and the distiller drains it afterward.

## How It Works

Each epic gets one folder holding its human planning artifacts — the epic, the decision record, and the close record. The folder is committed, so its invariants and rationale are visible from every checkout without duplicating them into the issue body, and its durability is automatic — nothing to stage before consumption. Presence is the only state: an unconsumed entry still exists, so there is no separate status file. The distiller drains an entry after the epic merges; abandoned epics never reach the trunk and never distill. A drained entry is deleted, keeping the tree clean while its artifacts stay recoverable through history. The queue is a third category, distinct from the human and machine surfaces — it holds gated human artifacts awaiting distillation, never an ungated machine block, so it does not breach the two-store split. The queue also carries decision-only memos — a single reviewed decision file recording an out-of-band decision with no code diff, drained diff-less into the relevant concepts' decision logs. Ungated captures such as plan-mode plans never enter.

## Key Invariants

1. One committed folder per epic holds that epic's human planning artifacts.
2. The queue is committed and travels with the feature branch; it is never ignored by version control.
3. Presence equals unconsumed — there is no separate state file.
4. An entry is drained only after its epic merges; abandoned epics never distill.
5. A drained entry is deleted but stays recoverable through history.
6. Every artifact in the queue passed a human gate; ungated captures never enter.
7. An entry is an epic entry or a single-file decision memo; a memo drains diff-less into the relevant concepts' decision logs.

## Integration Points

- [distiller](distiller.md) — the consumer that drains each queue entry into the knowledge store.
- [nexus-pipeline](nexus-pipeline.md) — the pipeline whose stages fill the queue entry across an epic's life.
- [scratch-capture](scratch-capture.md) — the ungated shadow surface; only close-gated prose crosses into the queue.
- [close-entry-migration](close-entry-migration.md) — a closed member entry is migrated to the hub queue, not the code repo's trunk.

## Decision Log

### 2026-06-14 — bootstrap — 0006: one committed queue as the sole handoff

Collapsed two earlier surfaces — a gitignored transient folder plus a serialized staged sidecar — into one committed queue folder per epic, and made the distiller the sole synthesizer that reads it. The considered alternative — having the close stage emit a structured machine block for the distiller to consume — was rejected: it would place a machine artifact inside a human one, creating a laundering path across the two-store wall, whereas committed human prose plus the code diff gives the distiller everything it needs with nothing to launder.

### 2026-07-04 — manual — No plan capture into the queue; decision-only memos added

Engineer plan-mode plans stay out of the queue: they are pre-implementation speculation — unreviewed, unbounded, provenance-free, and routinely divergent from what ships — so a capture hook feeding the queue would contaminate a surface whose value is that every line passed a human gate. Out-of-band decisions instead enter as a single reviewed decision memo, drained diff-less into the relevant concepts' decision logs. Refuted alternatives: a checked-in hook harvesting plans into the queue — zero-effort coverage, but a consent breach that silently commits engineers' half-ideas; a separate directory of decision records — a second decision surface competing with the per-concept logs, re-creating the sprawl the store exists to cure.

### 2026-07-04 — manual — Reciprocal link from scratch-capture

Mechanical reciprocity fan-out: the scratch-capture page names this queue as the gated surface its hints may only reach through the close record.

### 2026-07-15 — #49 — Reciprocal link from close-entry-migration

Mechanical reciprocity fan-out: the close-entry-migration page names this queue as the surface whose closed member entry is relocated to the hub rather than riding the code repo's trunk.
