---
title: "Grep-Native Retrieval"
aliases: ["no-topology retrieval", "grep-native knowledge", "blast radius by grep", "neighbor list"]
touches: ["concept-store", "code-anchors", "drift-advisory"]
last_updated_by: "#94"
status: active
verification: verified
---

# Grep-Native Retrieval

The knowledge store is retrieved by plain text search over readable files — search, list, and read — with no graph engine, embeddings, or community detection. Blast radius, meaning what a change ripples into, is answered by matching a concept name across pages, not by traversing a computed topology.

## How It Works

Retrieval has four paths, all plain search: a known concept name reads its page directly; a term or synonym matches the title and alias lines; blast radius matches a concept name in the neighbor list of every page; and unknown phrasing falls back to full-text search. Each page names its neighbors as a flat list mirrored by a prose Integration Points section — the readable substitute for an adjacency edge. Neighbor links are non-transitive: an agent loads directly relevant pages and surfaces their neighbors as candidates, capped at a handful per task, but never follows them transitively. The neighbor list is a denormalized convenience over the Integration Points prose and is removable without loss — if it ever drifts toward feeling like a maintained graph, blast radius can be answered by full-text search alone, at a small recall cost. A derived orientation atlas exists solely for the human who cannot yet name a grep target; no tool retrieves through it.

## Key Invariants

1. Retrieval is search, list, and read only — no graph engine, embeddings, or community detection.
2. Blast radius is string matching over a concept's neighbor list, not topological traversal.
3. Neighbor links are non-transitive and capped at a handful of pages per task.
4. The neighbor list duplicates the Integration Points prose and is removable without information loss.
5. The atlas is a human orientation surface only; no tool retrieves through it.

## Integration Points

- [concept-store](concept-store.md) — the store whose pages this retrieval model reads.
- [code-anchors](code-anchors.md) — derived path sidecars that extend retrieval toward the source for contributor ramp-up.
- [drift-advisory](drift-advisory.md) — reopens community detection, but only offline and advisory, never as retrieval state, so this discipline holds.

## Decision Log

### 2026-06-09 — bootstrap — 0001: knowledge stays grep-native, no topology

Informing planning and design needs readable, retrievable, distilled pages, not a code graph. Community detection, graph topology, and embedding retrieval were burned in prior generations and are not reopened without a genuinely structural need. The considered alternative — a precomputed concept graph with adjacency and community identifiers — was rejected: its unstable-community-identity problem was never solved across three prior design generations, and plain search over readable pages meets the actual retrieval need at a fraction of the machinery.

### 2026-07-04 — manual — An atlas without touching retrieval

Ramp-up is precisely the case where the reader cannot name what to search, so a derived orientation atlas fills that one gap while machine retrieval stays search, list, and read. Refuted alternative: letting tooling consult the atlas as an index — it duplicates what listing already gives a machine and reintroduces derived retrieval state.

### 2026-07-20 — #94 — Reciprocal link from drift-advisory

Mechanical reciprocity fan-out: the drift advisory reopens community detection — burned in three prior generations and barred from retrieval here — but confines it to offline, human-reviewed proposals of missing domains, never persisted as page metadata or read as an index, so this page's no-community-detection retrieval rule stays intact.
