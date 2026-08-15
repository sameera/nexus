---
title: "Does a shared per-machine install replace the hub's vendored .nexus/tools/ bundle, or sit beside it?"
type: council
status: open
blocked_by: [ticket-03-script-runtime-shape.md, ticket-05-version-pinning.md]
claimed_by:
claimed_at:
---

## Question

Nexus already ships one answer to the shared-install problem, and that answer is per repository
rather than per machine. `libs/portable-tools/src/vendor-bundle.ts` builds dependency-free `.mjs`
entry points and vendors them, with the component payload, into a hub's `.nexus/tools/`. The
components then invoke them as plain `node .nexus/tools/<x>.mjs`.
`docs/features/multi-repo-workspaces/hub-tooling-install.md` states the trade deliberately: every
clone of the hub already carries the bundle, one time per repository rather than one time per
machine. `delivery_config.py:417` locates that directory from Python, including by way of a
member repo's sibling hub, and its candidate list is hard-coded at line 428.

A per-machine shared install inverts that trade. Decide which arrangement Nexus keeps.

1. The shared install replaces the vendored bundle. `.nexus/tools/` stops being written, and the
   hub-versus-member distinction stops mattering for tooling.
2. Both arrangements survive. State which one wins when a machine has a shared install and the hub
   also carries a vendored bundle, and state where that precedence is enforced — the components
   resolve the directory in at least two languages today.
3. The vendored bundle survives and the shared install is built on top of it, so that a machine-wide
   install is a place the bundle is fetched from rather than a second copy of it.

Weigh what each option costs against the properties the vendored bundle buys: a continuous-
integration checkout and a git worktree both carry the tooling with them, and a clone needs no
install step at all.

## Why it blocks

The question came from "Not yet specified" and could not be stated until the repo-bound boundary was
drawn. Now that it can be stated, it changes the goal set rather than adding to it. Option 1 makes
the hub tooling install a migration goal. Option 2 adds a precedence rule and a diagnostic for the
case where the two copies disagree. Option 3 makes the shared install a distribution mechanism
rather than a run-time location, which is a different goal with different stories.

## Evidence

## Resolution
