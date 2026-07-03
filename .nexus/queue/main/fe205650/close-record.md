---
title: "Close Record: Application Shell Layout"
epic: #3
feature: "Application Shell"
date: 2026-07-02
---

# Close Record: Application Shell Layout

## Key Decisions

- **Story 7's stage-advance state was folded into the single shell-owned overlay state, not given
  its own provider.** The decision record centralized recede/dim as one shared overlay state for the
  gate tray and drawer; implementation extended that same shell-owned state to carry the mock advance
  state (`advanceReady`, `running`) as well, because the advance bar's shown/hidden rule *is* "no
  overlay surface is open" — deriving it from the same `receded` source keeps one coordination point
  for every cross-surface rule. **Refuted viable alternative:** a separate advance context/provider,
  which keeps Story 7 self-contained but re-derives "is any surface open" independently, splitting the
  mutual-guard rule the record deliberately gave one home.

- **Both the theme and overlay contexts ship non-throwing inert defaults instead of a "must be inside
  a provider" guard.** Each region has its own `*.spec.tsx` that renders the region directly; an inert
  default (dark theme, no surface open, no-op triggers) lets a region mount and be tested in isolation
  without wrapping it in a provider. A throwing default would force every region test to wrap — the
  region-per-folder convention makes isolated rendering the common case, so the inert default is the
  boring-correct fit.

## Deviation Rationale

No deviations. The branch diff matches the decision record: dual themes as CSS-variable-backed
semantic tokens applied once at the shell root (`data-theme`), the ~two-dozen out-of-`:root` color
divergences absorbed into both value sets, a single shared overlay state driving terminal recede, the
terminal interior stubbed as a labelled placeholder, theme persisted to `localStorage` over an
OS-preference default of dark, no scene-switcher, and the logical-region folder layout with zero
by-type folders. The rail retains the `tasks` segment per the mockup/AC — matched work, not a
deviation.

## Deferred Scope

None. The epic's out-of-scope items (wterm terminal interior, real pipeline/artifact integration,
real gate/stage execution, responsive layout) were pre-planned as separate downstream work, not
deferred during implementation. No new re-triage items appended to
`docs/features/application-shell/backlog.md`.

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-07-02-verify-mockup-assumptions-with-a-diff.md`
