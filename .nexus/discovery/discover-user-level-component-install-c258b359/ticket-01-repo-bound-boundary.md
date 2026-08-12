---
title: "Which Nexus component behaviours genuinely require running inside the target repo, and which only appear to?"
type: research
status: open
blocked_by: none
claimed_by:
claimed_at:
---

## Question

Draw the boundary between two sets, naming every member of each.

1. Behaviours that must read or write the target repo, and therefore stay repo-bound regardless of
   where the component file lives. The `.nexus/` store, the resolved docs root, the git worktree,
   and the GitHub remote are the candidates.
2. Behaviours that only look repo-bound because a path is written relative to the current working
   directory. Roughly forty invocations across the command set are written as
   `tsx ./.claude/skills/<skill>/scripts/<script>.ts`, and the path is repo-relative rather than
   component-relative.

The earlier attempt at a user-level install concluded that "most skills assume they are running
inside the repo". This ticket tests that conclusion against the actual component set instead of
accepting it.

## Why it blocks

Until the two sets are named, nobody can say what a shared install has to change. If set 2 is
nearly all of it, the refactor is an addressing change and a runtime change. If set 1 contains
behaviours that read files shipped beside a skill, or that assume the component tree and the
project tree are the same tree, those are separate goals and separate stubs.

## Evidence

## Resolution
