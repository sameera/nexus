---
title: "Grep-Native Retrieval"
aliases: ["no-topology retrieval", "grep-native knowledge", "blast radius by grep", "neighbor list"]
touches: ["concept-store", "code-anchors"]
last_updated_by: "bootstrap"
status: active
verification: unverified
---

# Grep-Native Retrieval

The knowledge store is retrieved by plain text search over readable files — search, list, and read — with no graph engine, embeddings, or community detection. Blast radius, meaning what a change ripples into, is answered by matching a concept name across pages, not by traversing a computed topology.

## How It Works

Retrieval has four paths, all plain search: a known concept name reads its page directly; a term or synonym matches the title and alias lines; blast radius matches a concept name in the neighbor list of every page; and unknown phrasing falls back to full-text search. Each page names its neighbors as a flat list mirrored by a prose Integration Points section — the readable substitute for an adjacency edge. Neighbor links are non-transitive: an agent loads directly relevant pages and surfaces their neighbors as candidates, capped at a handful per task, but never follows them transitively. The neighbor list is a denormalized convenience over the Integration Points prose and is removable without loss — if it ever drifts toward feeling like a maintained graph, blast radius can be answered by full-text search alone, at a small recall cost.

## Key Invariants

1. Retrieval is search, list, and read only — no graph engine, embeddings, or community detection.
2. Blast radius is string matching over a concept's neighbor list, not topological traversal.
3. Neighbor links are non-transitive and capped at a handful of pages per task.
4. The neighbor list duplicates the Integration Points prose and is removable without information loss.

## Integration Points

- [concept-store](concept-store.md) — the store whose pages this retrieval model reads.
- [code-anchors](code-anchors.md) — derived path sidecars that extend retrieval toward the source for contributor ramp-up.

## Decision Log

### 2026-06-09 — bootstrap — 0001: knowledge stays grep-native, no topology

Informing planning and design needs readable, retrievable, distilled pages, not a code graph. Community detection, graph topology, and embedding retrieval were burned in prior generations and are not reopened without a genuinely structural need. The considered alternative — a precomputed concept graph with adjacency and community identifiers — was rejected: its unstable-community-identity problem was never solved across three prior design generations, and plain search over readable pages meets the actual retrieval need at a fraction of the machinery.
