---
date: 2026-09-10
epic: "One Epic Receipt, Aggregated From the Story Verdicts"
source: "#212"
---

# Lesson: an epic planned to land before its consumer will absorb the consumer

Epic #212 was planned as a producer. It derives the epic receipt, and epic #213 was to be the
consumer that reads it. The record's own risk section said so, and set a mitigation for it: warn an
adopter in the changelog that a receipt nothing reads is not a broken feature.

The mitigation was never needed. Release 0.18.0, inside this epic, shipped the close gate's
aggregate reader. The consumer arrived early because the reader is small once the shared helper
exists, and because leaving it out would have shipped an artifact no test could exercise end to
end. The epic grew from four planned releases to five.

Two things follow for the next epic that splits a producer from its consumer.

Size the producer epic on the assumption that the thin half of the consumer comes with it. A reader
that is a few lines against a helper the producer already built is cheaper to land now than to
schedule, and the producer has no end-to-end test without it. Epic #212 estimated M and shipped M,
so the absorption cost nothing here, but it consumed the slack.

Write the risk mitigation as a decision to revisit, not as a task to perform. This record committed
to a changelog note that became false during implementation. A mitigation phrased as a task gets
either performed wrongly or dropped silently. A mitigation phrased as a condition to re-check gets
answered.

One estimating note that is not about scope. Four of this epic's deviations from its record were
unmet elaborations rather than refuted decisions: an unexposed command-line flag, an unstated
convention, an unwritten changelog note. Three of the four sit in the part of the record that
describes multi-repository behaviour, which no case exercises yet. A record that decides for a
setting the epic cannot test will deviate in that setting. Plan the record's scope to the setting
the epic can actually verify.
