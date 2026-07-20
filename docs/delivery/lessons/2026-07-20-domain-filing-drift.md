---
date: 2026-07-20
epic: "Domain Filing and Drift Advisory in the Drain"
source: "#94"
---

# Lesson: A cross-tool import drags the exporter's CLI guard into the importer's bundle — budget the vendored behavior, not just the source

The plan for Story 2 treated the shared-engine decision (reuse `buildAdjacency` from
`generate-atlas.ts` rather than duplicate it — Decision 2.2, Invariant 9) as a one-token change:
add the `export` keyword, "behavior identical, only the bundle bytes change." That held for the
atlas's own output but was wrong for the *importer*. `generate-atlas.ts` carries a top-level
self-invoking CLI guard (`if (import.meta.url === ...) main()`); once `drift-advisory.ts` imported
from it, esbuild inlined the whole exporter — guard included — into the advisory bundle, and after
bundling both guards shared one `import.meta.url`. The vendored `drift-advisory.mjs` silently ran
the atlas generator's `main()` (which `process.exit`s) instead of the advisory. It surfaced only
through the parity test on the *vendored* artifact, not the `tsx` source run, and the fix (a
`path.basename(process.argv[1])` disambiguator on both guards) was a real, unplanned deviation
that showed up on the same-size story. Story 3 then inherited the hazard for free because Story 2
hardened `drift-advisory.ts`'s own guard pre-emptively.

**Estimation takeaway for the next epic that adds a cross-module import between vendored/gated CLI
tools:** "add an `export`" is not behavior-neutral when the exporting module has a self-invoking
entry point — the bundler pulls the exporter's CLI call graph into every importer, so the
regression lives in the bundle, not the source. Two things follow for planning. First, size the
first cross-tool reuse in a portable-tools bundle as a small task in its own right, not a free
rider on the `export` keyword — budget for the guard/entry-point disambiguation. Second, exercise
the *vendored* form under the parity gate early: the source run passes while the shipped bundle is
broken, so a plan that only validates `tsx` behavior will not see it. Prefer side-effect-free
library modules (no top-level `main()` guard) as import targets where the tool boundary allows it,
which removes the hazard at the root rather than patching each guard.
