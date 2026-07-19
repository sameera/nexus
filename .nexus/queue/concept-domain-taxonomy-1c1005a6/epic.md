---
feature: "Concept Domain Taxonomy"
feature_path: docs/features/concept-domains
epic: "Domain Taxonomy for the Concept Store"
slug: concept-domain-taxonomy
created: 2026-07-19
type: enhancement
complexity: M
complexity_drivers:
  [
    "a new registry grammar becomes a validator surface consumed by both the validator and the atlas generator",
    "atlas rendering swaps derived clustering for curated grouping, with activation-on-presence backward compatibility",
    "filing rules (parent filing, the Decision Log exemption) interact with existing drain-time validation",
  ]
concepts: ["concept-store", "portable-tooling"]
link:
---

# Epic: Domain Taxonomy for the Concept Store

## Description

The concept atlas exists to orient a reader in the store, but its headings are derived: the
generator clusters pages by connected components of the `touches` graph and names each cluster
after its highest-degree member. On a mature store the graph becomes one dense component and the
atlas collapses to a single heading named after whichever page happens to have the most links —
the gic-docs store renders all 51 concepts under "Mapper" today. The heading reads as a category
but is an accident of link density, and the atlas stops orienting exactly when the store grows
large enough to need it.

This epic replaces derived grouping with a curated taxonomy. A registry file (`domains.md`)
lives beside the atlas and defines up to two levels — domains and optional subdomains — each
entry carrying a display title, a stable slug, and a short filing rubric stating what belongs
there. Every concept page files under exactly one node via a `domain:` frontmatter path. Filing
at a parent stays legal even when subdomains exist, so refining a domain later is incremental
(create the child, move the pages that fit) rather than a store-wide re-file. The atlas becomes
a pure projection of the registry: domain headings and subdomain subheadings in registry order,
every active page listed exactly once.

The registry is authored state — human- and machine-edited, always through reviewed PRs — while
the atlas stays derived and CI-checked. Stores without a registry are untouched: every new rule
activates only when `domains.md` is present, so existing consumers stay green until they adopt.
Keeping the taxonomy true over time (drain-side filing, the new-domain gate, drift advisories,
and seeding an existing store) is the follow-on epic in this feature.

## Success Metrics

- On a store with a seeded registry, the generated atlas lists every active concept exactly once
  under its filed heading, and a densely linked store no longer collapses to a single heading.
- The validator rejects 100% of fixture violations — unresolvable `domain:` path, third nesting
  level, duplicate slug path, node missing its slug or rubric — and raises zero domain findings
  on a store that has no registry.
- Atlas generation stays deterministic: consecutive runs over an unchanged store are
  byte-identical and `--check` parity is preserved.

## Personas

Per `docs/product/context.md`. No epic-specific personas.

## User Stories

### Story 1: A domain registry defines the taxonomy

- **story_type:** system
- **size:** M

**As a** store maintainer, **I want** a `domains.md` registry with a fixed, machine-parseable
grammar, **so that** the taxonomy has one authored source of truth that humans can edit and
tools can trust.

#### Acceptance Criteria

- [ ] **Given** a well-formed registry (domains with optional subdomains, each entry carrying a
      display title, slug, and filing rubric), **when** it is parsed, **then** the parser
      returns the ordered tree — title, slug path, and rubric for every entry, in registry
      order.
- [ ] **Given** a registry that nests a third level, **when** the store is validated, **then**
      validation fails with a finding naming the offending entry (two levels is a hard cap).
- [ ] **Given** a registry with a duplicate slug path, or an entry missing its slug or rubric,
      **when** the store is validated, **then** validation fails with a finding naming the
      entry.
- [ ] **Given** the fixture suite (one well-formed registry, one fixture per malformation),
      **when** the validator runs, **then** it exits zero on the well-formed fixture and
      non-zero on every malformed one.

#### Notes

Grammar sketch: H2 per domain, H3 per subdomain, each followed by a slug line and a one-paragraph
filing rubric. Slug paths are slash-form (`connectors`, `connectors/catalog`); the full path is
an entry's identity, so leaf slugs may repeat under different parents but slug paths may not.
Registry order is display order. The rubric doubles as the filing criterion the drain-side
distiller will consume in the follow-on epic.

### Story 2: Concept pages file under a domain

- **story_type:** system
- **size:** S

**As a** store maintainer, **I want** every concept page to carry a validated `domain:` path,
**so that** filing is explicit, closed-vocabulary, and cannot silently dangle.

#### Acceptance Criteria

- [ ] **Given** a store with a registry, **when** a page's `domain:` resolves to a defined
      domain or subdomain path, **then** validation passes; **when** it names an undefined path
      or the field is absent, **then** validation fails with a finding naming the page.
- [ ] **Given** a domain that has subdomains, **when** a page files at the parent path, **then**
      validation passes (parent filing is allowed).
- [ ] **Given** a store with no registry, **when** the store is validated, **then** no domain
      findings are raised and every existing check behaves exactly as before the change.
- [ ] **Given** a change that edits only a page's `domain:` frontmatter, **when** drain-time
      validation applies the one-new-Decision-Log-entry rule, **then** no new log entry is
      required (re-filing is orientation metadata, not knowledge).

### Story 3: The atlas renders the domain hierarchy

- **story_type:** system
- **size:** M

**As a** store reader, **I want** the atlas grouped by the registry's domains and subdomains,
**so that** its headings are chosen categories rather than accidents of link density.

#### Acceptance Criteria

- [ ] **Given** a store with a registry and filed pages, **when** the atlas is generated,
      **then** it renders one H2 per domain and one H3 per subdomain in registry order, with
      every active concept listed exactly once under its filed node.
- [ ] **Given** a domain with both parent-filed pages and subdomains, **when** the atlas is
      generated, **then** parent-filed pages are listed directly under the H2, before the first
      H3.
- [ ] **Given** a subdomain, **when** its heading renders, **then** it shows the subdomain's own
      title (e.g. "Catalog" under "Connectors"), the parent heading supplying context.
- [ ] **Given** an unchanged store, **when** the atlas is generated twice, **then** the outputs
      are byte-identical and `--check` passes.
- [ ] **Given** a store without a registry, **when** the atlas is generated, **then** the output
      is byte-identical to the pre-change generator's output (fallback preserved).

## Assumptions

- The registry lives beside the atlas in the store repo and is co-authored: humans edit it
  freely via ordinary PRs; machine edits arrive only through the drain (follow-on epic). A hand
  edit that orphans pages is caught mechanically — the validator flags every page whose
  `domain:` no longer resolves.
- The vocabulary is closed at any instant; it grows at the drain gate (follow-on epic) or by
  hand-editing the registry. There is no open coining of domains by individual pages.
- `domain:` is a single path per page; multi-domain filing is out.

## Out of Scope

- Drain-side filing, the new-domain gate, the drift advisory, and seed tooling for existing
  stores — the follow-on epic in this feature.
- Migrating any existing store's pages (a consumer-side chore, aided by the follow-on seed
  mode).
- Nesting beyond two levels.

## Open Questions

<!-- none -->
