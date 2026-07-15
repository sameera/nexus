---
date: 2026-07-15
epic: "Distill Across a Multi-Repo Workspace"
source: "#54"
---

# Lesson: The resolver-consumption fork resolved cleanly — split by execution model

## Estimate vs actual

The M sizing held. Four stories (M/S/S/S), no scope cut, and `/nxs.analyze` was clean on the first
pass (0 critical / 0 high, one LOW that is an accepted design limit). The three complexity drivers
named at epic time — cross-repo diff derivation in member checkouts, per-repo anchor/provenance
qualification, and workspace-wide drain-SLO aggregation — were the real work, and 54.01 (M) carried
it while the other three (S) layered on top. Sequencing matched the dependency graph exactly: 54.02
and 54.03 both depended only on 54.01's per-repo diffs and head SHAs and were independent of each
other; 54.04 depended on nothing new (it keys off the already-stamped originating repo). Nothing
argues for sizing this class of epic differently.

## What paid off — the resolver-consumption fork was answered by splitting on execution model

The `portable-nexus-tooling` lesson (#44) left this epic an explicit fork: distill "either accepts
prose-level resolution as the contract, or it moves the resolution into a step that can call the
resolver." The epic took **both, split by execution model** — and that split is the reusable insight:

- The **coarse hub/single gate** stayed in the `/nxs.distill` prose, keying off manifest *presence*
  (a committed artifact a bash/markdown command can read) — matching the invocation-selection step
  the command already performed. No new "are we in a hub" notion was introduced.
- The **member-checkout resolution** — which genuinely needs member identity and expected checkout
  paths, not just a presence bit — moved into `derive-entry-diff.ts`, a portable TS tool that
  *actually calls* `resolveWorkspace()`. The resolver is consumed as code exactly where code can run,
  and only there.

The takeaway for the next workspace-aware command: don't force one resolution mechanism. Put the
presence-level branch in prose and push the context-rich resolution into a portable tool that imports
the resolver. The seam is the execution model — what a markdown command can read (artifacts) vs. what
only TypeScript can do (call the resolver).

## What to front-load next time

- **Cross-lib imports in `portable-tools` trip nx's buildable classification — make it a checklist
  item, not a surprise.** Importing `@nexus/workspace` / `@nexus/close-migration` from a new
  portable tool failed `@nx/enforce-module-boundaries` because `@nx/js` had inferred portable-tools
  as *buildable* (no `exports`/`main` in its `package.json`), and a buildable lib may not import a
  non-buildable one. The fix was a one-line `exports` map, found empirically. This is the third
  nx-target/classification surprise in this area (cf. #15, #44). The next epic adding a portable
  tool with cross-lib deps should verify the importing lib's buildable classification *before*
  wiring the imports, not after lint fails.
- **The M3 gap is an accepted limitation, not a TODO.** "Terse `#n` never appears in a workspace
  drain" is enforced by the `/nxs.distill` command prose, not by the concept validator — the
  validator sees files, not the drain's mode, so it must keep accepting terse `#n` for single-repo.
  A future epic touching provenance should treat this as the contract (grep the drain's output to
  measure it), not try to make the validator mode-aware.
