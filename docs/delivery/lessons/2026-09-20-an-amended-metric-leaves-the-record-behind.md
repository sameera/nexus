---
date: 2026-09-20
epic: "State each distillation rule once, at the point it acts"
source: "#713"
---

# Lesson: an amended success metric leaves the decision record's prose behind

The epic's first success metric was amended after decision record #720 was approved. The metric
moved from initiative #709's 8,000–10,000 word band to "no more than 11,600 words", with a sentence
explaining that this epic carries only four of the initiative's six consolidation items so the
original band is not reachable. The record was not revised to match. Its Key Decision on the metric
still reads "The target band of 8,000 to 10,000 words is unchanged."

Nothing broke, because the record's *invariant* 11 — the enumerated constraint the conformance gate
actually checks — fixes the counting method and the 13,035 baseline and deliberately does not
restate the band. The shipped 11,530 words satisfies the invariant and the amended metric. But two
stages in a row had to stop and reconcile the two documents by hand: `/nxs.analyze` stated the
disagreement as an assumption in its verdict, and `/nxs.close` recorded it as the epic's only
deviation and amended the record at close.

The lesson for the next epic in this area: when a success metric is amended after the record is
approved, revise the record in the same sitting (`/nxs.decision-record --revise`) rather than
relying on the invariant to carry the true version. An invariant that is right while the prose beside
it is wrong still costs every downstream stage a judgement call, and each one has to make it alone.

The sizing held up well otherwise. Five stories at complexity M, sequenced so the recap removal ran
last and started from the relocate-or-delete inventory the earlier stories wrote down, landed in one
run with no rework and a conformance pass clean at every severity. The mitigation named in the
record's second ADDRESS risk — implement the two overlapping-deletion stories in one sequenced run —
is worth repeating whenever two stories delete from the same document.
