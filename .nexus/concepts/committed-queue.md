---
title: "Committed Queue"
aliases: ["queue handoff", "distillation queue", "planning artifact queue", "queue entry"]
touches: ["distiller", "nexus-pipeline"]
last_updated_by: "manual"
status: active
verification: verified
---

# Committed Queue

The committed queue is the single handoff surface between the delivery pipeline and the knowledge store: one committed folder per epic holding its human planning artifacts. It is not ignored by version control — it rides the feature branch to the trunk, and the distiller drains it afterward.

## How It Works

Each epic gets one folder holding its human planning artifacts — the epic, the decision record, and the close record. The folder is committed, so its invariants and rationale are visible from every checkout and worktree without duplicating them into the issue body, and its durability is automatic — there is nothing to stage before it can be consumed. Presence is the only state: an unconsumed entry is one that still exists, so there is no separate status file to read. The distiller drains an entry after the epic merges; abandoned epics never reach the trunk and never distill. A drained entry is deleted, keeping the steady-state tree clean while the artifacts remain recoverable through history. The queue is a third category, distinct from the human and machine surfaces — it holds gated human artifacts awaiting distillation, never an ungated machine block, so it does not breach the two-store split. Besides epic entries, the queue carries a second kind: the decision-only memo — a single reviewed decision file recording an out-of-band decision (idea, analysis, rejection — no code diff), drained diff-less into the relevant concepts' decision logs. Ungated captures such as engineer plan-mode plans never enter the queue in either form.

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

## Decision Log

### 2026-06-14 — bootstrap — 0006: one committed queue as the sole handoff

Collapsed two earlier surfaces — a gitignored transient folder plus a serialized staged sidecar — into one committed queue folder per epic, and made the distiller the sole synthesizer that reads it. The considered alternative — having the close stage emit a structured machine block for the distiller to consume — was rejected: it would place a machine artifact inside a human one, creating a laundering path across the two-store wall, whereas committed human prose plus the code diff gives the distiller everything it needs with nothing to launder.

### 2026-07-04 — manual — No plan capture into the queue; decision-only memos added

Engineer plan-mode plans stay out of the queue: they are pre-implementation speculation — unreviewed, unbounded, provenance-free, and routinely divergent from what ships — so a capture hook feeding the queue would contaminate a surface whose value is that every line passed a human gate. Out-of-band decisions instead enter as a single reviewed decision memo, drained diff-less into the relevant concepts' decision logs. Refuted alternatives: a checked-in hook harvesting plans into the queue — zero-effort coverage, but a consent breach that silently commits engineers' half-ideas; a separate directory of decision records — a second decision surface competing with the per-concept logs, re-creating the sprawl the store exists to cure.
