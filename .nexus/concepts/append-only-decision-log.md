---
title: "Append-Only Decision Log"
aliases: ["decision log", "immutable decision records", "why history", "decision log semantics"]
touches: ["concept-store", "provenance-reference"]
last_updated_by: "bootstrap"
status: active
verification: unverified
---

# Append-Only Decision Log

Every concept page carries a Decision Log — the append-only, immutable record of why the concept is the way it is. It is the one artifact in the system that cannot be reconstructed from code, which is why the store is version-tracked rather than derived.

## How It Works

Each change to a page appends exactly one dated, attributed entry; no change is silent. Prior entries are never edited, reordered, or deleted — a reversed decision is recorded as a new entry stating the reversal. An invariant that becomes false is struck through in place and its retirement logged, never removed, so a future design can still see the constraint once held and why it was dropped. Each entry records the why plus the road not taken — the genuinely viable alternative a competent engineer might have chosen, and why it lost — which is the payload that stops a later design from relitigating a settled question. The log is uncapped because it is history: retrieved selectively after a page is already chosen, and not matched across pages in the common path.

## Key Invariants

1. Every page change appends exactly one Decision Log entry; there are no silent edits.
2. Prior entries are never edited, reordered, or deleted; a reversal is a new entry.
3. A retired invariant is struck through in place and logged, never deleted.
4. Each entry records the why and, when one existed, the refuted viable alternative.
5. The log is uncapped and append-only; it is retrieved after a page is selected, not matched across pages.

## Integration Points

- [concept-store](concept-store.md) — the log is the durable-why section every concept page carries.
- [provenance-reference](provenance-reference.md) — each entry is attributed by a provenance reference to its originating issue.

## Decision Log

### 2026-06-10 — bootstrap — 0003: append-only, immutable log

Made the Decision Log append-only and immutable, with struck-through-not-deleted invariants. The considered alternative — editing pages in place to always reflect current truth — was rejected: it destroys the one artifact that cannot be regenerated from code, and a design that cannot see a dropped constraint and its reason will relitigate or silently reintroduce it.
