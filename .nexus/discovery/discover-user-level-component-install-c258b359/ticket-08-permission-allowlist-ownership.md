---
title: "Does Nexus own the permission allowlist entry that lets its toolkit run, and if so which stage writes it?"
type: council
status: open
blocked_by: none
claimed_by:
claimed_at:
---

## Question

Claude Code decides whether a Bash command may run by matching it against the permission allowlist
in `.claude/settings.local.json`. That file is user-owned today, and Nexus never writes it. Users
who have been running Nexus have accumulated allowlist entries that match the current invocation
strings, which all begin `tsx ./.claude/skills/`.

The resolution on component self-location changes every one of those strings. A component now names
the toolkit instead of pathing to it, so every accumulated allowlist entry stops matching on the
day the refactor lands.

Decide who owns the replacement entry. The options to weigh are:

1. Nexus documents the entry and the user adds it. Nexus keeps its hands off a user-owned file, and
   the first run after upgrading prompts for permission.
2. `/nxs.setup` offers to write the entry during bootstrap, with the user's consent at the moment
   it writes.
3. The install step writes the entry, so a fresh install is usable with no permission prompt.
4. Nexus writes nothing and accepts the prompt on every fresh machine.

State which file the entry lands in when Nexus does write it, and state what happens on a machine
that already has the old entries.

## Why it blocks

A backlog stub cannot be written for the invocation rewrite until this is decided, because the
rewrite either does or does not carry a settings change with it. The two versions are different
sizes and touch different files.

The decision also has a boundary in it that is larger than this refactor. Nexus has never written a
user-owned settings file. Deciding that it may do so now sets a precedent for every later stage, so
the decision belongs to the product owner and the architect together rather than to whoever writes
the rewrite.

## Notes

A named toolkit invocation improves the allowlist surface regardless of who owns the entry. One
stable command prefix replaces the eight skill-specific paths that entries match today. That makes
the entry easier to state, and it does not answer who states it.
