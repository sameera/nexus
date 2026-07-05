---
title: "Markdown Editor"
aliases: ["editor library", "raw-edit mode", "plain-text editing mode", "in-repo rich-text editor"]
touches: ["command-input"]
last_updated_by: "#25"
status: active
verification: verified
---

# Markdown Editor

The Markdown Editor is Prime's shared in-repo editing library: a rich Markdown-editing surface plus a distinct plain-text, submit-capable mode built for command entry. The plain-text mode mounts none of the Markdown machinery and never round-trips through Markdown serialization, so text a user types is delivered exactly as typed. It also owns the Enter gesture itself, submitting on Enter and inserting a newline on Shift+Enter.

## How It Works

The library exposes Markdown editing (an editable mode and a read-only view) alongside a plain-text mode built specifically for verbatim, single-purpose text entry. The plain-text mode is a hard fork of behavior, not a configuration flag on the Markdown mode: it mounts no shortcut plugin and none of the heading, list, link, or table plugins or toolbar, so nothing typed can be reinterpreted as a heading, rule, list, or table. Content is read as literal text, with newlines standing in for line breaks, never serialized through or from Markdown syntax. The plain-text mode also owns Enter ahead of the library's default paragraph-insertion behavior: Enter alone submits and clears the field while keeping focus; Shift+Enter inserts a newline instead; Enter on empty or whitespace-only content does nothing and raises no error. Clearing happens inside the mode itself, since feeding empty content back through the caller is a no-op for the library's change-driven reactivity.

## Key Invariants

1. The plain-text mode never mounts the Markdown shortcut plugin, the heading, list, link, or table plugins, or the formatting toolbar.
2. Text entered in the plain-text mode is delivered on submit exactly as typed, with no Markdown escaping, reformatting, or serialization in either direction.
3. In the plain-text mode, Enter alone submits and suppresses the default newline; Shift+Enter inserts a newline and never submits; Enter on empty-or-whitespace-only content is a no-op with no error.
4. A successful submit clears the plain-text field and keeps focus on it, driven by the mode itself rather than by the caller resetting its content.
5. The plain-text mode's content area grows with multi-line content at a compact, command-line height, rather than the Markdown mode's taller canvas.

## Integration Points

- [command-input](command-input.md) — the terminal's command input is built on the plain-text mode.

## Decision Log

### 2026-07-05 — #25 — Grow the shared editor with a plain-text mode rather than build a second editor or drop the framework

The plain-text, submit-capable mode was added to the existing shared editing library rather than assembled directly wherever it is consumed, keeping one editing configuration, one theme, and one version-pinned dependency surface in a single place. Refuted alternative (a plain textarea-style field): leaner for the immediate need — it retires the need to suppress rich-editing behavior and to override a default Enter handling — but it cannot host inline rich affordances expected soon after (inline highlighting, anchored autocomplete, argument chips), which would force a later migration onto exactly this substrate; paying the suppression cost now was judged to avoid that migration. Refuted alternative (a second, consumer-local instance of the underlying editor framework): avoids growing the shared library, but creates a second configuration of the same framework the codebase would need to keep in lockstep, risking version drift and runtime breakage.
