---
feature: "Concept Domain Taxonomy"
feature_path: docs/features/concept-domains
epic: "Domain Filing and Drift Advisory in the Drain"
slug: domain-filing-drift
created: 2026-07-19
type: enhancement
complexity: M
complexity_drivers:
  [
    "a graded human decision (force / new subdomain / new domain) joins the existing drain checkpoint, with registry writes riding the same distillation-PR",
    "the drift advisory must stay deterministic, thresholded, and non-blocking across drains",
    "one deterministic clustering engine is shared by drift detection and store seeding",
  ]
concepts: ["distiller", "distillation-pr", "concept-store"]
link: "#94"
---

# Epic: Domain Filing and Drift Advisory in the Drain

## Description

The Domain Taxonomy epic gives the concept store a curated two-level taxonomy; this epic keeps
it true as the store grows. The drain becomes the taxonomy's steward: when a distillation
creates a new concept, the distiller files it under the best-fit domain using the registry's
filing rubrics, and when nothing fits it stops at the drain's existing checkpoint with a graded
decision — force into the named best-fit, refine an existing domain with a new subdomain, or
coin a new domain. An approved registry change rides the same distillation-PR as the
page that motivated it, so vocabulary growth is reviewed exactly where review already happens
and the store is never left referencing an undefined domain.

Filing decisions can still decay: links accumulate, a "forced" filing ages badly, a parent
domain quietly grows a coherent sub-area. A deterministic drift advisory therefore runs with the
drain's other deterministic steps and writes its findings into the distillation-PR body:
cross-domain misfiles (a page whose links overwhelmingly point under another domain's subtree),
refinement hints (parent-filed pages whose links concentrate in one subdomain), candidate new
domains (coherent link communities with no majority domain), and a staleness alarm when
disagreement is widespread. It is advisory only — thresholded so that silence is the normal
outcome, never a CI gate, and it never edits a page.

The same clustering engine that powers the advisory also powers adoption: a seed mode drafts a
registry and per-page filing suggestions for an existing store, turning the one-time migration
of a live store from a hand audit into a review task.

Terminology: the registry's first tier is a *domain*, its optional second tier a *subdomain*;
"parent" is relational — a domain with respect to its subdomains, "parent-filed" a page filed at
such a domain directly. The taxonomy *gate* is the decision that fires at the drain's existing
*checkpoint*.

## Success Metrics

- A drain in which every new concept fits an existing rubric completes with zero gate
  interruptions; a drain containing a concept that fits no rubric is gated 100% of the time —
  a new concept is never silently filed against the reviewer's judgment.
- On a store below every drift threshold, the advisory section is empty or omitted; repeat runs
  over an unchanged store produce byte-identical advisory output, and the advisory step exits
  zero regardless of findings.
- Seeding an existing store produces a reviewable draft registry and filing suggestions without
  modifying any concept page or the atlas.

## Personas

Per `docs/product/context.md`. No epic-specific personas.

## User Stories

### Story 1: The drain files new concepts under the taxonomy

- **story_type:** system
- **size:** M

**As a** store maintainer draining the queue, **I want** new concepts filed under a best-fit
domain — or gated when none fits — **so that** the taxonomy grows only through reviewed
decisions and never drifts open.

#### Acceptance Criteria

- [ ] **Given** a drain that creates a concept matching an existing filing rubric, **when** the
      delta is synthesized, **then** the page carries that domain and no gate fires.
- [ ] **Given** a new concept that fits no rubric, **when** the drain reaches its checkpoint,
      **then** a gate presents exactly three options — file under the named best-fit, create a
      new subdomain under an existing domain, or create a new domain — and the drain does not
      proceed until one is chosen.
- [ ] **Given** the reviewer approves a new domain or subdomain, **when** the distillation-PR is
      opened, **then** the registry entry and the page that motivated it are in the same PR and
      the store validator passes on that branch.
- [ ] **Given** an update delta against an existing page, **when** it is applied, **then** the
      page's `domain:` is unchanged.

#### Notes

The registry's rubrics are injected into synthesis as a closed list, the same pattern the drain
already uses for slug convergence. The graded options are deliberate: refining an existing
domain is a lighter decision than coining a top-level one, so the taxonomy grows by refinement
before it grows by proliferation.

### Story 2: A drift advisory surfaces taxonomy decay in the distillation-PR

- **story_type:** system
- **size:** M

**As a** distillation-PR reviewer, **I want** a deterministic, thresholded drift advisory in the
PR body, **so that** misfiles and missing domains surface where review already happens, without
ever blocking a drain.

#### Acceptance Criteria

- [ ] **Given** a page with at least 3 resolved links of which at least 2/3 land under one
      *other* domain's subtree (links into a subdomain count toward its domain), **when** the
      drain's deterministic steps run, **then** the PR body's advisory section flags a
      cross-domain misfile naming the page and both domains.
- [ ] **Given** a page whose link drift is only toward sibling subdomains under its own domain,
      **when** the advisory runs, **then** at most a low-priority note is emitted, not a misfile
      flag.
- [ ] **Given** a parent-filed page with at least 2/3 of its links into one subdomain, **when**
      the advisory runs, **then** a refinement hint names that subdomain.
- [ ] **Given** a detected link community of 3 or more pages with no majority domain among its
      members, **when** the advisory runs, **then** a new-domain candidate lists those pages.
- [ ] **Given** filed-vs-detected disagreement affecting at least 20% of the store's pages,
      **when** the advisory runs, **then** a single store-level staleness alarm is emitted
      recommending a deliberate re-filing pass, in place of page-by-page flags.
- [ ] **Given** a store with no signal above thresholds, **when** the advisory runs, **then**
      the section is empty or omitted.
- [ ] **Given** an unchanged store, **when** the advisory runs twice, **then** the output is
      byte-identical, and the step exits zero whether or not findings exist (advisory-only —
      never a CI gate, never an edit to any page).

#### Notes

Per-page signals (misfile, refinement, staleness) come from direct link affinity — local, stable
and self-explanatory. Community detection is used only to propose *missing* domains, where its
known instability under single-edge changes cannot churn per-page warnings. Thresholds (2/3
affinity, ≥3 links, ≥3 members, ~20% staleness alarm) are constants in the tool, tunable without
redesign.

### Story 3: Seed mode drafts a registry for an existing store

- **story_type:** system
- **size:** S

**As a** maintainer adopting domains on a live store, **I want** a seed mode that drafts a
registry and per-page filing suggestions from the existing link structure, **so that** adoption
is a review task rather than a hand audit of every page.

#### Acceptance Criteria

- [ ] **Given** a store with concept pages and no registry, **when** seed mode runs, **then** it
      emits a draft registry (detected link communities as candidate domains, with candidate
      parent groupings where cross-community link density rivals internal density) and a
      per-page suggested `domain:` list — without modifying any page, the registry location, or
      the atlas.
- [ ] **Given** an unchanged store, **when** seed mode runs twice, **then** the drafts are
      byte-identical.
- [ ] **Given** the emitted draft, **when** a reviewer reads it, **then** it is explicitly
      marked as a draft requiring human curation before commit.

## Assumptions

- The Domain Taxonomy epic ships first: the registry grammar, parser, `domain:` validation, and
  atlas rendering are the surfaces every story here consumes. The dependency is wired at the
  issue level when both epics are filed.
- The drain checkpoint and distillation-PR flow are the only places the machine writes the
  registry; hand edits remain a human PR concern covered by the validator.
- Drift runs only at drain time — the store is frozen between drains, so no scheduled or
  calendar-driven runs exist.

## Out of Scope

- Automatic re-filing of pages (the advisory proposes; a human disposes).
- Blocking CI on drift findings.
- Running the migration of any specific store (a consumer-side task that uses seed mode).

## Open Questions

<!-- none -->

## Implementation Sequence

| STORY | Issue | blocked_by |
|---|---|---|
| STORY-94.01 | #95 | none |
| STORY-94.02 | #96 | STORY-94.01 |
| STORY-94.03 | #97 | STORY-94.02 |
