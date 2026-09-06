---
title: "Ephemeral Hand-Off Entry"
aliases: ["ephemeral entry", "hand-off entry", "same-sitting entry", "ephemeral area", "tmp-first close", "entry kind"]
touches: ["committed-queue", "distiller", "durable-close-record", "scratch-capture", "conformance-gate", "close-entry-migration", "fix-lane"]
last_updated_by: "#263"
status: active
verification: verified
---

# Ephemeral Hand-Off Entry

An ephemeral hand-off entry is the version-ignored directory a local close leaves for the very next drain: the materialized epic, the conformance receipt, and the close record, none of them committed. It passes state from one command to the next in the same sitting, and nothing durable depends on it surviving. The fix lane writes its entries into the same area, on the same terms.

## How It Works

Under issue-sourced planning nothing is committed at planning, so a local run materializes the epic into the ephemeral area and writes its receipt and close record beside it. No throwaway commit or manual hand-off step is needed. Because nothing can commit the deletion of a version-ignored path, consumption is derived rather than marked: the entry is consumed exactly when the concept store at the fetched trunk carries that epic's provenance in a structured position. A consumed directory is then removed with no commit; an unconsumed one never is, so a distillation abandoned before merge stays rediscoverable. They stay out of drain-health accounting. A local directory says nothing about any other machine. What an entry is comes from the kind recorded in its own header, not from its location or what its directory name is. When the two disagree, the entry stops outright.

## Key Invariants

1. A directory in the ephemeral area is a drainable entry only when it carries a close record; an epic-only materialization is resolver scratch, never listed, warned about, or aged.
2. Nothing here is committed, linked from an issue, or described as committed on any surface.
3. Consumption is derived from the store at the fetched trunk carrying the epic's provenance in a structured position, matched on whole tokens — never a state or marker file.
4. An entry whose provenance is absent is unconsumed and is never auto-deleted, whatever its age.
5. Ephemeral entries never enter drain-health accounting.
6. The merge precondition is the recorded range head reaching the trunk, or resolving to a merged pull request; failing both, the not-merged gate fires unchanged.
7. A drain's committed removal targets the epic's per-user scratch, never an ephemeral location; the ephemeral directory itself is deleted without a commit, and an entry with no scratch home has no committed removal target at all.

## Integration Points

- [committed-queue](committed-queue.md) — the durable counterpart, used by the pull-request flow and old-contract epics.
- [distiller](distiller.md) — discovers and drains these entries and derives their consumption.
- [durable-close-record](durable-close-record.md) — the comment that makes discarding this copy safe.
- [scratch-capture](scratch-capture.md) — the committed directory the drain's removal is re-aimed at.
- [conformance-gate](conformance-gate.md) — the receipt written here for the same-sitting hand-off.
- [close-entry-migration](close-entry-migration.md) — the member path migrating these artifacts and the committed scratch as one epic.
- [fix-lane](fix-lane.md) — the other writer into this area, whose entries carry no scratch home and so no committed removal target.

## Decision Log

### 2026-07-31 — #170 — Consumption is derived from the trunk store, not marked locally

Making the local hand-off entry version-ignored removes the throwaway commit, but it also removes the deletion that used to signal an entry was consumed — so consumption became a derived fact: an entry is consumed exactly when the concept store on the trunk carries its provenance. This generalizes the existing presence-means-unconsumed rule rather than abandoning it, and offers three properties nothing else does — the mark cannot exist before the merge that consumes the entry, because it is that merge; a distillation closed unmerged leaves the entry rediscoverable, so the never-delete-an-undrained-entry rule holds with no extra machinery; and no state file is introduced, which the drain forbids outright. Matching is restricted to structured provenance positions and whole tokens, so a stray prose mention cannot silently consume an undrained entry. Refuted alternative: write a marker into the entry, or delete it, when the distillation opens — local, offline, and trivially simple, but the mark would land before the merge that actually consumes the entry, so a distillation closed unmerged would silently lose a closed epic's rationale forever. Accepted consequence: a drain producing no concept deltas leaves no provenance and is re-offered on the next run, reported plainly.

### 2026-09-05 — #263 — The recorded kind decides what an entry is, not its directory name

The area gained a second kind of occupant when the fix lane began writing entries here, and discovery keys on the directory name while the bound on what a fix may write keys on the kind recorded in the header. Neither was named as winning. Every resolution other than stopping silently picks one of two contradictory claims about what the entry is, and picking the directory name would additionally let an entry drain as an epic while its own header says it is a fix — the exact case the bound exists to catch. The recorded kind is therefore authoritative and a disagreement is a named per-entry hard block. A fix entry also has no per-user scratch to delete, because it was never an epic, so the committed removal step has no target and reports none: an absent target here is the expected shape, not a warning.
