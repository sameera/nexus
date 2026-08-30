---
title: "Epic Issue Filing"
aliases: ["epic filer", "create-or-promote", "promotion legality gate", "decoration after existence"]
touches: ["report-free-shared-layer", "publishing-config-resolution", "backlog-stub"]
last_updated_by: "#352"
status: active
verification: verified
---

# Epic Issue Filing

Filing a single epic is a create-or-promote operation, never inferred from remote state: creation makes a new issue and promotion edits an existing one in place, clearing its unplanned marker. Every refusable condition is checked before any remote call, and once the issue exists, everything else is decoration that can fail without failing the run.

## How It Works

The number scope was deferred under is recoverable from exactly one place: the link written back to the draft the instant the issue's number is known, before any other step — the sole guard against a retried run duplicating an issue. Everything after that is decoration; a failed label, type or project add warns and the run still exits zero, because it is recoverable by hand in seconds.

Promotion reads legality before writing: an unresolvable number is a different mistake from a resolvable issue that lost the "not yet planned" marker, refused with different messages. It creates nothing and closes nothing.

Classification is decided before creation when a label must be established first — one that doesn't exist yet fails creation outright — and applied after when only an existing issue can carry it. The run's one interactive point refuses rather than waits when no reply can be read, the same terminal check that gates a line's colour.

## Key Invariants

1. Creation and promotion are distinct, chosen explicitly, never inferred from whether the target currently carries the unplanned marker.
2. Every refusable condition is checked before the first remote call; nothing is created or edited on a path that was going to be refused anyway.
3. The link back to the draft is written the moment the issue's number is known, before any other step.
4. Every step after the issue exists is decoration: it warns on failure and the run still exits zero.
5. Promotion is refused, before any write, both when the number does not resolve and when the resolved issue lost the unplanned marker — with different messages for the two, and it never creates or closes.
6. Classification is settled before creation when a label must be upserted first, and applied after when only an existing issue can carry it.
7. The run's one interactive point is refused, never left waiting, whenever no reply can be read.

## Integration Points

- [report-free-shared-layer](report-free-shared-layer.md) — supplies every platform call and project lookup this contract makes, none of them printing for themselves.
- [publishing-config-resolution](publishing-config-resolution.md) — decides the classification mode, the project target, and the repository this contract files into.
- [backlog-stub](backlog-stub.md) — the unplanned marker this contract checks for and clears is the same marker that state names.

## Decision Log

### 2026-08-30 — #352 — Composed from the shared toolkit mechanism rather than built from scratch

This contract is the single-issue counterpart to the toolkit's existing batch-filing contract: composed almost entirely from mechanism another capability already built for itself — configuration, classification, the shared platform and project lookups — with only the creation-or-promotion shape, the draft reader, and the confirmation seam newly written. Refuted alternative: build the single-issue path independently of the batch path's mechanism, on the reasoning that one issue and many issues are different enough problems to warrant it — rejected because the two capabilities' remote calls, classification rules and configuration are identical in substance and would drift the moment one changed without the other.
