---
title: "Registry Seeding"
aliases: ["seed mode", "registry seed", "draft registry", "store adoption seeding"]
touches: ["drift-advisory", "taxonomy-filing-gate"]
last_updated_by: "#94"
status: active
verification: verified
---

# Registry Seeding

Registry seeding is a one-time adoption tool for a store that has no domain registry yet. It reads the concept link graph, detects communities with the same deterministic engine the drift advisory uses, and drafts both a candidate two-level registry and a per-page filing-suggestion list — written as clearly-marked draft files that need human curation before they become the real registry. It modifies no concept page, no atlas, and never the registry itself.

## How It Works

Seeding runs the shared community-detection engine over the store's links: each qualifying community of at least three pages becomes a candidate domain, and where two communities are cross-linked about as densely as they are internally linked, they are grouped under one parent as subdomains — the draft's two levels. Because a registry-less store yields no meaningful names, every candidate domain and subdomain is named generically, each carries its detected member pages as evidence, and every filing rubric is left an explicit to-do, making the rename-and-describe-me intent unmistakable. The tool refuses to run if a registry already exists, so it can never clobber an authored one; adopting domains onto such a store is the drain's filing gate, not seeding. Both draft files are byte-identical on repeat runs and carry a banner marking them not-yet-valid until a human curates them.

## Key Invariants

1. Seeding reads a store with no registry and writes only its draft files — never a concept page, the registry, or the atlas.
2. It refuses to run when a registry already exists, so an authored registry is never overwritten.
3. Its drafts are explicitly marked as requiring human curation before commit.
4. Output is byte-identical on repeat runs over an unchanged store.
5. Candidate domains are named generically with member-page evidence and to-do rubrics, since a registry-less store yields no meaningful name.
6. Community detection here is offline draft material, never persisted as page metadata or a retrieval index.

## Integration Points

- [drift-advisory](drift-advisory.md) — shares this tool's one deterministic detection engine.
- [taxonomy-filing-gate](taxonomy-filing-gate.md) — maintains the registry that seeding bootstraps once a human curates the draft.

## Decision Log

### 2026-07-20 — #94 — Seed drafts marked files with generic names and to-do rubrics, and refuses when a registry exists

Seed mode writes a draft registry and a per-page suggestion list as clearly-marked draft files rather than to standard output, because a registry is a document a maintainer curates and eventually saves, not transient text; it names domains generically with member-page evidence and leaves every rubric a to-do, since a registry-less store offers no deterministic semantic name and a rubric is prose only a human can author. It refuses when a registry already exists, so it cannot clobber an authored one. Refuted alternative: derive a name from a representative member page — rejected as arbitrary, collision-prone, and falsely implying the tool named the domain meaningfully.
