---
title: "Committed Queue"
aliases: ["queue handoff", "distillation queue", "planning artifact queue", "queue entry"]
touches: ["distiller", "nexus-pipeline"]
last_updated_by: "bootstrap"
status: active
verification: unverified
---

# Committed Queue

The committed queue is the single handoff surface between the delivery pipeline and the knowledge store: one committed folder per epic holding its human planning artifacts. It is not ignored by version control — it rides the feature branch to the trunk, and the distiller drains it afterward.

## How It Works

Each epic gets one folder holding its human planning artifacts — the epic, the decision record, and the close record. The folder is committed, so its invariants and rationale are visible from every checkout and worktree without duplicating them into the issue body, and its durability is automatic — there is nothing to stage before it can be consumed. Presence is the only state: an unconsumed entry is one that still exists, so there is no separate status file to read. The distiller drains an entry after the epic merges; abandoned epics never reach the trunk and never distill. A drained entry is deleted, keeping the steady-state tree clean while the artifacts remain recoverable through history. The queue is a third category, distinct from the human and machine surfaces — it holds gated human artifacts awaiting distillation, never an ungated machine block, so it does not breach the two-store split.

## Key Invariants

1. One committed folder per epic holds that epic's human planning artifacts.
2. The queue is committed and travels with the feature branch; it is never ignored by version control.
3. Presence equals unconsumed — there is no separate state file.
4. An entry is drained only after its epic merges; abandoned epics never distill.
5. A drained entry is deleted but stays recoverable through history.

## Integration Points

- [distiller](distiller.md) — the consumer that drains each queue entry into the knowledge store.
- [nexus-pipeline](nexus-pipeline.md) — the pipeline whose stages fill the queue entry across an epic's life.

## Decision Log

### 2026-06-14 — bootstrap — 0006: one committed queue as the sole handoff

Collapsed two earlier surfaces — a gitignored transient folder plus a serialized staged sidecar — into one committed queue folder per epic, and made the distiller the sole synthesizer that reads it. The considered alternative — having the close stage emit a structured machine block for the distiller to consume — was rejected: it would place a machine artifact inside a human one, creating a laundering path across the two-store wall, whereas committed human prose plus the code diff gives the distiller everything it needs with nothing to launder.
