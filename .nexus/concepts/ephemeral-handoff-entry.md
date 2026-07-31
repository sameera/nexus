---
title: "Ephemeral Hand-Off Entry"
aliases: ["ephemeral entry", "hand-off entry", "same-sitting entry", "ephemeral area", "tmp-first close"]
touches: ["committed-queue", "distiller", "durable-close-record", "scratch-capture", "conformance-gate", "close-entry-migration"]
last_updated_by: "#170"
status: active
verification: verified
---

# Ephemeral Hand-Off Entry

An ephemeral hand-off entry is the version-ignored directory a local close leaves for the very next drain: the materialized epic, the conformance receipt, and the close record, none of them committed. It passes state from one command to the next in the same sitting, and nothing durable depends on it surviving.

## How It Works

Under issue-sourced planning nothing is committed at planning, so a local run materializes the epic into the ephemeral area and writes its receipt and close record beside it — no throwaway commit, no manual hand-off step. Because nothing can commit the deletion of a version-ignored path, consumption is derived rather than marked: the entry is consumed exactly when the concept store at the fetched trunk carries that epic's provenance in a structured position. A consumed directory is then removed with no commit; an unconsumed one never is, so a distillation abandoned before merge stays rediscoverable. They stay out of drain-health accounting — a local directory says nothing about any other machine.

## Key Invariants

1. A directory in the ephemeral area is a drainable entry only when it carries a close record; an epic-only materialization is resolver scratch, never listed, warned about, or aged.
2. Nothing here is committed, linked from an issue, or described as committed on any surface.
3. Consumption is derived from the store at the fetched trunk carrying the epic's provenance in a structured position, matched on whole tokens — never a state or marker file.
4. An entry whose provenance is absent is unconsumed and is never auto-deleted, whatever its age.
5. Ephemeral entries never enter drain-health accounting.
6. The merge precondition is the recorded range head reaching the trunk, or resolving to a merged pull request; failing both, the not-merged gate fires unchanged.
7. A drain's committed removal targets the epic's per-user scratch, never an ephemeral location; the ephemeral directory itself is deleted without a commit.

## Integration Points

- [committed-queue](committed-queue.md) — the durable counterpart, used by the pull-request flow and old-contract epics.
- [distiller](distiller.md) — discovers and drains these entries and derives their consumption.
- [durable-close-record](durable-close-record.md) — the comment that makes discarding this copy safe.
- [scratch-capture](scratch-capture.md) — the committed directory the drain's removal is re-aimed at.
- [conformance-gate](conformance-gate.md) — the receipt written here for the same-sitting hand-off.
- [close-entry-migration](close-entry-migration.md) — the member path migrating these artifacts and the committed scratch as one epic.

## Decision Log

### 2026-07-31 — #170 — Consumption is derived from the trunk store, not marked locally

Making the local hand-off entry version-ignored removes the throwaway commit, but it also removes the deletion that used to signal an entry was consumed — so consumption became a derived fact: an entry is consumed exactly when the concept store on the trunk carries its provenance. This generalizes the existing presence-means-unconsumed rule rather than abandoning it, and offers three properties nothing else does — the mark cannot exist before the merge that consumes the entry, because it is that merge; a distillation closed unmerged leaves the entry rediscoverable, so the never-delete-an-undrained-entry rule holds with no extra machinery; and no state file is introduced, which the drain forbids outright. Matching is restricted to structured provenance positions and whole tokens, so a stray prose mention cannot silently consume an undrained entry. Refuted alternative: write a marker into the entry, or delete it, when the distillation opens — local, offline, and trivially simple, but the mark would land before the merge that actually consumes the entry, so a distillation closed unmerged would silently lose a closed epic's rationale forever. Accepted consequence: a drain producing no concept deltas leaves no provenance and is re-offered on the next run, reported plainly.
