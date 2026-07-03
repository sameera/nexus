---
feature: "Application Shell"
feature_path: docs/features/application-shell
epic: "Application Shell Layout"
slug: application-shell-layout
created: 2026-06-29
type: enhancement
status: draft
complexity: M
complexity_drivers: [six independent presentational regions, light/dark theming as a cross-cutting concern (dual token sets + runtime switch), new Tailwind theme from mockup tokens, fully-specified design (no design unknowns), no backend/data/integration]
concepts: []
link: "#3"
---

# Epic: Application Shell Layout

## Description

Build the static application layout for Nexus Prime as designed in
`docs/design/prime-ui-mockup.html` — the persistent frame and ephemeral surfaces that wrap the
Claude Code session. The shell is a single full-height column: a slim persistent top strip
(epic identity + pipeline stage rail + tools), a dominant terminal region that occupies the
majority of the surface, and the ephemeral interrupt surfaces that overlay it — the gate tray
that slides up from the terminal, the advance affordance, and the artifact peek drawer that
slides in from the right.

This epic delivers the **layout and its presentational regions only**. The terminal interior —
the wterm/Claude Code emulation — is explicitly **out of scope**; that region ships as a labelled
placeholder so the shell can be built, sized, and reviewed independently of the integration work.
Likewise, the regions are wired to local/mock UI state to demonstrate their visual states; they
are not connected to a real Nexus pipeline or Claude Code session (that integration is downstream).

The work also establishes the **source-folder convention** for the app: organize by logical
region (`layout/`, `header/`, `terminal/`, `gate/`, `drawer/`, `advance/`) rather than by file
type (no `components/`, `hooks/` buckets), and port the mockup's design tokens into the Tailwind
theme so every region draws from one source of truth.

The shell ships with **both a dark and a light theme** and a user-facing switch between them, per
`prime-ui-mockup.html` (dark) and `prime-ui-mockup-light.html` (light). The two mockups are
structurally identical; they differ only in their `:root` token values. The theme is therefore
built as two token sets behind a single runtime mode, so every region renders correctly in either
mode with no per-region theme branching.

## Business Value

- Establishes the visible-pipeline frame that is Prime's wedge over a raw Claude Code terminal —
  without it, none of the gate/rail/drawer judgment surfaces have a home.
- De-risks the wterm integration by letting the shell be built and reviewed behind a placeholder,
  so layout decisions are settled before the hard terminal-emulation work starts.
- Locks in the logical-grouping folder convention and shared theme early, while the codebase is
  still the Nx scaffold and the cost of setting the pattern is lowest.

## Success Metrics

- The shell renders all regions from `prime-ui-mockup.html` (top strip, terminal placeholder +
  input line, gate tray, advance affordance, peek drawer) with no region from the mockup omitted,
  excluding the caption/scene-switcher mockup chrome.
- The terminal region fills the remaining vertical space after the fixed top strip (the dominant
  region of the surface), matching the mockup's flex behavior.
- App source contains the logical-region folders and **zero** by-type folders (`components/`,
  `hooks/`) under the app feature tree.
- The shell renders correctly in both dark and light mode, and the user can switch between them at
  runtime — every region reflects the active mode with no hardcoded color escaping the theme.

## Personas

Per `docs/product/context.md`. No epic-specific personas or deviations.

## User Stories

### Story 1: Application shell, theme tokens, and folder structure

- **story_type:** system
- **size:** M

**As a** developer building Prime, **I want** the app shell scaffolded with a shared theme and a
logical-region folder layout, **so that** every region renders inside one consistent frame and the
codebase follows a single grouping convention from the start.

#### Acceptance Criteria

- [ ] **Given** the app loads, **when** the root renders, **then** it shows a full-height
  (`100vh`) flex column with a fixed-height top strip and a flex-filling region below, matching the
  `.app` / shell structure in the mockup.
- [ ] **Given** the design tokens from both mockups (color palette, radius, mono/sans fonts),
  **when** the Tailwind theme is configured, **then** **two token sets** (dark + light) are defined
  in the theme behind a single semantic token vocabulary, and regions consume the semantic tokens —
  no region hardcodes a hex value that the theme already defines.
- [ ] **Given** an active theme mode, **when** the mode is applied at the shell root, **then** every
  region resolves its semantic tokens to that mode's values with no per-region theme branching.
- [ ] **Given** the app source tree, **then** UI is organized into region folders
  (`layout/`, `header/`, `terminal/`, `gate/`, `drawer/`, `advance/`) and contains **no**
  by-type folder (`components/`, `hooks/`) — verifiable as a pass/fail check of the directory layout.
- [ ] **Given** the project, **when** `npx nx lint prime` and `npx nx typecheck prime` run, **then**
  both pass.

#### Notes

Both mockups' `:root` CSS variables (`--bg`, `--term-bg`, `--chrome`, `--accent`, `--gate`, the
state colors, `--mono`/`--sans`, `--radius`) are *a starting point* for the two theme token sets —
dark from `prime-ui-mockup.html`, light from `prime-ui-mockup-light.html` — but they are **not** the
whole story. The mockups do **not** differ only in `:root`: a direct dark/light diff reveals ~two
dozen color values hardcoded *outside* `:root` that differ between modes — surface tints
(`#131318`→`#fbf7ef`), gate-tray and validation gradient opacities (`.05`→`.12`, `.06`→`.08`), badge
alpha tints (`.16`→`.14`), passed/failed violation-row fills, fix-link borders, scrollbar thumb,
hover backgrounds, and every text-on-accent / on-state-glyph ink (`#1a1a1a` / `#0e0e11`→`#fff`).
Several of these are *mode-dependent value pairs*, not single-mode hardcodes — the harder case. This
story's token extraction therefore covers **all** cross-mode color divergences enumerated from a
side-by-side diff, lifted into both value sets as semantic tokens — not just the `:root` ones. This
story establishes the dual-mode mechanism; the user-facing switch is Story 8. The mockups' `.caption`
bar and `.scenes` scene-switcher are mockup-only meta and are excluded.

### Story 2: Top strip — epic identity and tools

- **story_type:** user
- **size:** S

**As a** Prime user, **I want** a persistent top strip showing which epic I'm in and a tools
control, **so that** I always know the active epic and can reach the artifact peek action.

#### Acceptance Criteria

- [ ] **Given** the top strip, **when** it renders, **then** it shows the epic identity cluster —
  a status dot, the epic name, a meta line (branch · short id), and an epic-switch control — on the
  left, matching the mockup's `.epic-id`.
- [ ] **Given** the top strip, **when** it renders, **then** it shows the tools cluster (the peek
  icon button) on the right.
- [ ] **Given** the epic-switch control, **when** the user hovers it, **then** it surfaces the
  affordance/tooltip indicating splitting an epic spawns concurrent pipelines (presentational only).

#### Notes

Identity values are mock/placeholder (e.g. `auth-refactor · main · a3f9`); no real epic data
binding in this epic. The peek button's behavior (opening the drawer) is delivered with Story 6;
the theme-toggle control that also lives in this tools cluster is delivered with Story 8.

### Story 3: Pipeline stage rail

- **story_type:** user
- **size:** M

**As a** Prime user, **I want** a passive segmented read-out of the pipeline stages, **so that** I
can see at a glance where the current run stands without it acting like a wizard.

#### Acceptance Criteria

- [ ] **Given** the rail, **when** it renders, **then** it shows the ordered stage segments
  (`setup › epic › hld › tasks › analyze › close`) with arrow separators, centered in the top strip.
- [ ] **Given** a stage's status, **when** a segment renders, **then** it reflects the correct visual
  state — `done`, `active`, `gate` (with the attention pulse), or `upcoming` — each with the matching
  glyph and color from the mockup.
- [ ] **Given** a `done` segment, **when** the user hovers/clicks it, **then** it presents as an
  artifact-preview affordance (it previews, it never navigates the pipeline).
- [ ] **Given** a `gate` segment, **when** the user clicks it, **then** it surfaces the pending gate
  (re-opens the gate tray surface).

#### Notes

The rail is a passive read-out driven by local/mock stage state, not real pipeline state. Click
wiring to the actual drawer/gate surfaces composes with Stories 5 and 6.

### Story 4: Terminal region with placeholder and input line

- **story_type:** user
- **size:** S

**As a** Prime user, **I want** the dominant terminal region with a live-looking input line,
**so that** the session area is present and the surrounding shell can be sized against it.

#### Acceptance Criteria

- [ ] **Given** the shell, **when** it renders, **then** the terminal region fills the vertical
  space remaining below the top strip and is the largest region of the surface.
- [ ] **Given** the terminal interior, **when** it renders, **then** it shows a clearly labelled
  **placeholder** standing in for the wterm/Claude Code emulation — no terminal emulation is
  implemented.
- [ ] **Given** the terminal region, **when** it renders, **then** it shows the input line affordance
  (prompt char + caret) pinned at the bottom, matching the mockup's `.term-input`.

#### Notes

This story deliberately stubs the terminal interior. The wterm integration is a separate epic;
the placeholder marks its seam.

### Story 5: Gate tray — decision and validation variants

- **story_type:** user
- **size:** M

**As a** Prime user, **I want** an ephemeral gate tray that rises from the terminal when a decision
is required, **so that** I act on the pending judgment without the terminal scrollback being
replaced.

#### Acceptance Criteria

- [ ] **Given** a pending gate, **when** the tray opens, **then** it slides up from the bottom of
  the terminal region while the scrollback above stays visible, and the terminal recedes (dims)
  behind it.
- [ ] **Given** a decision (judgment) gate, **when** the tray renders, **then** it shows the
  judgment variant — header/badge, the "why" rationale, an inline decision slice (e.g. the story
  list with type badges and split markers), and the gate actions — matching the right-sizing gate
  in the mockup.
- [ ] **Given** a validation gate, **when** the tray renders, **then** it shows the blocked variant
  with the red treatment, a violation checklist (passed/failed rows with fix affordances), and its
  actions — matching the analyze gate in the mockup.
- [ ] **Given** an open tray, **when** the user dismisses/resolves it, **then** the tray collapses
  and the terminal returns to full fidelity (unless the drawer is still open).

#### Notes

Both variants render from local/mock content (story rows, violation rows from the mockup's sample
data). No real gate decisions are executed — the actions are presentational. Recede/dim state is
shared with the drawer per the mockup's `.recede` rule.

### Story 6: Artifact peek drawer

- **story_type:** user
- **size:** M

**As a** Prime user, **I want** a dismissible slide-over that renders an artifact file, **so that**
I can peek at what Claude wrote without leaving the terminal.

#### Acceptance Criteria

- [ ] **Given** a peek trigger (tools button, a `done` rail segment, or a gate "open artifact"
  action), **when** activated, **then** the drawer slides in from the right over a scrim and the
  terminal recedes behind it.
- [ ] **Given** the open drawer, **when** it renders, **then** it shows the header (file path +
  read-only tag + close), the rendered artifact body, and the footer note, matching the mockup's
  `.drawer`.
- [ ] **Given** the open drawer, **when** the user clicks the close control, clicks the scrim, or
  presses `ESC`, **then** the drawer closes and the terminal returns to full fidelity (unless a gate
  tray is still open).

#### Notes

Artifact content is rendered from local/mock file samples (as in the mockup's `artifacts` map);
no real file reads. Shares the recede/dim coordination with the gate tray.

### Story 7: Stage advance affordance

- **story_type:** user
- **size:** S

**As a** Prime user, **I want** a single advance affordance that appears when a stage completes,
**so that** I can run the next pipeline command without recalling its name.

#### Acceptance Criteria

- [ ] **Given** a stage has just completed (and no gate is pending), **when** the shell renders,
  **then** the advance bar appears showing "stage complete", the next stage name, and a run control —
  matching the mockup's `.advance`.
- [ ] **Given** no stage-complete condition, **when** the shell renders, **then** the advance bar is
  hidden.
- [ ] **Given** the advance bar, **when** the user triggers run, **then** the affordance hides
  (presentational hand-off; the next command is shown as running in the terminal placeholder area).

#### Notes

Driven by local/mock stage state. Actual command execution belongs to the pipeline-integration
work, not this layout epic.

### Story 8: Theme switching (light / dark)

- **story_type:** user
- **size:** S

**As a** Prime user, **I want** to switch the shell between light and dark mode, **so that** I can
match my environment without losing any of the shell's fidelity.

#### Acceptance Criteria

- [ ] **Given** the top strip tools cluster, **when** it renders, **then** it shows a theme-toggle
  control alongside the peek button.
- [ ] **Given** the active mode, **when** the user activates the toggle, **then** the entire shell —
  top strip, terminal placeholder, gate tray (both variants), drawer, advance bar — switches to the
  other mode, matching the corresponding mockup, with no region left in the prior mode.
- [ ] **Given** a chosen mode, **when** the user reloads the app, **then** the previously chosen mode
  is restored (persisted locally).
- [ ] **Given** no prior choice, **when** the app first loads, **then** it defaults to the dark theme
  (the original mockup) — or follows the OS `prefers-color-scheme` if that default is adopted in HLD.

#### Notes

This story is the user-facing switch on top of the dual-mode token mechanism from Story 1. The
persistence mechanism (e.g. `localStorage`) and the first-load default policy (fixed dark vs.
OS-preference) are HLD decisions; the AC fixes the observable behavior, not the mechanism.

## Assumptions

- Both mockups (`prime-ui-mockup.html` dark, `prime-ui-mockup-light.html` light) are the
  authoritative visual spec; their `.caption` bar and `.scenes` scene-switcher are mockup-only meta
  and are excluded from the product shell.
- The two mockups are structurally identical (same DOM/layout), so light/dark is a theming concern,
  not a separate layout. They differ in color *values* — but those divergences are **not** confined
  to `:root`: ~24 colors hardcoded outside `:root` also flip between modes (see Story 1 Notes), so
  the dual token set must absorb all of them, not only the `:root` variables.
- Regions are wired to local/mock UI state to demonstrate their visual states; no Nexus pipeline or
  Claude Code session is integrated in this epic.
- Tailwind 3 (already in the stack) is the styling mechanism; the mockup's raw CSS is ported to the
  Tailwind theme + component classes rather than shipped as a standalone stylesheet.
- The shell mounts at the app root (`apps/prime/src/app/app.tsx`), replacing the Nx scaffold content.

## Out of Scope

- The wterm / Claude Code terminal emulation (the terminal interior) — placeholder only.
- Integration with the real Nexus pipeline, real epic/stage state, or real artifact files.
- Executing real gate decisions, advancing real stages, or running real `nxs.*` commands.
- The mockup's scene-switcher and caption bar.
- Responsive/mobile layout beyond the desktop full-height frame shown in the mockup.

## Open Questions

None.

## Implementation Sequence

| STORY | Issue | blocked_by |
|---|---|---|
| STORY-3.01 | #4 | none |
| STORY-3.02 | #5 | STORY-3.01 |
| STORY-3.03 | #6 | STORY-3.02 |
| STORY-3.04 | #7 | STORY-3.01 |
| STORY-3.05 | #8 | STORY-3.01 |
| STORY-3.06 | #9 | STORY-3.01 |
| STORY-3.07 | #10 | STORY-3.01 |
| STORY-3.08 | #11 | STORY-3.01, STORY-3.02 |
