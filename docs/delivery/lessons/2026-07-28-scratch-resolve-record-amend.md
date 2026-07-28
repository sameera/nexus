---
date: 2026-07-28
epic: "The Issue Number Is the Key: Resolvable Scratch, One Name Per Story, an Amended Record"
source: "#157"
---

# Lesson: A mid-flight re-scope that cancels filed stories needs its own withdrawal mechanism — build that first

This epic was originally filed around `/nxs.pr` — a new command that would derive a PR-body
rationale block from branch scratch. Five stories (#158-#162) were filed against that design
before the decision record refuted it outright: no new carrier, no PR-body block, committed
scratch stays the only mechanism. The five stories were labelled `wontfix` and closed, but the
epic resolver — which had no concept of a withdrawn story — kept materializing all five as live
scope, because closure alone reads identically to "delivered". The fix (#166, later widened by
#168 to also read the closure reason) had to ship *inside the same epic* that triggered it,
which meant the resolver was briefly wrong about its own governing epic's shape for a week.

The lesson for the next epic that pivots mid-flight after stories are filed: withdrawing a story
is not free once it has an issue number and sub-issue attachment — re-scoping produces exactly
the "cancelled work that looks like live scope" problem this epic had to build a fix for. If a
design is likely to be refuted before implementation starts (a `/nxs.decision-record` gate exists
for exactly this reason), prefer catching it there over filing stories early to keep momentum.

One thing that worked cleanly: story #168 needed the decision record's own withdrawal-signal
decision revised after #163 was already approved and closed. `/nxs.decision-record --revise`
reopened it, recorded what was superseded and why, and re-closed it — all without touching the
epic's other four stories or invalidating any hash already stamped on them. A record revision
mid-epic is now a known-cheap operation; no need to over-plan around getting Key Decisions
exactly right the first time when the revise path exists.
