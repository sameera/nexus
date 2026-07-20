---
title: "Committed Queue"
aliases: ["queue handoff", "distillation queue", "planning artifact queue", "queue entry"]
touches: ["distiller", "nexus-pipeline", "scratch-capture", "close-entry-migration", "pr-driven-flow"]
last_updated_by: "#101"
status: active
verification: verified
---

# Committed Queue

The committed queue is the single handoff surface between the delivery pipeline and the knowledge store: one committed folder per epic holding its human planning artifacts. It is not ignored by version control — it reaches the trunk with the work, and the distiller drains it afterward.

## How It Works

Each epic gets one committed folder holding its human planning artifacts — the epic, the decision record, and the close record — visible from every checkout. Presence is the only state: an unconsumed entry still exists, so there is no separate status file. The distiller drains an entry after the epic merges; abandoned epics never reach the trunk and never distill. A drained entry is deleted but stays recoverable through history. The queue holds gated human artifacts awaiting distillation, never an ungated machine block, so it does not breach the two-store split. It also carries decision-only memos — a single reviewed decision file with no code diff, drained diff-less into the relevant concepts' decision logs. An entry additionally carries the epic's committed per-user engineer scratch — hint-only, drained away with the entry, never read into the store.

## Key Invariants

1. One committed folder per epic holds that epic's human planning artifacts.
2. The queue is committed and never ignored by version control; its entry reaches the trunk with the work.
3. Presence equals unconsumed — there is no separate state file.
4. An entry is drained only after its epic merges; abandoned epics never distill.
5. A drained entry is deleted but stays recoverable through history.
6. Everything the distiller drains passed a human gate; the per-user scratch that also rides inside the entry is hint-only, never read.
7. An entry is an epic entry or a single-file decision memo; a memo drains diff-less into the relevant concepts' decision logs.

## Integration Points

- [distiller](distiller.md) — the consumer that drains each queue entry into the knowledge store.
- [nexus-pipeline](nexus-pipeline.md) — the pipeline whose stages fill the queue entry across an epic's life.
- [scratch-capture](scratch-capture.md) — the per-user scratch that now rides inside each entry, hint-only and drained away with it, never read into the store.
- [close-entry-migration](close-entry-migration.md) — a closed member entry is migrated to the hub queue, not the code repo's trunk.
- [pr-driven-flow](pr-driven-flow.md) — the post-merge flow whose close record this queue receives on the distillation branch.

## Decision Log

### 2026-06-14 — bootstrap — 0006: one committed queue as the sole handoff

Collapsed two earlier surfaces — a gitignored transient folder plus a serialized staged sidecar — into one committed queue folder per epic, and made the distiller the sole synthesizer that reads it. The considered alternative — having the close stage emit a structured machine block for the distiller to consume — was rejected: it would place a machine artifact inside a human one, creating a laundering path across the two-store wall, whereas committed human prose plus the code diff gives the distiller everything it needs with nothing to launder.

### 2026-07-04 — manual — No plan capture into the queue; decision-only memos added

Engineer plan-mode plans stay out of the queue: they are pre-implementation speculation — unreviewed, unbounded, provenance-free, and routinely divergent from what ships — so a capture hook feeding the queue would contaminate a surface whose value is that every line passed a human gate. Out-of-band decisions instead enter as a single reviewed decision memo, drained diff-less into the relevant concepts' decision logs. Refuted alternatives: a checked-in hook harvesting plans into the queue — zero-effort coverage, but a consent breach that silently commits engineers' half-ideas; a separate directory of decision records — a second decision surface competing with the per-concept logs, re-creating the sprawl the store exists to cure.

### 2026-07-04 — manual — Reciprocal link from scratch-capture

Mechanical reciprocity fan-out: the scratch-capture page names this queue as the gated surface its hints may only reach through the close record.

### 2026-07-15 — #49 — Reciprocal link from close-entry-migration

Mechanical reciprocity fan-out: the close-entry-migration page names this queue as the surface whose closed member entry is relocated to the hub rather than riding the code repo's trunk.

### 2026-07-18 — #67 — The entry also carries per-user engineer scratch

In-flight decision scratch moved into committed per-user subdirectories inside the queue entry, so an entry now physically holds both its gated human artifacts and ungated engineer scratch. This refines the earlier "ungated captures never enter" invariant: the scratch rides inside the entry as a hint-only surface the distiller never reads and never distils, so nothing ungated ever crosses into the store — the human-gate guarantee holds for everything the distiller actually drains. Refuted alternative: keep scratch on a separate ungated surface outside the queue — it keeps the entry purely gated but leaves the highest-fidelity rationale invisible on the PR head and forces a bespoke deletion the committed model removes for free.

### 2026-07-20 — #101 — In the pull-request flow the close record arrives on the distillation branch

The queue's entry reaches the trunk with the work, but its close record no longer always rides a feature branch: in the post-merge pull-request flow the closure runs after the merge, when no feature pull request is left to carry it, so the close record is committed on the distillation branch and drained from there. The epic and decision record still land earlier, during planning. Refuted alternative: hold the post-merge close artifacts uncommitted in the worktree — rejected as lost if the worktree is discarded, whereas committing them on the distillation branch keeps them durable and reviewable.
