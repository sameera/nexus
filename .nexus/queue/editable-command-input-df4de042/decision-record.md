---
title: "Decision Record: Editable Command Input"
epic: #25
feature: "Command Input"
rating: M
concepts: []
date: 2026-07-04
---

# Decision Record: Editable Command Input

## Summary

Replace the terminal region's fake prompt (static glyph + fake blinking caret) with a real,
multi-line, plain-text command input. The input is built by extending `@nexus/editor` with a
new plain-text submit mode — not by configuring the existing Markdown component (impossible
through its current API) and not by standing up a second Lexical setup in Prime. Enter submits
verbatim through the shell-owned overlay state (the same seam that already surfaces a running
command) and clears the field; Shift+Enter inserts a newline.

## Chosen Approach

Grow `@nexus/editor` to expose a plain-text, submit-capable mode alongside its Markdown mode.
This mode mounts none of the Markdown machinery (no shortcut plugin, no HR/list/link/table
plugins, no table toolbar), extracts and emits literal text rather than serialized Markdown, and
owns the Enter gesture (capture text → fire submit → clear → refocus). The terminal region drops
the stub and renders this input, wiring its submit to a new action on the overlay context that
pushes the command string into the existing surfaced-command slot. Prime keeps a single Lexical
configuration, single theme, and single version-pinned dependency surface — all inside the lib.

## Key Decisions

### Extend `@nexus/editor` with a plain-text submit mode; do not build a separate Lexical input in Prime

- **Decision:** Add a plain-text, submit-capable mode to the `@nexus/editor` lib and consume it
  from Prime, rather than building a command input directly on Lexical in the app.
- **Why:** The epic names `@nexus/editor` as the substrate, and the lib is source-consumed, so
  extension is low-friction. The composer, error boundary, theme-token wiring, and the
  version-locked Lexical dependency set all live in the lib; a Prime-local input would fork every
  one of those.
- **Refuted alternative (no rich editor — native `textarea`/`contentEditable`):** For the scope as
  written this is the leaner choice: a textarea gives multi-line editing, verbatim text, and
  Enter/Shift+Enter handling with far less code, and it retires both of the epic's complexity
  drivers (there is no Markdown machinery to suppress and no default Enter to override). It lost on
  a forward-looking trade-off: command entry is expected to grow inline rich affordances a textarea
  structurally cannot host — slash-command highlighting, autocomplete popovers anchored to tokens,
  and argument/mention chips — and building those later would mean migrating off the textarea onto
  exactly this substrate. Choosing `@nexus/editor` now pays the suppression cost up front to avoid
  that migration. (Guardrail: those affordances are out of scope for *this* epic; the decision
  rests on their being near-term enough to justify the framework, per the human call on
  2026-07-04.)
- **Refuted alternative (Lexical, but in Prime):** Build a thin command input directly on Lexical
  inside Prime. Viable — a plain-text composer with one Enter handler is small — but it creates a
  second Lexical configuration the repo must keep in lockstep (mismatched versions break at
  runtime) and pulls Lexical into Prime as a direct dependency. It lost on divergence and
  maintenance cost against a substrate the epic already blesses. (Configuring the *existing*
  Markdown component was not a viable third option: its public surface is initial-content / change
  / focus only — no Enter hook, no way to disable Markdown shortcuts, and its read-only mode cannot
  accept input.)

### Plain-text mode emits literal text — it never round-trips through Markdown serialization

- **Decision:** In plain-text mode the input reads text content directly (with newlines for line
  breaks) and does no Markdown conversion in either direction.
- **Why:** This is the verbatim-preservation boundary and a stated success metric. The Markdown
  mode's serialization would re-escape and reformat command characters (`---` → rule, `# note` →
  heading, pipe/cell escaping). A command such as `--- flag` must survive byte-for-byte, so
  plain-text mode must bypass Markdown conversion entirely.

### Plain-text mode owns the full Enter gesture: intercept at high priority, branch on Shift, self-clear on submit

- **Decision:** The lib's plain-text mode intercepts Enter above Lexical's default handling,
  submits on Enter (no Shift), inserts a newline on Shift+Enter, and clears its own state and
  retains focus on a successful submit.
- **Why:** Enter-to-submit must take precedence over Lexical's default "Enter inserts a
  paragraph," achievable only by a listener that preempts the default and signals handled.
  Clear-after-submit belongs where the editor instance lives, and the lib's own reactivity
  contract makes external clearing unreliable — feeding empty content back skips the initializer,
  so it will not reset the document. The lib must clear itself.
- **Refuted alternative:** Expose only a submit / key callback and let Prime clear the field by
  resetting the content prop. It lost because the documented reactivity contract defeats it: empty
  content is a no-op, so the field would not actually clear.

### Submit reaches the terminal through a new action on the shell-owned overlay state, reusing the surfaced-command slot

- **Decision:** Submit calls a new overlay-state action that pushes the command string into the
  existing surfaced-command slot, rather than surfacing the command from region-local state.
- **Why:** Overlay is deliberately the single home for shared terminal/surface state, and Story 3
  explicitly reuses "the same hand-off that surfaces a running command." One slot with two writers
  (the mock advance and the user submit) keeps the "surface a command" rule in one place.
- **Refuted alternative:** Keep the submitted command in region-local state and render it in
  place. Viable and simpler in isolation, but it duplicates a seam the shell already owns and
  contradicts the story's explicit instruction to reuse it.

### Surfaced-command rendering shows the submitted command verbatim, with no injected prefix and no status suffix

- **Decision:** Render the submitted command verbatim after the prompt glyph — preserving line
  breaks, injecting no leading `/`, and appending no execution-status label. It reads as an echoed
  sent command, not a running one (human decision, 2026-07-04).
- **Why:** The existing seam renders a single-line, slash-prefixed, "running…"-suffixed line. A
  user command is not a slash command, may span lines, and — with no live shell mounted — makes no
  claim about execution state. Plain sent-history framing preserves the verbatim metric and
  Story 3's "all lines preserved" without faking a shell response.

## Constraints & Invariants

1. **Editor lib:** In plain-text mode the Markdown shortcut plugin, the HR/list/link/table
   plugins, and the table action menu MUST NOT be mounted — command entry exposes no rich
   formatting or toolbar.
2. **Editor lib (verbatim boundary):** Text entered in plain-text mode MUST be delivered on submit
   exactly as typed, including Markdown-significant characters, with no escaping, reformatting, or
   Markdown serialization in either direction.
3. **Editor lib:** Enter without Shift MUST submit and suppress newline insertion; Shift+Enter MUST
   insert a newline and MUST NOT submit; Enter on empty-or-whitespace-only content MUST do nothing
   and raise no error.
4. **Editor lib:** On a successful submit the field MUST clear and focus MUST remain on (or be
   immediately returnable to) the input, driven internally rather than via the content prop.
5. **Editor lib:** The plain-text content area MUST render multiple lines (grow with content, not
   clip to one row) and MUST use a compact command-line height, not the Markdown mode's tall
   canvas.
6. **Terminal region:** The input MUST stay mounted and fully interactive while the terminal is in
   its receded/dimmed state — recede remains presentational (a filter) only.
7. **Overlay state:** The submitted command flows through the single shared surfaced-command slot;
   a new submit replaces the prior value (no accumulation), consistent with output/echo being out
   of scope.
8. **Terminal region:** The surfaced-command rendering MUST present the command verbatim, preserve
   line breaks, inject no characters the user did not type, and add no execution-status suffix.

## Open Clarifications

<!-- none — the single clarification (submit framing) was resolved at the Phase 2 gate: verbatim, no status suffix. -->
