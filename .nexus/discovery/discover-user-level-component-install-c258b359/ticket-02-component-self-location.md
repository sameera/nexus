---
title: "When a Nexus component is installed outside the target repo, how does it address its own scripts and files?"
type: research
status: open
blocked_by: none
claimed_by:
claimed_at:
---

## Question

A command or skill installed outside the target repo needs a reliable way to name a file that
ships beside it. Establish what Claude Code actually provides for this, and which of those
mechanisms Nexus can depend on.

The candidates to check are the user-level component directory at `~/.claude/`, the plugin
mechanism and any root path variable it exposes to a component, and any other way a component can
learn its own installed location at run time.

Report for each candidate: whether the mechanism exists, whether it works from a slash command
body as well as from a skill body, whether it survives the component being installed at a path the
author did not choose, and what happens when the same machine has both a repo-local copy and a
shared copy.

## Why it blocks

This is the question the earlier attempt failed on. Every other decision in this discovery assumes
some answer to it. If no reliable self-location mechanism exists, the shape of the refactor changes
completely, because the components would have to be addressed through something the repo still
supplies.

## Evidence

## Resolution
