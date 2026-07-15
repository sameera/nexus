---
date: 2026-07-15
epic: "Close-Entry Migration to the Hub Queue"
source: "#49"
---

# Lesson: run the typecheck target, not just the tests, before calling a story done

The M estimate held. Three stories (range stamping S, migrate M, remove S) shipped in three
commits and matched the decision record exactly — `/nxs.analyze` found every acceptance criterion
met with zero findings. Splitting the cross-repo move into a "migrate" story and a "remove" story
kept each independently reviewable while shipping them together, so the transient duplicate entry
between them never reached a shared `main`. That decomposition is worth repeating for other
safety-ordered, multi-step mutations.

The one thing that slipped: a fourth, unplanned fixup commit (`ca5265b`) was needed after all
three stories were "done and green." Adding a test-support source file (`git-fixtures.ts`, real
temp git repos for the specs) that is excluded from the shipped build (`tsconfig.lib.json`) left
that file unclaimed by any TypeScript project, so `tsc --build` failed TS6307. `vitest` never
catches this — it does not run `tsc` — so the per-story test suite was green while
`pnpm nx typecheck` was red.

**What the next epic in this area should do differently:** when a story introduces a test-support
file that the lib build excludes, run the `typecheck` target (not just `test`) before marking the
story done. In a composite-project TypeScript setup, every source file must belong to exactly one
referenced project; a file excluded from the lib project must be explicitly added to the spec
project's `include`, and only the build target — never the test runner — enforces that. Budget a
typecheck pass into any story that adds excluded-from-build test scaffolding.
