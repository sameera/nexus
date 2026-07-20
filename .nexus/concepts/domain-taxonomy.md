---
title: "Domain Taxonomy"
aliases: ["domain registry", "concept domains", "curated atlas grouping", "domain filing"]
touches: ["concept-store", "taxonomy-filing-gate"]
last_updated_by: "#94"
status: active
verification: verified
---

# Domain Taxonomy

Domain taxonomy is a curated, two-level grouping for concept pages — domains and optional
subdomains — authored in a registry that lives beside the atlas. Every page files under one
domain or subdomain, and the atlas renders that structure directly instead of grouping pages by
link density.

## How It Works

A registry defines domains and, optionally, one level of subdomains under each; every entry
carries a title, a slug, and a short filing rubric describing what belongs there. A concept page
declares which node it belongs to; that declaration must resolve to a defined path, and filing at
a parent domain stays legal even after that domain grows subdomains, so a domain can be refined
incrementally rather than forcing every existing page to move at once. When a registry exists, the
atlas renders one heading per domain and sub-heading per subdomain, in registry order, each active
page listed once under its declared node; a page whose node no longer resolves is still listed,
under a separate heading, never silently dropped. A store with no registry is unaffected: grouping
falls back to the prior link-density clustering.

## Key Invariants

1. Nesting caps at two levels: a domain and, optionally, its subdomains; deeper nesting is
   rejected.
2. An entry's identity is its full path; the same short name may recur under different parents,
   but a full path may not repeat.
3. A page may file at a parent domain even after that domain gains subdomains; refining a domain
   is incremental, not a store-wide re-file.
4. Filing is validated: a page's declared node must resolve to a defined domain or subdomain, or
   filing is rejected outright.
5. Every rule here activates only when a registry exists; a store without one behaves exactly as
   it did before this taxonomy existed.
6. Re-filing a page — changing only its declared node — is orientation metadata, not knowledge,
   and does not require a new decision-history entry.
7. The atlas never silently drops a page: one whose declared node doesn't resolve is still listed,
   separately, so a misfile stays visible; rejecting the misfile itself is a validation concern,
   not the atlas's.

## Integration Points

- [concept-store](concept-store.md) — the store's derived atlas renders under this taxonomy
  instead of link-density clusters, whenever a registry exists.
- [taxonomy-filing-gate](taxonomy-filing-gate.md) — the drain files new pages against this
  registry's rubrics and grows its vocabulary through the gate.

## Decision Log

### 2026-07-19 — #89 — Curated taxonomy replaces derived link-density grouping

On a mature store the prior grouping — clustering pages by how densely they link to each
other — collapsed to a single heading once the link graph became one dense component, naming it
after whichever page had the most links; the heading looked like a category but was really an
accident of connectivity, and stopped orienting readers exactly when a growing store needed it
most. A human-authored registry replaces that with categories someone actually chose, capped at
two levels since a domain and its subdomains are enough to orient a reader without reintroducing
the ambiguity a curated taxonomy exists to remove. Filing at a parent domain stays legal even once
that domain grows subdomains, so a domain can be refined by adding a child and moving only the
pages that fit, rather than forcing a store-wide re-file every time a subdomain appears; every new
rule activates only when a registry exists, so a store that hasn't authored one is completely
unaffected. Refuted alternative: tune the prior clustering algorithm (e.g. a stricter connectivity
threshold) to resist collapsing — this treats the symptom, not the cause, since any link-derived
grouping degrades as a store's link density grows, and it still gives no author control over
category names or order.

### 2026-07-20 — #94 — Reciprocal link from taxonomy-filing-gate

Mechanical reciprocity fan-out: the taxonomy filing gate names this registry as the closed list
of rubrics the drain files new concepts against, and as the vocabulary an approved gate decision
grows — one domain or subdomain at a time, on the same distillation-PR as the page that motivated
it.
