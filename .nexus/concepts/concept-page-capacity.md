---
title: "Concept Page Capacity"
aliases: ["body cap", "400-word cap", "own content", "per-bullet ceiling", "neighbour list bound", "split don't grow"]
touches: ["concept-store", "grep-native-retrieval", "distiller", "finding-severity"]
last_updated_by: "#220"
status: active
verification: verified
---

# Concept Page Capacity

The 400-word cap on a concept page measures the page's own content — its summary, its behavior section and its invariants — and never its neighbour list. The neighbour list is bounded per entry instead: a neighbour bullet over 40 words is a violation, one over 25 words is advisory, and a page carrying more than 12 neighbours is named as a hub without failing anything. A page is therefore flagged for being broad and never for being popular.

## How It Works

The counted region is defined by exclusion — the body minus the neighbour list and minus the decision history. On a well-formed page that is exactly the summary, the behavior section and the invariants, but exclusion is what governs, so a section a page invents counts against the cap by default and the cap cannot be evaded by inventing a heading. Overflow of that region means the concept is too broad, and the page is split. A total body past 400 words caused only by neighbour bullets needs no split and no compression: a real interaction is always declarable as an edge, and one that will not fit in 40 words is the signal that it is two interactions.

Worst-case page size follows as 400 words plus 40 for each neighbour — 880 words at the 12-neighbour tripwire, and roughly six thousand across the seven pages one task may load. Two store-level numbers say when this relief has run out.

## Key Invariants

1. The cap counts a page's own content — the body minus the neighbour list and minus the decision history — and that region is defined by exclusion, so an invented section counts against it.
2. The cap stays at 400 words; changing what it measures edited no existing page.
3. Own-content overflow is the only split trigger and the only eviction trigger.
4. Neighbour-list pressure is never a reason to drop, demote, or compress an interaction.
5. A neighbour bullet over 40 words is a violation; over 25 words it is advisory only.
6. Degree is watched, never limited: more than 12 neighbours is named, never failed.
7. Moving interaction prose off the page is revisited when neighbour prose passes a quarter of all page text, or the highest-degree page passes 25 neighbours.

## Integration Points

- [concept-store](concept-store.md) — the page schema this cap is part of, and the store the measured thresholds were calibrated against.
- [grep-native-retrieval](grep-native-retrieval.md) — the retrieval model whose neighbour list this bounds per entry rather than against the cap.
- [distiller](distiller.md) — the single writer that applies the cap, and splits only on own-content overflow.
- [finding-severity](finding-severity.md) — the two-class output through which the bullet and degree thresholds report without failing a run.

## Decision Log

### 2026-08-04 — #220 — The cap measures the concept, not its neighbours

A page's own content grows with the breadth of its concept, where splitting is the right answer; its neighbour list grows with the size of the store and the page's popularity, where splitting is the wrong answer, because a narrow page cut in half to make room for someone else's bullet makes retrieval worse. Measured before the thresholds were fixed: no page exceeded 400 words of own content, neighbour prose was a sixth of all page text, and the fullest pages were the best-connected ones rather than the broadest — so the cap was measuring the wrong thing, and the touches graph had quietly stopped growing. The counted region is set by exclusion rather than by naming the three sections it contains: enumeration matches the contract's own description and reads cleaner, but it lets the cap be escaped by inventing a fourth heading and silently stops counting prose the store does care about. The per-entry bound replaces the old total: 40 words is a tenth of the own-content budget and sits above the largest bullet in the store, so nothing needed editing.
