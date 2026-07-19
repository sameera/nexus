---
title: "Close Record: Domain Taxonomy for the Concept Store"
epic: "#89"
feature: "Concept Domain Taxonomy"
date: 2026-07-19
analyze: ran 2026-07-19 @ 0c47776
range:
  - repo: github.com/sameera/nexus
    base: 3a89b86434c445d7979fe748650336321a5a6e57
    head: 0c477760e469bdbe24fe805fc1d7bbb7c4c2aa2a
---

# Close Record: Domain Taxonomy for the Concept Store

## Key Decisions

- **Subdomain slug lines carry only the leaf slug; the parser composes the full path from nesting:** an author writes a single backticked leaf slug per heading, and `parseDomainRegistry` builds a subdomain's full path as `<parent-leaf>/<own-leaf>`. This keeps an author from ever retyping the parent segment, avoids a "prefix must match parent" validation rule the acceptance criteria never required, and keeps the same leaf slug (e.g. `catalog`) natural to reuse under different parents. **Refuted alternative:** require the author to type the full slash-form path directly in the slug line — rejected because it duplicates the parent segment on every child and makes leaf reuse across parents awkward to author correctly.
- **The curated-atlas header is duplicated into `renderRegistryAtlas` rather than shared with the fallback renderer:** the decision record's Risk ADDRESS requires the no-registry fallback path to stay byte-for-byte untouched, so extracting a shared header helper — which would touch `renderAtlas` — was rejected in favor of a 9-line duplication local to the new function.
- **Pages whose `domain:` resolves to no registry node are listed under a trailing "## Unfiled" heading** rather than dropped, honoring Invariant 9 ("never silently dropped"). The validator, not the atlas, is the gate that rejects a genuine misfile; the atlas's job at drain time is to never lose a page even when its filing is wrong.
- **Within-node page order is slug-ascending**, matching the fallback renderer's own `Standalone` sort for consistency, and **registry-mode parity lives in an isolated `corpus/registry/` subtree** so activating registry mode for parity testing never disturbs any existing no-registry corpus run.

## Deviation Rationale

- **Invariant 12 (parity corpus should carry a well-formed registry plus one fixture per malformation) is only partially met:** the corpus gained a well-formed registry-mode case and a preserved no-registry byte-identity case, but the per-malformation fixtures live in `domain-registry.spec.ts` / `validate-concepts.spec.ts` as inline template strings, not in the shared parity corpus. Adding a malformed `domains.md` at the corpus docs root would have activated the registry pass for every existing corpus case and pulled in Story 2's per-page `domain:` requirement — both out of bounds for Story 1, which only needed to prove the parser and validator's structural rejection. Isolating registry-mode corpus cases in `corpus/registry/` (added with Story 3) keeps the new registry corpus from disturbing any existing no-registry parity run. Non-breaking placement choice, flagged by `/nxs.analyze` as a medium finding and accepted here rather than fixed, since the parser is a standalone, no-import module inlined identically into both bundles and its well-formed parse path is already parity-verified.

## Deferred Scope

Deferred items appended to: `docs/features/concept-domains/backlog.md`

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-07-19-isolate-gated-corpus-fixtures.md`
