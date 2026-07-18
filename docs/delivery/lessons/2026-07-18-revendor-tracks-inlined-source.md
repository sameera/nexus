---
date: 2026-07-18
epic: "Parameterized Docs Root"
source: "#74"
---

# Lesson: The re-vendor trigger is "touched inlined source or `.claude/`", not "touched the generator"

The naive mental model for this epic was: the portable-tools bundle only needs
re-vendoring when the story that changes the generator lands (Story 2). That model
is wrong, and the parity fingerprint gate proves it early.

esbuild inlines `@nexus/workspace/resolve` and `.../status` into the vendored
`derive-entry-diff.mjs` and `nexus.mjs`. Story 1 changed exactly that resolver and
status source — so it staled those bundles' fingerprints before the generator was
ever touched. Story 3 edited a `.claude/` skill, which stales the
`claude-components` payload hash. Both reddened the gate one commit after landing.

**Estimation takeaway for the next epic that touches shared/inlined libs or
`.claude/`:** budget a re-vendor step on *every* story that edits inlined source
or `.claude/`, not one lump re-vendor pinned to the "obvious" story. The cost is a
`pnpm nexus:vendor-tools` run plus a fingerprint-pin commit per such story — small
per story, but invisible if you plan it as a single end-of-epic chore, which
leaves the fingerprint gate red across intermediate commits and fights the
full-suite-every-story rigor. Sequence it as: change source → re-vendor → commit,
per story.
