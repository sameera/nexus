---
title: "Code Anchors"
aliases: ["anchor sidecars", "derived path sidecar", "code anchor refresh", "concept anchors"]
touches: ["concept-store", "distiller", "grep-native-retrieval"]
last_updated_by: "bootstrap"
status: active
verification: unverified
---

# Code Anchors

Code anchors are derived sidecar files that map a concept to the source that implements it. They are the one place file paths are allowed — concept pages reject them — and they are regenerated on every drain, never hand-edited.

## How It Works

For every concept a drain touches, the distiller regenerates that concept's anchor sidecar from the diff paths attributable to it plus a name search over the source tree. Each anchor is stamped with the source revision it was derived from and marked as derived state. Because anchors are regenerable, a stale anchor is rebuilt rather than fixed, and a hand edit would simply be overwritten on the next drain. They exist to serve contributor ramp-up — the third consumer of the knowledge store, alongside spec generation and design — by giving a reader the jump from a concept's behavior to the code that realizes it, without polluting the durable page with paths that rot. They are seeded in bulk when the store is first bootstrapped.

## Key Invariants

1. Anchors are derived state — regenerated on every touching drain, never hand-edited.
2. Anchors are the only place file paths are allowed; concept pages still reject them.
3. Each anchor is stamped with the source revision it was derived from.
4. A stale anchor is rebuilt, not repaired.

## Integration Points

- [concept-store](concept-store.md) — anchors are the derived sidecar generated alongside each page.
- [distiller](distiller.md) — the engine that regenerates anchors on every drain.
- [grep-native-retrieval](grep-native-retrieval.md) — anchors extend retrieval from a concept toward its source.

## Decision Log

### 2026-07-02 — bootstrap — 0011: derived anchor sidecars for ramp-up

Added derived code-anchor sidecars, refreshed by the drain and seeded at bootstrap, to serve contributor ramp-up as a third store consumer. The considered alternative — putting file paths directly on concept pages — was rejected because paths rot against the source and would violate the pages' domain-terms-only boundary, whereas a regenerable sidecar keeps paths current and quarantined from the durable why.
