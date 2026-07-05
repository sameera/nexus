---
title: "Command Input"
aliases: ["editable command prompt", "terminal input line", "command prompt field", "raw-edit command entry"]
touches: ["markdown-editor", "overlay-coordination", "application-shell"]
last_updated_by: "#25"
status: active
verification: verified
---

# Command Input

The terminal region's prompt line is a real, multi-line, plain-text command input, replacing the earlier static glyph and fake caret. A user types and edits a command across multiple lines, submits with Enter, and the command hands off through the terminal's shared surfaced-command slot and echoes back verbatim. The input stays mounted and fully interactive even while the terminal is receded behind another surface.

## How It Works

The input sits in the terminal's live input line, outside the dimming filter the terminal applies when an overlay surface is open, so it keeps accepting text and submitting while the terminal behind it recedes. Submitting a non-empty command pushes the command string into the terminal's single surfaced-command slot — the same slot the stage-advance affordance writes to — replacing whatever was there before rather than accumulating a history. The terminal then echoes that command verbatim: the prompt glyph, followed by the command exactly as typed, line breaks preserved, with no injected leading character and no execution-status label appended, since no live command actually runs yet. A submitted command also clears the input and returns focus to it, ready for the next command.

## Key Invariants

1. The command input stays mounted and fully interactive while the terminal is in its receded/dimmed state; recede is a presentational filter over it, not a disabling one.
2. Submitting a non-empty command replaces the terminal's single surfaced-command slot rather than appending to it.
3. The surfaced command renders verbatim beneath the prompt glyph — original line breaks preserved, no injected prefix, no execution-status suffix.
4. Real delivery to a live shell is out of scope; submitting only updates the terminal's presentational surfaced-command display.

## Integration Points

- [markdown-editor](markdown-editor.md) — the command input is the terminal's consumer of the editor library's plain-text submit mode.
- [overlay-coordination](overlay-coordination.md) — submission writes into the shared surfaced-command slot that overlay coordination owns.
- [application-shell](application-shell.md) — the shell's terminal region hosts the command input as its live input line.

## Decision Log

### 2026-07-05 — #25 — Verbatim, unlabeled echo rather than the prior slash-prefixed "running…" framing

The surfaced command now renders exactly as submitted — no leading slash, no execution-status suffix — replacing the terminal's earlier single-line, slash-prefixed, "running…"-suffixed rendering. Why: a user-typed command is not a slash command, may span multiple lines, and, with no live shell mounted yet, the terminal cannot honestly claim anything about its execution state; plain verbatim echo preserves both the multi-line and verbatim-delivery requirements without fabricating a shell response. Refuted alternative: keep the pre-existing slash-prefixed, status-suffixed rendering for the new submission path too — simpler, since no rendering change is needed — but it would mislabel a typed command as a slash command and assert a running state that does not exist.
