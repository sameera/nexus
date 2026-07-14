---
date: 2026-07-14
epic: "Portable Nexus Tooling"
source: "#44"
---

# Lesson: Phrase HLD invariants against what the consumer can actually execute

## Estimate vs actual

The M sizing held. Three stories (M/M/S), no scope cut, and `/nxs.analyze` was clean on the first pass
(0 critical / 0 high, two LOW findings that self-heal or are accepted design limits). The three
complexity drivers named at epic time — standalone node packaging, hub-vs-single-repo invocation, and
parity against an evolving source — were the real work, and the S/M split matched their difficulty.
Sequencing was clean: 44.02 (hub path) and 44.03 (parity) both depended only on 44.01 (the
distributable) and were independent of each other, so they were genuinely parallelizable. Nothing
argues for sizing this class of epic differently next time.

## What the next epic in this area should do differently

Two invariants (7 and 13) were written on the assumption that `/nxs.distill` would *consume* the
workspace resolver — call `resolveWorkspace()` and read `portableToolsDir`. But distill is a
markdown/bash command; it cannot import TypeScript. The invariants could only be satisfied "in spirit":
distill keys off the same committed artifacts the resolver reads (`.nexus/config/workspace.yml` /
`hub.yml`) and hard-codes the same `.nexus/tools/` path, producing a documented duplication that will
not auto-follow a future resolver change (analyze LOW-1).

**Lesson for the HLD stage:** when an invariant names a *consumer*, check that consumer's execution
model before pinning the invariant to a code API. A prose/bash command can only key off committed
*artifacts* (files, fixed paths), never a function it would have to import. State such invariants in
terms of the artifacts the command can read, and treat "distill's resolution duplicates the resolver's
rules in prose" as the accepted contract — not a defect to design around. `distill-multi-repo`, which
extends distill's resolution across the workspace, inherits this: either it accepts prose-level
resolution as the contract, or it moves the resolution into a step that can call the resolver.

## What paid off

Designing the packaging vehicle for its *named next consumer* was the right call for a foundational
epic. The bundle was built to inline npm dependencies (esbuild dep-inlining) even though today's two
scripts need none, specifically so the later workspace resolver and its `yaml` dependency can ship
through the same vehicle. The decision record explicitly refused the simpler per-file `tsc`/`swc`
transpile for this reason. `workspace-setup-cli` and `distill-multi-repo` are chartered to *consume*
this vehicle, not redesign it — so spending the design judgment on the extension seam now, inside the
foundational epic, was correct rather than speculative.
