---
title: "Decision Record: Application Shell Layout"
epic: #3
feature: "Application Shell"
rating: M
concepts: []
date: 2026-06-30
---

# Decision Record: Application Shell Layout

## Summary

This epic builds the static Nexus Prime application shell — a full-height flex column (persistent
top strip over a dominant terminal region) plus three ephemeral overlay surfaces (gate tray, advance
bar, peek drawer) — as a presentational layer wired to mock UI state, with the wterm terminal
interior stubbed as a labelled placeholder. Both dark and light themes ship as **one semantic-token
vocabulary backed by two value sets, applied at the shell root**, so no region branches on theme; the
epic also establishes the **logical-region folder convention** as the codebase's first structural
standard.

## Chosen Approach

Port the mockup to Tailwind 3 as a semantic token layer: define the two mockups' color/radius/font
values as CSS custom properties under a root mode selector (a `data-theme` / class on the shell root
element), and map Tailwind's color theme onto those variables so every utility resolves to the active
mode automatically. Regions are grouped by logical role (`layout/`, `header/`, `terminal/`, `gate/`,
`drawer/`, `advance/`) under the app feature tree, each consuming only semantic tokens. The
recede/dim coordination between gate tray and drawer is held in a **single shared overlay state** at
the shell layout level, not duplicated per region. Mock stage/gate/drawer state is a small local
fixture set that lets every region demonstrate its visual variants (stage statuses, judgment vs.
validation gate, advance shown/hidden) without a pipeline.

## Key Decisions

### Dual themes as CSS-variable-backed semantic tokens applied at the shell root

- **Decision:** Map a semantic palette (surface, terminal-surface, chrome, ink tiers, accent, state
  colors, gate) to CSS custom properties whose values are redefined under a root mode selector;
  Tailwind colors reference the variables. Switching mode is a single attribute flip on the root, and
  a region written once renders correctly in both modes with zero per-region branching — directly
  satisfying Stories 1 and 8.
- **Why:** It is the only model that makes the "no region hardcodes a hex / single source of truth"
  invariant enforceable, because each themed property resolves one token rather than carrying its two
  values inline.
- **Refuted alternative:** Tailwind's built-in `dark:` variant — idiomatic and already in the stack, so
  a competent engineer would reach for it. It loses because it forces every themed property to carry a
  paired `dark:` utility at every call site (the exact per-region theme branching the epic forbids) and
  inverts the model so Tailwind owns the two values inline, making the single-source-of-truth invariant
  unenforceable.

### The two mockups diverge well beyond `:root`; the token set must absorb every out-of-`:root` color

- **Decision:** Treat the dual token set as covering **all** cross-mode color divergences, not only the
  `:root` variables. A direct dark/light diff of the two mockups shows ~two dozen color values
  hardcoded *outside* `:root` that differ between modes — surface tints (`#131318`→`#fbf7ef`), gate-tray
  and validation gradient opacities (`.05`→`.12`, `.06`→`.08`), badge alpha tints (`.16`→`.14`),
  passed/failed violation-row fills, fix-link borders, scrollbar thumb, hover backgrounds, and every
  text-on-accent / text-on-state-glyph ink (`#1a1a1a` / `#0e0e11`→`#fff`). These become new semantic
  tokens (gate surface, validation surface, on-accent ink, badge tint, recede targets) defined in both
  value sets. This is a **scope correction to Story 1**, not new work: Story 1's token-extraction AC
  already owns "colors hardcoded outside `:root`," but its note calls it "a handful" — the true count is
  ~24, and several are two-value (mode-dependent), not single-mode hardcodes. Story 1's scope must be
  read as: enumerate and tokenize *all* cross-mode color divergences from a side-by-side diff.
- **Why:** The epic's stated assumption that the mockups "differ only in their `:root` token values" is
  materially inaccurate. Trusting it and swapping only `:root` would ship a broken light mode across the
  gate tray, drawer, badges, glyphs, and buttons. This decision is what makes the "no per-region theme
  branching" and "single token source of truth" invariants actually achievable.

### Recede/dim is a single shared overlay state owned by the shell, with mutual-guard dismissal

- **Decision:** Model the terminal recede/dim as one shared overlay state at the layout level (which
  surfaces are open → terminal recedes), mirroring the mockup's single `recede` class on the terminal
  wrapper. Closing one surface while the other remains open keeps the terminal dimmed. This satisfies
  the final AC of both Story 5 and Story 6 ("returns to full fidelity *unless* the other is still
  open").
- **Why:** Centralizing the open-surface state is the simplest model that expresses the cross-surface
  "unless the other is open" rule correctly.
- **Refuted alternative:** Per-region recede, where each surface tracks its own dim — superficially
  simpler and keeps regions self-contained, but it cannot express the "unless the other is open" rule
  without regions reaching into each other, reintroducing the coupling as hidden, order-dependent logic.

### Mock UI state is a fixture-driven local model exercising every visual variant, no scene-switcher

- **Decision:** Drive stage statuses (done/active/gate/upcoming), gate variant (judgment vs.
  validation), drawer artifact content, and advance shown/hidden from local state seeded by static
  fixtures lifted from the mockup's sample data, so Stories 3, 5, 6, and 7 each demonstrate their full
  visual range. The mockup's `.scenes` switcher and `.caption` bar — the mechanism that drove those
  states in the prototype — are excluded; the product needs only a minimal state surface (default
  fixtures plus whatever lets regions render their non-default variants), not a user-facing scene
  control.
- **Why:** It lets every region prove its visual states behind a placeholder without a real pipeline,
  which is the epic's de-risking goal, while honoring the explicit exclusion of mockup-only chrome.

### Theme persistence via localStorage; first-load default follows OS preference, falling back to dark

- **Decision:** On first load with no prior choice, follow the OS `prefers-color-scheme`, defaulting to
  dark when the OS expresses no preference. Persist the user's explicit choice in `localStorage`, read
  on mount, which overrides the OS default once a choice exists. (Resolves Story 8's two HLD-deferred
  questions.)
- **Why:** Following the OS serves Story 8's "match my environment" job better than a fixed default and
  costs nothing given the runtime switch already exists; the dark mockup remains the effective default
  for the common dark-OS developer. `localStorage` is the boring-correct fit for a client-only local
  tool with no backend and satisfies the "restore previously chosen mode" AC.

## Constraints & Invariants

1. Exactly one token source of truth: no region may emit a literal color value that the theme defines —
   all color, radius, and font choices resolve through semantic tokens.
2. Theme mode is applied only at the shell root; every region resolves the active mode through token
   inheritance with no per-region theme conditional anywhere in region code.
3. Both value sets must cover every cross-mode color divergence found in the two mockups, including the
   ~two dozen values hardcoded outside `:root` and the text-on-accent / on-glyph inks that flip between
   modes.
4. The terminal region is the flex-filling dominant region, occupying all vertical space below the
   fixed-height top strip.
5. The terminal interior is a labelled placeholder only — no terminal emulation, no wterm wiring —
   preserving the integration seam for the downstream epic.
6. Terminal recede/dim is derived solely from shared open-surface state; the terminal returns to full
   fidelity only when no overlay surface (gate tray or drawer) remains open.
7. The mockup's `.caption` bar and `.scenes` scene-switcher are excluded from the product shell; no
   equivalent user-facing scene control ships.
8. After a theme switch, all regions — top strip, terminal placeholder, both gate variants, drawer,
   advance bar — render in the new mode with none left in the prior mode.
9. The rail and advance bar are passive read-outs of mock state: rail segments preview artifacts and
   never navigate the pipeline, and advance triggers are presentational hand-offs with no real command
   execution.

## Risks (BLOCKER / ADDRESS only)

- **ADDRESS — Light mode breaks if the "`:root`-only" assumption is trusted:** The mockups diverge in
  ~24 out-of-`:root` color values (see Key Decision 2). Mitigation: treat Story 1's token extraction as
  covering all cross-mode divergences enumerated from a direct dark/light diff, not only `:root`, and
  gate Story 8's acceptance on a side-by-side of every region against the light mockup. The hidden
  divergences concentrate in the gate tray, validation gate, drawer, badges, and glyphs — review those
  in light mode specifically.

## Open Clarifications

None — both Story 8 clarifications (first-load default, persistence mechanism) resolved at the planning
gate and folded into Key Decisions.
