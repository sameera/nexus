---
date: 2026-09-13
epic: "The plan is approved at a decision-grade gate and renders as a home page"
source: "#458"
---

# Lesson: two analyses of the same epic disagreed, and the weaker one was the last word

This epic was sized L and shipped as seven stories in one pull request over two days. The size held.
The lesson is not about the estimate; it is about what the conformance gate saw.

`/nxs.analyze` ran twice. The first run, against the pull request, found a medium-severity defect: on a
handoff return the session skips the fence probe when the next story slice carries no pinning test, and
then tells the learner the fence is intact. The second run, over the locally materialized epic, reported
zero medium findings and did not mention it. The defect was still in the code. Close found it again only
because the close-from-diff pass reads the record's invariants against the shipped code rather than
trusting the newest receipt.

Two things follow for the next epic in this area.

**A later analysis is not a better one.** Close reads the newest trusted receipt, which is the right rule
for currency and the wrong rule for coverage. When an epic is analysed more than once, the findings do not
accumulate — the last run's list replaces the earlier one, and anything only the earlier run saw is gone
from the gate's view. A lead who re-runs analysis after a fix should expect to re-check the findings the
previous run raised, because nothing in the pipeline carries them forward.

**A record with forty-nine invariants outruns what one analysis pass will check.** Record #591 is a good
record: the invariants are concrete and testable, and they are what let close identify nine deviations
precisely. But a single conformance pass cannot hold forty-nine invariants against a 2,600-line diff with
even coverage, and the two runs picked different subsets. The next epic of this size should either split
the conformance check along the record's own sections, or accept that the invariant list is a review
checklist for a human rather than a gate a single pass can clear.

Two of the nine deviations shipped as defects rather than as decisions — the unchecked fence and a gate
digest that drops the story line on a continued split part. Both were visible in an analysis receipt
before the merge, and both were deferred at close rather than fixed before it. That is the right call for
a merged pull request, but it is worth noticing that the gate which exists to catch exactly this did
catch it, and the information did not survive to the point where someone would act on it.
