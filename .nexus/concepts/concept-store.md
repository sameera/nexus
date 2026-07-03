---
title: "Concept Store"
aliases: ["machine knowledge store", "concept pages", "concept page schema", "knowledge base"]
touches: ["two-store-split", "gold-plating", "grep-native-retrieval", "append-only-decision-log", "provenance-reference", "distiller", "code-anchors"]
last_updated_by: "bootstrap"
status: active
verification: unverified
---

# Concept Store

The concept store is Nexus's machine knowledge surface: one distilled concept per file, keyed by a readable slug, holding current behavior, hard invariants, blast radius, and the durable why. The frontmatter is the search surface; the body loads only after a search hit judges the page relevant.

## How It Works

Each page leads with a stand-alone summary, describes current behavior in domain terms, lists the constraints a new design must preserve, names its neighbors, and carries an append-only decision history. The body is capped so loading several pages stays cheap; an over-cap page is split, never grown. Deprecated concepts move to an archive so active search stays signal-dense. There is no generated index — listing and reading the pages serves every lookup an index would, without a per-write conflict magnet. One slug maps to exactly one active page, enforced when a page is written, because the slug is the page's only key and a collision would silently merge two histories.

## Key Invariants

1. One concept per file; the slug is the filename and the page's only key — no separate identifier field.
2. The body is capped; an over-cap page is split into two, never grown.
3. One slug maps to exactly one active page, enforced at write time.
4. There is no generated index; listing and reading pages serves discovery.
5. Deprecated concepts move to the archive so active search stays signal-dense.
6. Pages carry behavior in domain terms only — no code, file paths, type names, or speculative claims.

## Integration Points

- [two-store-split](two-store-split.md) — the store is the machine half of the split, where volume is legitimate.
- [gold-plating](gold-plating.md) — the disease that reappears here as distiller bloat or an unbounded queue.
- [grep-native-retrieval](grep-native-retrieval.md) — the retrieval model that reads these pages.
- [append-only-decision-log](append-only-decision-log.md) — the immutable why-history each page carries.
- [provenance-reference](provenance-reference.md) — the reference form linking a page back to its originating issue.
- [distiller](distiller.md) — the single producer that writes and updates pages.
- [code-anchors](code-anchors.md) — the derived path sidecar generated alongside each page.

## Decision Log

### 2026-06-10 — bootstrap — 0003: page schema and no generated index

Fixed the schema — summary-first pages, a body cap with split-don't-grow, an archive for dead concepts, and slug-as-key with write-time uniqueness — and dropped the generated contents index. The considered alternative — a rebuilt index file listing every concept — was rejected: it is the one file every concurrent distillation rewrites, a guaranteed merge-conflict magnet on the highest-traffic artifact, and it duplicates what listing and reading the pages already provide.
