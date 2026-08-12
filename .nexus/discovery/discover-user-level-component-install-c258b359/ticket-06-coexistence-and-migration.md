---
title: "Must both installation modes coexist, and what happens to repos that already carry a committed .claude directory?"
type: council
status: open
blocked_by: [ticket-01-repo-bound-boundary.md, ticket-05-version-pinning.md]
claimed_by:
claimed_at:
---

## Question

Decide two linked things.

First, whether the repo-local install survives alongside the shared install, or is replaced by it.
If both survive, state which one wins when a machine has a shared install and the repo also carries
a committed `.claude/`, and state where that precedence rule is enforced.

Second, what a repo that already carries a committed `.claude/` does. The options are: leave the
files and let the shared install take precedence; remove the Nexus-namespaced files in a migration
step; or leave the repo alone until its owner opts in. The `deployComponents` function already
knows how to remove Nexus-namespaced files that the payload no longer carries, so a migration step
has a place to live.

## Why it blocks

The answer is the difference between one goal and three. A clean replacement is a single migration
goal. Coexistence adds a precedence rule, a way to tell a user which set is active, and a
diagnostic for the case where the two disagree.

## Evidence

## Resolution
