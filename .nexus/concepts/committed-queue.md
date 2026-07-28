---
title: "Committed Queue"
aliases: ["queue handoff", "distillation queue", "planning artifact queue", "queue entry"]
touches: ["distiller", "nexus-pipeline", "scratch-capture", "close-entry-migration", "pr-driven-flow", "issue-sourced-planning", "decision-record", "record-digest"]
last_updated_by: "#157"
status: active
verification: verified
---

# Committed Queue

The committed queue is the single handoff surface between the delivery pipeline and the knowledge store: one committed folder per epic holding its human planning artifacts. It is not ignored by version control — it reaches the trunk with the work, and the distiller drains it afterward.

## How It Works

Each epic gets one committed folder, named for its issue number — the directory scratch capture already created during implementation is the entry itself, nothing moved or adopted. It holds the epic and close record; an old-contract entry alone still carries a decision-record file, since the record now lives on its sub-issue. Presence is the only state — no separate status file. Under issue-sourced planning the entry is born at close, so the queue holds only closed, drainable entries; abandoned epics never reach the trunk and never distill. A drained entry is deleted but stays recoverable through history. The queue holds only gated artifacts, never an ungated machine block — though it also carries decision-only memos drained diff-less into concept logs, and per-user scratch, hint-only and never read.

## Key Invariants

1. One committed folder per epic, named for the epic's issue number, holds that epic's human planning artifacts; an old-contract slug-named entry is read as-is.
2. The queue is committed, never ignored; every entry on the trunk carries a close record.
3. Presence equals unconsumed, with no separate state file.
4. An entry is drained only after its epic merges; abandoned epics never distill.
5. A drained entry is deleted but stays recoverable through history.
6. Everything drained passed a human gate; the per-user scratch riding inside is hint-only, never read.
7. An entry is an epic entry or a single-file decision memo, drained diff-less into logs.

## Integration Points

- [distiller](distiller.md) — drains each queue entry into the knowledge store.
- [nexus-pipeline](nexus-pipeline.md) — the pipeline whose stages fill the entry.
- [scratch-capture](scratch-capture.md) — the per-user scratch riding inside, never read into the store.
- [close-entry-migration](close-entry-migration.md) — a closed member entry migrates to the hub queue, not this trunk.
- [pr-driven-flow](pr-driven-flow.md) — the flow whose close record arrives on the distillation branch.
- [issue-sourced-planning](issue-sourced-planning.md) — the model under which this entry is born at close.
- [decision-record](decision-record.md) — no longer stored here; old-contract entries alone still carry its file.
- [record-digest](record-digest.md) — the approved-body hash the close record stamps for the drain.

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

### 2026-07-22 — #114 — The entry is born at close, not at planning

Under issue-sourced planning nothing is committed to the queue at planning time, so the committed entry — the materialized epic plus its close record — is written at close instead. This makes the queue a closed-only drain buffer: every entry present on the trunk carries a close record, and the planning-time, close-record-absent entry no longer exists. Old-contract epics whose entry was already committed at planning still drain as before; the two coexist only until those in flight clear. Refuted alternative: keep committing the epic at planning and regenerate it from issues at each stage — a committed cache, but the cache is itself the second copy that drifts, and born-at-close removes it while preserving the presence-equals-unconsumed invariant.

### 2026-07-26 — #139 — The decision record leaves the entry; the close record stamps its reference and hash

The queue is a drain buffer the distiller deletes, so a decision record stored here evaporated by design — its home moved to the epic's record sub-issue, and the entry's close record now carries the record's issue reference and approved-body hash instead, keeping the baseline self-contained after the drain deletes the queue files. Old-contract entries keep their committed record file and drain exactly as before; the two shapes coexist until in-flight entries clear. Refuted alternative: migrate committed records onto sub-issues in one pass — a single code path afterwards, but it rewrites closed history against a small affected population that clears on its own.

### 2026-07-28 — #157 — The entry is named for the epic issue number, not a slug plus a random id

The born-at-close entry now takes the epic's issue number as its whole name, so the directory scratch capture wrote to during implementation — keyed on that same number — is the entry the close stage materializes into, with nothing moved, renamed, or adopted. This removes the last consumer of slug-matching heuristics over queue directory names, since the issue number is already unique and already the pipeline's join key. Refuted alternative: keep the slug-plus-random-id name and have close adopt the capture directory into the entry it creates — preserves a human-readable directory name, but makes close move committed files and leaves a window where an epic has two live scratch locations.
