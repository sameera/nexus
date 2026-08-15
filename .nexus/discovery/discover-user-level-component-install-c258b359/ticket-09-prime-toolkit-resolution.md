---
title: "Does a Nexus Prime session resolve the toolkit by the same rule as a local shell, or must Prime supply it?"
type: research
status: open
blocked_by: none
claimed_by:
claimed_at:
---

## Question

Nexus Prime drives Claude Code inside a browser terminal. The resolution on component self-location
decided that a component names the toolkit and the toolkit locates its own files at run time.
Naming works only if the name resolves in the environment the command actually runs in.

Establish what Prime's terminal session inherits. Report:

1. How Prime launches Claude Code, and what environment that process receives. State specifically
   whether it inherits the user's login shell environment, including whatever makes an installed
   toolkit reachable by name.
2. Whether Prime's session runs with the target repo as its working directory, which is what the
   repo-bound half of the boundary depends on.
3. Whether a Prime session can reach a shared per-machine install at all, or whether it is confined
   to files inside the repo it opened.
4. What Prime does today when a command invokes `tsx ./.claude/skills/...`, since that is the
   arrangement currently in the tree. If it already works, name the mechanism that makes it work,
   because that mechanism is what the refactor must preserve.

## Why it blocks

Prime is one of the environments Nexus components run in. If a Prime session cannot resolve a
toolkit by name, then either Prime gains an install step of its own, or the refactor keeps a
repo-local fallback for Prime's sake. Those are different functional goals with different sizes, and
neither can be stated as a backlog stub until this is known.

## Notes

The self-location resolution recorded that the toolkit resolves its own payload from its own file
location. That property holds in any environment that can start the toolkit at all. The open part is
reachability, not self-location.
