---
title: "Grep-Native Retrieval"
aliases: ["no-topology retrieval", "grep-native knowledge", "blast radius by grep", "neighbor list"]
touches: ["concept-store", "code-anchors", "drift-advisory", "concept-page-capacity", "fix-razor"]
last_updated_by: "#263"
status: active
verification: verified
---

# Grep-Native Retrieval

The knowledge store is retrieved by plain text search: search, list, and read. It has no graph engine, embeddings, or community detection. Blast radius is what a change ripples into. It is answered by matching a concept name across pages, not by traversing a computed topology.

## How It Works

Retrieval has four paths, all plain search: a known concept name reads its page directly; a term or synonym matches the title and alias lines; blast radius matches a concept name in the neighbor list of every page; and unknown phrasing falls back to full-text search. Each page names its neighbors as a flat list mirrored by a prose Integration Points section. This section is the readable substitute for an adjacency edge. Neighbor links are non-transitive. An agent loads directly relevant pages and surfaces their neighbors as candidates, capped at a handful per task, but never follows them transitively. The neighbor list duplicates the Integration Points prose. It is removable without loss of information. If the neighbor list ever drifts toward feeling like a maintained graph, blast radius can be answered by full-text search alone at a small recall cost. The neighbor list is bounded by the length of each entry, not by the page's word cap. A new edge never competes with the page's own content, and every real interaction can be recorded as an edge. A derived orientation atlas exists for humans who cannot yet name a search term. No tool retrieves through it.

## Key Invariants

1. Retrieval is search, list, and read only. There is no graph engine, embeddings, or community detection.
2. Blast radius is string matching over a concept's neighbor list, not topological traversal.
3. Neighbor links are non-transitive and capped at a handful of pages per task.
4. The neighbor list duplicates the Integration Points prose and is removable without information loss.
5. The atlas is a human orientation surface only; no tool retrieves through it.
6. A real interaction is always declarable as an edge. Blast-radius completeness is never traded for page space.

## Integration Points

- [concept-store](concept-store.md) — the store whose pages this retrieval model reads.
- [code-anchors](code-anchors.md) — derived path sidecars that extend retrieval toward the source for contributor ramp-up.
- [drift-advisory](drift-advisory.md) — reopens community detection, but only offline and advisory, never as retrieval state, so this discipline holds.
- [concept-page-capacity](concept-page-capacity.md) — bounds the neighbour list per entry, keeping blast-radius edges affordable.
- [fix-razor](fix-razor.md) — this reading model is why a false invariant is worse than a missing one, and why the bound exists.

## Decision Log

### 2026-06-09 — bootstrap — 0001: knowledge stays grep-native, no topology

Informing planning and design needs readable, retrievable, distilled pages, not a code graph. Community detection, graph topology, and embedding retrieval were burned in prior generations and are not reopened without a genuinely structural need. The considered alternative — a precomputed concept graph with adjacency and community identifiers — was rejected: its unstable-community-identity problem was never solved across three prior design generations, and plain search over readable pages meets the actual retrieval need at a fraction of the machinery.

### 2026-07-04 — manual — An atlas without touching retrieval

Ramp-up is precisely the case where the reader cannot name what to search, so a derived orientation atlas fills that one gap while machine retrieval stays search, list, and read. Refuted alternative: letting tooling consult the atlas as an index — it duplicates what listing already gives a machine and reintroduces derived retrieval state.

### 2026-07-20 — #94 — Reciprocal link from drift-advisory

Mechanical reciprocity fan-out: the drift advisory reopens community detection — burned in three prior generations and barred from retrieval here — but confines it to offline, human-reviewed proposals of missing domains, never persisted as page metadata or read as an index, so this page's no-community-detection retrieval rule stays intact.

### 2026-08-04 — #220 — Blast radius stopped degrading silently

The neighbour list had been competing with a page's own words under one shared cap, and because reciprocity makes every edge cost prose on the neighbour too, the honest move on a full page was to drop the edge and describe the relationship in prose instead — which fails nothing, but makes blast radius quietly less complete, and does so first on the hub concepts new work most needs to attach to. Bounding the neighbour list per entry removes that trade entirely: a real interaction is now always recordable as an edge, and one too large to state in a single bounded bullet is treated as two interactions rather than dropped. Refuted alternative: accept the incompleteness and answer blast radius by full-text search alone, which this model already holds is possible at a small recall cost — but the recall loss lands exactly on the highest-degree concepts, where blast radius matters most.

### 2026-09-05 — #263 — Reciprocal link from fix-razor

This reading model turned out to be the argument for a bound elsewhere. Because a reader loads a page's summary and invariants and may never reach its log, a page whose body asserts superseded behaviour misleads even when the correction sits in the history below. That is why a change permitted only to append may not touch what the page asserts.
