---
title: "Taxonomy Drift Advisory"
aliases: ["drift advisory", "taxonomy drift", "misfile detection", "new-domain candidates"]
touches: ["distiller", "distillation-pr", "grep-native-retrieval", "taxonomy-filing-gate", "registry-seeding"]
last_updated_by: "#94"
status: active
verification: verified
---

# Taxonomy Drift Advisory

The drift advisory is a deterministic, non-blocking step of the drain that reads the concept link graph and each page's filing and reports taxonomy decay as text in the distillation-PR body. It flags pages whose links point mostly under another domain, hints where a parent-filed page drifts into one subdomain, proposes missing domains, and raises a store-wide staleness alarm when disagreement is widespread. It always exits cleanly and never edits a page or the registry.

## How It Works

Per-page signals are pure neighbor-counting over a page's own resolved links, stable under a single-edge change. A page is misfiled when at least two-thirds of its links, given at least three, land under one other domain; a link into a subdomain counts toward its parent. A parent-filed page with the same concentration into one subdomain earns a refinement hint. Missing-domain candidates are the one place community detection is used — a community of three or more pages with no majority domain — kept offline so its instability never churns a per-page warning. When disagreement reaches a fifth of the store, one staleness alarm replaces the per-page flags. Thresholds are exact integer comparisons and ties break by name, so repeat runs are byte-identical.

## Key Invariants

1. Advisory only: it always exits cleanly, never writes a page or the registry, and never gates.
2. Per-page signals derive only from a page's own resolved links; misfile is judged at domain granularity, refinement at subdomain granularity.
3. Drift confined to sibling subdomains under a page's own domain is a low-priority note, never a misfile.
4. Community detection is confined to proposing missing domains and never becomes page metadata or a retrieval index.
5. When store-wide disagreement crosses the threshold, one staleness alarm replaces every per-page flag; store-level candidates remain.
6. Thresholds are named integer constants compared exactly, never floating point.
7. It computes over the same post-synthesis store state the atlas is regenerated from, so the two always agree.

## Integration Points

- [distiller](distiller.md) — the drain that runs this among its deterministic steps, after synthesis.
- [distillation-pr](distillation-pr.md) — the reviewed write whose body carries the advisory's findings.
- [grep-native-retrieval](grep-native-retrieval.md) — the retrieval discipline this respects by keeping community detection offline and advisory, never retrieval state.
- [taxonomy-filing-gate](taxonomy-filing-gate.md) — the filing decisions this later audits for decay.
- [registry-seeding](registry-seeding.md) — shares this advisory's one deterministic detection engine.

## Decision Log

### 2026-07-20 — #94 — Neighbor-counting for per-page signals; community detection confined to proposing domains

Misfile, refinement, and staleness signals are computed by counting a page's resolved neighbors by domain — local and stable, so a single new link cannot flip a warning. Community detection, burned in three prior generations for unstable community identity, is reopened only to propose missing domains and to seed a registry, never as retrieval state and never driving a per-page flag; it uses a deterministic-by-construction agglomeration rather than a randomized library so repeat runs stay byte-identical. Refuted alternative: run community detection for the per-page misfile signal too, for one uniform mechanism — rejected on the exact failure prior generations hit, where a one-edge change flips a page's community and thus its warning, producing noise reviewers learn to ignore.
