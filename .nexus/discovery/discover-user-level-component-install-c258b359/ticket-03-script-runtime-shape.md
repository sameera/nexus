---
title: "Do the skill scripts stay as separate TypeScript files, or collapse into the one portable bundle?"
type: council
status: open
blocked_by: [ticket-02-component-self-location.md]
claimed_by:
claimed_at:
---

## Question

Today every skill script is a TypeScript file run with `tsx`, which needs the target repo's Node
toolchain. A shared install cannot assume that toolchain exists. Nexus already ships a
self-contained answer for exactly this case: the `nexus.mjs` bundle runs on a bare `node` binary
with no install step and no build step, and the docs-root read-out is already reachable through it.

Decide the shape:

1. Every skill script becomes a verb on the one portable bundle, so a shared install carries one
   executable file and the parity gate covers all of it.
2. Each skill keeps its own script file, and the components gain a shared way to find a runtime
   that can execute it.
3. Some third split, stated explicitly.

Weigh what each option costs. Option 1 grows one bundle and one fingerprint pin, and it moves every
script behind a verb name rather than a path. Option 2 keeps the scripts readable beside the skill
that documents them, and it keeps the toolchain requirement.

## Why it blocks

The stub set differs by option. Option 1 produces goals about verb migration and bundle packaging.
Option 2 produces goals about runtime discovery and about what a repo must still install. The two
sets do not overlap enough to be planned as one.

## Evidence

## Resolution
