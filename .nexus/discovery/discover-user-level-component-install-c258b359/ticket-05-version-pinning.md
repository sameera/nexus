---
title: "Does a repo keep the ability to pin the Nexus component version it runs?"
type: council
status: open
blocked_by: [ticket-04-who-installs-nexus.md]
claimed_by:
claimed_at:
---

## Question

Committing the components into the repo gives three properties for free. The repo pins an exact
component version. A component change appears in a diff and can be reviewed. Any checkout of the
repo, including a continuous-integration checkout and a git worktree, carries the components with
it.

A shared install gives one component version per machine and drops all three properties. Decide
whether Nexus keeps any of them, and by what mechanism.

The options to weigh include: drop pinning entirely and accept one version per machine; keep a
declared version in the repo that the shared install checks itself against and refuses or warns on
mismatch; or keep pinning only for repos that ask for it.

## Why it blocks

A pinning mechanism is its own goal with its own stories. A declaration file, a version check, and
a mismatch behaviour are work that only exists if this decision says pinning survives. The
migration question also depends on the answer, because a repo can only stop carrying its components
once it is clear what replaces the guarantee they gave.

## Evidence

## Resolution
