---
date: 2026-08-23
epic: "Collapse the component-invoked TypeScript capabilities into verbs on one named executable"
source: "#247"
---

# Lesson: a blocked_by chain across stories does not predict the delivery unit

The epic decomposed into five stories with an explicit sequencing table (`#273`/`#274` blocked by
`#272`, `#276` blocked by both), which read as an intent for incremental, independently reviewable
landings. What actually shipped was one PR (#278) carrying all five stories' code as a single
2,800-line commit, reviewed and merged as one unit. The blocked_by graph was real and useful — it
governed *build order* inside that one PR (the registry pattern from #272 had to exist before
#273/#274 could extend it) — but it never became five separate review increments, because the five
capabilities share one file (`nexus-cli.ts`'s `REGISTRY`) and one parity harness whose facets grow
incrementally across the same stories. Splitting the PR would have meant each intermediate PR
shipped a registry with some verbs still missing their parity coverage.

For the next epic with this shape — several stories whose stated purpose is "extend the same shared
structure another story establishes" — size the epic's *story* decomposition around what will
actually become separate GitHub issues for planning/tracking granularity, but expect (and tell
the lead to expect) a single PR at delivery time rather than five. Filing five story issues bought
five clean acceptance-criteria checkpoints and five closeable units on the epic's sub-issue gate;
it did not buy five smaller, independently mergeable diffs, and estimating review effort as if it
would have overstated the coordination cost.
