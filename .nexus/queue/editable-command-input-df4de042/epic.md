---
feature: "Command Input"
feature_path: docs/features/command-input
epic: "Editable Command Input"
slug: editable-command-input
created: 2026-07-04
type: enhancement
complexity: M
complexity_drivers:
  - "Adapting @nexus/editor (a Markdown editor with no submit/key hook) into a plain command input"
  - "Overriding Lexical's default Enter behavior to submit, while Shift+Enter inserts a newline"
concepts: []
link: "#25"
---

# Epic: Editable Command Input

## Description

The terminal region's input line is a static stub today — a prompt glyph and a fake
blinking caret with no editable field ([terminal-region.tsx:57-61](apps/prime/app/terminal/terminal-region.tsx#L57-L61)).
The prompt looks live but accepts nothing; a user cannot type a command. This is the most
visible gap between the shell's convincing chrome and its inert reality.

This epic replaces the stub with a real, editable, multi-line command input built on the
in-repo `@nexus/editor` library. A user can type and edit a command across multiple lines,
press **Shift+Enter** to add a line, and press **Enter** to submit. Because the wterm/PTY
shell is not yet mounted, submitting hands the command off through the terminal region's
existing presentational seam (the same path that currently surfaces a running command) and
clears the input. Real write-through to a live shell is deferred to the terminal-mount work.

The value is twofold: the prompt becomes actually usable — honoring Prime's experiential-fidelity
principle — and it establishes the command-submission contract that the live-shell integration
will later consume.

## Success Metrics

- A user can type, edit across multiple lines, and submit a command using only the keyboard,
  with no console errors.
- Enter submits and resets the input; Shift+Enter inserts a newline without submitting — both
  verified as distinct behaviors.
- Command text is delivered verbatim on submit — Markdown-like characters typed in a command
  are preserved literally, not reformatted.

## Personas

Per `docs/product/context.md`.

## User Stories

### Story 1: Editable multi-line command input

- **story_type:** user
- **size:** M

**As a** Prime user, **I want** the terminal input line to be a real editable field, **so that**
I can type and revise a command instead of staring at an inert placeholder.

#### Acceptance Criteria

- [ ] **Given** the terminal region is rendered, **when** I focus the input line and type, **then**
  a caret is shown and the typed characters appear in the input.
- [ ] **Given** I have typed text, **when** I edit it (backspace, caret movement, selection, replace),
  **then** the edits apply as in a normal text field.
- [ ] **Given** I enter text spanning more than one line, **then** the input displays all lines
  (it is multi-line capable, not clipped to one row).
- [ ] **Given** I type a command containing Markdown-like characters (e.g. `# note`, `*.ts`,
  `--- flag`), **then** the text is preserved exactly as typed and is **not** reformatted into
  headings, lists, rules, or other rich formatting.
- [ ] **Given** the terminal region is in its receded/dimmed state, **then** the input remains
  present and behaves the same (recede stays presentational only).

#### Notes

Built on `@nexus/editor` (`<MarkdownEditor>`), but the command input surfaces **plain text**: the
Markdown shortcut behavior and the formatting/table toolbar must not be exposed for command entry.
The editor lib currently has no key/submit hook and applies Markdown shortcuts in `edit` mode — how
to suppress that (extend the lib vs. configure it) is a `/nxs.hld` decision, not fixed here.

### Story 2: Enter submits, Shift+Enter inserts a newline

- **story_type:** user
- **size:** S

**As a** Prime user, **I want** Enter to submit and Shift+Enter to add a line, **so that** I can
enter both single-line and multi-line commands naturally.

#### Acceptance Criteria

- [ ] **Given** the input has non-empty text, **when** I press Enter without Shift, **then** the
  command is submitted (Story 3) and **no** newline is inserted.
- [ ] **Given** the input, **when** I press Shift+Enter, **then** a newline is inserted at the caret
  and **nothing** is submitted.
- [ ] **Given** the input is empty or contains only whitespace, **when** I press Enter, **then**
  nothing is submitted and no error occurs.

#### Notes

The Enter handling must take precedence over Lexical's default "Enter inserts a paragraph" behavior.

### Story 3: Submitted command hands off to the terminal and resets the input

- **story_type:** user
- **size:** S

**As a** Prime user, **I want** my submitted command to appear as sent to the terminal and the
input to reset, **so that** I get immediate feedback and a clean prompt for the next command.

#### Acceptance Criteria

- [ ] **Given** I submit a non-empty command with Enter, **then** the command is handed off through
  the terminal region's existing presentational seam (the same hand-off that surfaces a running
  command) and appears as submitted in the terminal area.
- [ ] **Given** a command was just submitted, **then** the input line is cleared and ready for the
  next command, with focus retained on (or immediately returnable to) the input.
- [ ] **Given** a multi-line command is submitted, **then** the full multi-line text is delivered as
  a single submitted command (all lines preserved).

#### Notes

Real PTY/wterm write-through is out of scope (terminal-mount epic). Reuse or extend the seam that
currently surfaces the `running` command in [terminal-region.tsx](apps/prime/app/terminal/terminal-region.tsx).

## Assumptions

- `@nexus/editor`'s `<MarkdownEditor>` is the editing substrate, but the command input presents plain
  text — Markdown shortcuts, rich formatting, and the table/formatting toolbar are not exposed for
  command entry.
- "Send to the shell" for this epic means: emit the command through the terminal region's existing
  presentational seam and reset the input. Writing to a live wterm/PTY session is deferred (user
  decision, 2026-07-04).
- Keyboard-first: pointer focus works, but the flow is designed around typing.

## Out of Scope

- Real PTY/wterm delivery of the submitted command (terminal-mount, blocked on pty-bridge #11).
- Command history, recall, and autocomplete.
- Terminal output rendering / echo of the shell's response.
- Prompt theming or layout changes beyond making the input editable.

## Open Questions

<!-- none -->

## Implementation Sequence

| STORY | Issue | blocked_by |
|---|---|---|
| STORY-25.01 | #26 | none |
| STORY-25.02 | #27 | STORY-25.01 |
| STORY-25.03 | #28 | STORY-25.02 |
