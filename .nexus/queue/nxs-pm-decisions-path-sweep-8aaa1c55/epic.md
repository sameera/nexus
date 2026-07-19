---
feature: "Multi-Repo Workspaces"
feature_path: docs/features/multi-repo-workspaces
epic: "nxs-pm Path References Follow the Docs Root"
slug: nxs-pm-decisions-path-sweep
created: 2026-07-19
type: enhancement
complexity: S
complexity_drivers: [single-file prose sweep across three references, fingerprint-pin re-vendor + parity]
concepts: [workspace-resolution, portable-tooling, append-only-decision-log]
link: "#87"
---

# Epic: nxs-pm Path References Follow the Docs Root

## Description

The `nxs-pm` agent resolves a docs root at runtime and already routes most of its document
surfaces through the `<docs-root>` placeholder — product context, the feature inventory, and
the feature-doc recommendation all read `<docs-root>/…`. A repo-wide sweep found three
operative references in this one agent still carrying a hardcoded `docs/` prefix: the
"check for prior decisions" step in the always-read list (line 47), the "check for project
templates" step in template handling (line 265), and the Decision-Record path in the
documentation recommendation (line 588).

In any workspace whose docs root is not `docs/` — a hub rooted at the repo root, or a
configured override — the agent looks for prior decisions and project templates in the wrong
place and recommends writing decision records to a path that does not track the root. Every
sibling surface already moved when the planning surfaces followed the docs root (#81); this
is the follow-on sweep that closes the last literal-`docs/` prefixes so these surfaces track
the resolved root like the rest.

The change is confined to the `nxs-pm` agent prompt. It aligns three references to the
placeholder the agent already resolves — no resolver code changes and no relocation of files
on disk. The resolver layer itself (`workspace-resolution`) was confirmed clean: its `docs`
literals are the single-repo fallback constant, not stray hardcoding.

Editing any `.claude` component changes the live tree the `portable-tooling` fingerprint pin
(`libs/portable-tools/bundle-fingerprint.json`) hashes, so the pin must be regenerated
(`pnpm nexus:vendor-tools`) or `parity.spec.ts` fails. `libs/origin/v1/.claude/` is a separate,
frozen historical snapshot (predates the Nx-monorepo refactor) — not the live vendoring target
— and is not touched by this epic.

## Success Metrics

- Zero literal `docs/decisions/` or `docs/templates/` prefixes remain in the `nxs-pm` agent
  source.
- `parity.spec.ts` passes with the fingerprint pin regenerated — no drift between the live
  `.claude/` component tree and the committed pin.
- In a single-repo checkout (docs root resolves to `docs`), the two surfaces still resolve to
  `docs/decisions/` and `docs/templates/` — no behavior change where the root is already `docs`.

## Personas

Per `docs/product/context.md`. No epic-specific personas or deviations — the actor is the
Nexus operator (lead / PM) running `nxs-pm` in a workspace whose docs root is not `docs/`.

## User Stories

### Story 1: Route the nxs-pm docs-path references through the resolved docs root

- **story_type:** system
- **size:** S

**As a** lead running the `nxs-pm` agent in a workspace whose docs root is not `docs/`,
**I want** the agent's three residual `docs/`-prefixed path references to resolve from my
docs root, **so that** it reads prior decisions and project templates from — and recommends
writing decision records to — the location that tracks my root instead of a fixed `docs/`.

#### Acceptance Criteria

- [ ] **Given** the `nxs-pm` agent source (`.claude/agents/nxs-pm.md`), **when** it is scanned
  for the literal path prefixes `docs/decisions/` and `docs/templates/`, **then** zero
  occurrences of either remain.
- [ ] **Given** the three operative references (the always-read "prior decisions" check, the
  "project templates" check in template handling, and the Decision-Record path in the
  documentation recommendation), **when** the agent is read, **then** they use the
  `<docs-root>/decisions/` and `<docs-root>/templates/` forms, consistent with the sibling
  `<docs-root>/product/context.md`, `<docs-root>/features/README.md`, and
  `<docs-root>/features/[name].md` references.
- [ ] **Given** the agent's standalone default (no docs root named → `<docs-root>` defaults to
  `docs`), **when** the docs root resolves to `docs`, **then** the surfaces resolve to
  `docs/decisions/` and `docs/templates/` — no behavior change in single-repo checkouts.
- [ ] **Given** the source edit, **when** `pnpm nexus:vendor-tools` is run to regenerate the
  fingerprint pin and `parity.spec.ts` executes, **then** the check passes — no drift between
  the live `.claude/` component tree and the committed pin.

#### Notes

The `<docs-root>` placeholder is resolved by the agent at runtime; this story only aligns the
three lagging references to that existing mechanism — no resolver logic is added. Editing any
`.claude` component stales the fingerprint pin, so the re-vendor + parity AC is a required,
easily-forgotten step (a standing project gotcha), captured here as done-work rather than a
separate layer-split story. `libs/origin/v1/.claude/` is a frozen historical snapshot, not the
live vendoring target, and is not touched by this change.

The `docs/templates/` lookup is a soft, optional step — the agent falls back to industry-standard
formats when no template exists — and `docs/templates/` is not currently populated in this repo
(project pipeline templates live under `.nexus/config/templates/`). This story only corrects the
path *prefix* so the reference tracks the resolved root; verifying, populating, or redesigning that
lookup is out of scope.

## Assumptions

- `decisions/` and `templates/` are docs-root-relative surfaces like the taxonomy surfaces moved
  in #81; they hang off the resolved root (the empty-prefix rule applies on a repo-root hub, giving
  `decisions/` / `templates/` there and `docs/decisions/` / `docs/templates/` in a single-repo
  checkout).
- The repo-wide sweep at planning time found only the `nxs-pm` agent carrying operative `docs/`
  path literals that should track the root (three references, plus their vendored mirror). All other
  `docs/` occurrences in the `.claude` surfaces are single-repo *examples* explicitly contrasted with
  the hub form, or "never fall back to a literal `docs/`" guidance — correct as-is. The resolver
  scripts' `docs` literals are the single-repo fallback constant.

## Out of Scope

- Any `docs/decisions/` or `docs/templates/` literals outside the `nxs-pm` agent (none found at
  planning time).
- Verifying, populating, or redesigning the `docs/templates/` deliverable-template lookup (only its
  path prefix is corrected).
- The `nxs.distill` operator pointer to `docs/features/multi-repo-workspaces/hub-tooling-install.md`
  — a reference to Nexus's own product documentation, not a user-workspace surface, so it must not be
  re-rooted.
- Migrating, relocating, or renaming any decision-record or template files on disk.
- Changes to the docs-root resolver itself (`workspace-resolution`) or its fallback constants.

## Open Questions

<!-- none -->

## Implementation Sequence

| STORY | Issue | blocked_by |
|---|---|---|
| STORY-87.01 | #88 | none |
