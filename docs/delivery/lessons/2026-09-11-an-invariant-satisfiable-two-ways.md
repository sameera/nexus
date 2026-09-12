---
date: 2026-09-11
epic: "Concepts are extracted per story, and every slice is marked learner or handoff"
source: "#456"
---

# Lesson: an invariant satisfiable two ways is satisfied the cheap way

This epic was sized M across four stories and shipped as one pull request in four commits, in
dependency order, with no re-scoping. The estimate held. Two things are worth carrying forward.

**An invariant that two mechanisms can satisfy gets the cheaper one, and nothing notices until
conformance runs.** The record's invariant 9 said a concept carries one identifier in every list
that names it. The implementation applied the merge where the stubs are written and left each
story's cached list under the name its own subagent proposed — cheaper, because rewriting a cached
list invalidates the story-text digest it is kept against. That reading is defensible and it is not
what the invariant says. It only surfaced because `/nxs.analyze` ran against the decision record and
rated it high; the fix, persisting the merge's renames as aliases, landed in the next commit. The
lesson for the next record in this area: when an invariant constrains a property that a cache can
hold stale, say which artifact carries the property, not just that it is carried. An invariant
phrased over "every list" invites the implementation to decide which lists count.

**A record's ADDRESS risk about the filed sequence was never actioned, and only the shape of the
delivery hid it.** The record noted that #547's named-focus criterion needs #546's subagent verdict
while the graph had #547 blocked by #545 alone, and asked for one of two fixes before implementation
started. Neither was applied. It cost nothing because one pull request carried all four stories in
the right order — the engineer simply built #546 first. Had this epic shipped story by story, or had
two people taken #546 and #547 in parallel, the second would have been blocked on work the graph said
was unrelated. A sequencing risk the record raises should be closed in the issue graph at the point
it is raised, because the delivery shape that makes it harmless is not a property anyone committed to.

**For estimation:** the fan-out shape here — one subagent per unit, a code check on the way back, a
session-level merge, one all-or-nothing write — came in at M and stayed there. The cost sat in the
check, not the fan-out: three of the four analyze findings across both rounds were about what the
boundary between subagent and session does and does not enforce. Budget the next fanned-out stage the
same way, and expect the conformance round to be about the seam.
