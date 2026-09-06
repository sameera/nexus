---
title: "Append-Only Decision Log"
aliases: ["decision log", "immutable decision records", "why history", "decision log semantics", "append-only enforcement"]
touches: ["concept-store", "provenance-reference", "fix-razor"]
last_updated_by: "#263"
status: active
verification: verified
---

# Append-Only Decision Log

Every concept page carries a Decision Log — the append-only, immutable record of why the concept is the way it is. It is the one artifact in the system that cannot be reconstructed from code, which is why the store is version-tracked rather than derived.

## How It Works

Each change to a page appends exactly one dated, attributed entry. No change is silent. Prior entries are never edited, reordered, or deleted. A reversed decision is recorded as a new entry stating the reversal. An invariant that becomes false is struck through in place and its retirement logged. It is never removed, so a future design can still see the constraint once held and why it was dropped. Each entry records the why. It also records the road not taken — the genuinely viable alternative a competent engineer might have chosen, and why it lost. This is the payload that stops a later design from relitigating a settled question. The log is uncapped, because it is history. It is retrieved selectively after a page is already chosen, and not matched across pages in the common path. One class of change may do nothing but append. For it, appending is checked as byte identity everywhere outside the entry gained, so what the page still asserts cannot move under cover of adding to its history.

## Key Invariants

1. Every page change appends exactly one Decision Log entry; there are no silent edits.
2. Prior entries are never edited, reordered, or deleted; a reversal is a new entry.
3. A retired invariant is struck through in place and logged, never deleted.
4. Each entry records the why and, when one existed, the refuted viable alternative.
5. The log is uncapped and append-only; it is retrieved after a page is selected, not matched across pages.
6. Where a change may only append, that bound is enforced as byte identity outside the gained entry, not as a list of fields it may not touch.

## Integration Points

- [concept-store](concept-store.md) — the log is the durable-why section every concept page carries.
- [provenance-reference](provenance-reference.md) — each entry is attributed by a provenance reference to its originating issue.
- [fix-razor](fix-razor.md) — turns this page's append-only property into a mechanical check on a page's own diff.

## Decision Log

### 2026-06-10 — bootstrap — 0003: append-only, immutable log

Made the Decision Log append-only and immutable, with struck-through-not-deleted invariants. The considered alternative — editing pages in place to always reflect current truth — was rejected: it destroys the one artifact that cannot be regenerated from code, and a design that cannot see a dropped constraint and its reason will relitigate or silently reintroduce it.

### 2026-09-05 — #263 — Append-only became mechanically checkable, and this page was re-verified against the code

A lane for changes that may only append forced the append-only property from a rule the writer honours into one the tooling proves. The check is stated as byte identity everywhere outside the entry gained rather than as an enumeration of what may not be touched. Enumerating forbidden fields would give better error messages, but it must track the page schema. When it falls behind, it silently passes the exact edit the rule exists to prevent. This drain also re-read the page against the current tooling and changed its status from unverified to verified. Every invariant it carried from the bootstrap still holds. The one-entry-per-change and untouched-history rules are now the checks that block a write rather than conventions a writer follows.
