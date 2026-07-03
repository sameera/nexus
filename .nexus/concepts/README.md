# Nexus concept store (machine-consumable)

The **machine knowledge surface** for Nexus — distilled, retrievable concept pages (one
concept per file) that inform PM spec generation, architectural design, and contributor
ramp-up. Schema and emission contract: `libs/origin/v2/.nexus/decisions/0003-concept-schema.md`.

## Rules

- **Consumer is the machine, not the human.** Volume is legitimate here. Human-facing,
  judgment-forcing artifacts belong in `docs/`, never here. Never mix the two.
- **Grep-native, no topology.** Pages are readable markdown keyed by concept slug. No graph
  engine, no embeddings. Retrieval is search / list / read.
- **Git-tracked, not derived.** These pages hold distilled *judgment* (the "why") that cannot
  be regenerated from code — so they are versioned and reviewed like source. Only the
  `.nexus/anchors/` sidecars (not yet generated) are derived state.
- **The distiller is the single producer.** Pages are written and updated only via a reviewed
  distillation-PR (`/nxs.distill`); do not hand-author or hand-edit except for deliberate manual
  curation (`last_updated_by: "manual"`).

## Retrieval

| Need | Query |
|---|---|
| Known concept → page | `read .nexus/concepts/<slug>.md` |
| Term / synonym → concept | `rg -i '^(title\|aliases):.*<term>' .nexus/concepts/*.md` |
| Blast radius (what touches X) | `rg 'touches:.*\b<X>\b' .nexus/concepts/*.md` |
| Cross-cutting / unknown phrasing | `rg -i '<phrase>' .nexus/concepts/` |

## Validate

`pnpm nexus:validate-concepts` — frontmatter completeness, 400-word body cap,
`touches:` == Integration Points, append-only Decision Log, and the §8.3 rejections
(no code, paths, or type/function names on a page).

## Provenance note

This store was **bootstrapped** (2026-07-03) by distilling the Nexus design decisions
`0001`–`0011` in `libs/origin/v2/.nexus/decisions/`. All 14 seed pages carry
`last_updated_by: "bootstrap"` and `verification: unverified` — low-trust until the first
real drain that touches each page re-validates it against shipped code.
