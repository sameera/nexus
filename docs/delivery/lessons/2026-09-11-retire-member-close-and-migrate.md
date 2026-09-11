---
date: 2026-09-11
epic: "Retire the Member Close-and-Migrate Path"
source: "#215"
---

# Lesson: an epic held behind four predecessors ships its safe half and strands its own acceptance criterion

This epic was sized M and decomposed into two stories. Both stories were implemented and both
pull-request halves merged. One acceptance criterion is still unmet, and the reason is sequencing
rather than effort.

Record #514 decided that the deletion of the close-and-migrate path and the lift of the member
refusal are one change in one release, and that neither half ships alone. The same record then
carried a BLOCKER risk saying the epic must not merge until #213 and #214 are in the tree, because
the lift hands over to a flow those epics deliver. Those two statements pull in opposite directions
once implementation starts before the predecessors land. The engineer resolved the conflict the safe
way, shipping the deletion and holding the lift, and recorded the reasoning in a decision stub on the
branch. That was the right call at that moment. The cost is that the epic closed with a criterion
unmet and a deviation to explain, and the lift now needs its own epic.

What the next epic in this area should do differently:

- A dependency stated as a release-ordering risk does not constrain implementation. State it as a
  blocking issue edge on the epic, so the epic cannot start before the flow it hands over to exists.
- When a record says two halves must ship together, the decomposition should not produce a story that
  can be finished with one half. Story #511 bundled the deletion and the lift into five acceptance
  criteria and was reported as done with four met.
- The estimate was not the problem. M matched the work that shipped. The sequencing was the problem,
  and no estimate would have caught it.

One thing worked well and should be repeated. The engineer wrote a decision stub at the moment of
choosing to hold the lift, naming the record's own risk as the reason. That stub is what made this
close a five-minute explanation rather than an investigation.
