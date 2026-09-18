---
date: 2026-09-18
epic: "The compressed pages a learner returns to"
source: "#481"
---

# Lesson: say what an invalid artifact does, and where the migrated artifacts live

The epic was sized M with one story, and it shipped as one pull request in one day. The estimate
held. The decision record anticipated every invariant the build needed. Close found two gaps, and
both were cases the record never stated, not choices it got wrong.

First, the record said a *missing* reference page never blocks a lesson. It did not say what an
*invalid* page does. The build had to decide that on its own, and it chose to refuse the sitting,
because the render is all-or-nothing. When a record makes an availability promise such as "X never
blocks Y", it should also state the invalid-X case beside it. Otherwise the implementer settles it
alone.

Second, the record required every affected workbook to be re-rendered in the same change. That
assumed the affected workbooks live in this repository. They live in adopter repositories, which
no change here can reach, so the rule held here with nothing to do. When a record schedules a bulk
migration of generated output, it should name the repositories that hold that output. If they are
out of reach, the release note is the migration.

A third, smaller point: the analyze receipt went stale only because trunk was merged into the
branch to settle a version-number conflict. The local currency check counts every commit after the
receipt, so a trunk merge alone reads as unanalyzed code. Running `/nxs.analyze` after the final
trunk merge, not before it, avoids a waiver at close.
