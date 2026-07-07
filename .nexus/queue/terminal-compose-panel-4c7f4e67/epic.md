---
feature: "Terminal Integration"
feature_path: docs/features/terminal-integration
epic: "Terminal Compose Panel"
slug: terminal-compose-panel
created: 2026-07-06
type: enhancement
complexity: M
complexity_drivers:
  [
    "distinct submit semantics from the inline input (Enter=newline vs Enter=submit)",
    "panel lifecycle: open/close, split layout, focus return",
    "injection into the live terminal session with line breaks preserved",
  ]
concepts: []
link: "#34"
---

# Epic: Terminal Compose Panel

## Description

The inline command input at the bottom of the terminal is built for short, single-shot
commands: pressing Enter submits. That makes it awkward to author a long, multi-line prompt
for the Claude Code session — every Enter risks sending a half-written thought. This epic adds
a **compose panel**: a button-invoked, full-height editor that splits the terminal area, giving
the user room to write and revise a long-form prompt before it goes anywhere.

Inside the panel the submit semantics invert to match long-form authoring: **Enter inserts a
newline**, and the user submits deliberately with **Ctrl+Enter** or an explicit **Send** button.
On submit the composed text is injected into the live terminal session with its line breaks
intact, the panel closes, and focus returns to the terminal so the user can carry on.

This serves the product's experiential-fidelity principle: the compose panel is a richer
authoring affordance layered onto the live Claude Code session, not a summarizing detour. The
terminal stays visible while composing, and the composed text lands in the same session the user
was already working in. It reuses the existing `@nexus/editor` input (epic #25) rather than
introducing a second editor.

## Success Metrics

- The composed text injected into the terminal session is byte-for-byte the text authored in the
  panel, with all newlines preserved (no dropped, added, or reordered characters).
- In the compose panel, Enter never submits; submission happens only via Ctrl+Enter or the Send
  button.
- After a submit or a cancel, keyboard focus is on the terminal (a subsequent keystroke goes to
  the terminal, not the panel).

## Personas

Per `docs/product/context.md`.

## User Stories

### Story 1: Open and close the compose panel

- **story_type:** user
- **size:** S

**As a** developer working in the terminal, **I want** a button that opens a full-height compose
panel splitting the terminal area, **so that** I have room to author a long prompt without losing
sight of my session.

#### Acceptance Criteria

- [ ] **Given** the terminal is active, **when** the user activates the Compose control, **then** a
  full-height compose panel opens, splitting the terminal region, and the compose input receives
  focus.
- [ ] **Given** the compose panel is open, **then** the terminal session remains visible alongside
  it (the panel splits the area rather than hiding the terminal).
- [ ] **Given** the compose panel is open, **when** the user cancels it (via Escape or a close
  control) without submitting, **then** the panel closes, no text is injected into the terminal,
  and focus returns to the terminal.

#### Notes

The recede/dim behavior the terminal region already applies to overlay surfaces should be
respected — composing is an authoring surface, so the terminal may recede but must stay visible
per Product Principle #1 (experiential fidelity).

### Story 2: Author long-form text with newline-on-Enter and deliberate submit

- **story_type:** user
- **size:** M

**As a** developer authoring a long prompt, **I want** Enter to add a newline and an explicit
gesture to submit, **so that** I can write and revise a multi-line prompt without accidentally
sending it.

#### Acceptance Criteria

- [ ] **Given** the compose panel is open with the cursor in the input, **when** the user presses
  Enter, **then** a newline is inserted at the cursor and nothing is submitted.
- [ ] **Given** the compose panel contains text, **when** the user presses Ctrl+Enter, **then** the
  composed text is submitted.
- [ ] **Given** the compose panel contains text, **when** the user activates the Send button,
  **then** the composed text is submitted.
- [ ] **Given** the compose panel is empty (or only whitespace), **when** the user attempts to
  submit via Ctrl+Enter or Send, **then** nothing is submitted and the panel stays open.

#### Notes

Reuses `@nexus/editor`'s raw/plain-text input (epic #25). Note the submit semantics deliberately
invert the inline command input, where Enter submits — the two inputs coexist with different
bindings by design.

### Story 3: Inject the composed text into the live terminal and return focus

- **story_type:** user
- **size:** S

**As a** developer, **I want** my composed text delivered into the live terminal session on
submit, **so that** the prompt I wrote is ready in the session I was already working in.

#### Acceptance Criteria

- [ ] **Given** multi-line composed text, **when** the user submits, **then** the exact text is
  injected into the live terminal session with all line breaks preserved.
- [ ] **Given** a submit completes, **then** the compose panel closes and keyboard focus returns to
  the terminal.
- [ ] **Given** a submit completes, **then** the compose input is cleared so the next time the panel
  opens it starts empty.

#### Notes

Depends on the live terminal session delivered by the Terminal Mount epic (#30); the injection
target is that session, not the placeholder.

## Assumptions

- **Submit stages, it does not execute.** On submit the composed text is written into the terminal
  session's input as a multi-line block (preserving newlines) and focus returns to the terminal;
  Nexus does not append a trailing execution/Enter. The user reviews and runs it in the terminal.
  This matches "returns focus to the terminal" in the stub and keeps the user in control of when
  the prompt is sent to Claude Code.
- One compose panel at a time; opening it while already open is a no-op (or re-focuses the existing
  panel).
- The Compose control lives near the inline input / terminal region; exact placement is a design
  decision for `/nxs.hld`.

## Out of Scope

- Persisting or drafting compose contents across sessions or reloads.
- Rich formatting, Markdown rendering, or slash-command autocomplete inside the compose panel — it
  is plain long-form text authoring.
- Changing the inline command input's existing Enter-submits behavior.
- Auto-executing the injected text in the terminal (see Assumptions).

## Open Questions

<!-- none -->

## Implementation Sequence

| STORY | Issue | blocked_by |
|---|---|---|
| STORY-34.01 | #35 | none |
| STORY-34.02 | #36 | STORY-34.01 |
| STORY-34.03 | #37 | STORY-34.02 |
