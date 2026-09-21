---
date: 2026-09-20
epic: "Load the distillation stage's exceptional paths only when they apply"
source: "#714"
---

# Lesson: split a prompt by what the run loads, not by what the intent listed

The epic's own wording named six exceptional paths and asked for six loadable contracts. The design pass cut it to five, merging fix and intake into one non-epic-kind contract, and the implementation confirmed the cut was right. The reason generalizes past this epic.

Loading a contract loads its whole body, so **contract granularity is load granularity**. A split pays only where the condition that selects it actually varies between the two halves. Fix and intake are selected by the same condition from the ordinary path's point of view: an all-epic queue loads neither, under either shape. Splitting them would have bought a small saving on a path the epic was not optimizing, at the cost of a second always-preloaded description line paid by every stage in every session, and it would have broken the single entry-kind comparison table the preceding epic had just consolidated.

The estimate held because of that cut, not despite it. Five stories were planned at two M and three S and landed in one sitting with conformance clean on the first analyze pass. Six contracts would have added a sixth extraction and split a table that two documents cannot both own.

**What the next epic in this area should do differently.** When decomposing an intent that lists N things, size the decomposition against the mechanism that will carry it before taking the list at face value. The list is the lead's description of the problem, not a specification of the unit of delivery. Here the mechanism's load granularity was the thing that decided the count, and the planning stage could not have known it — the design pass could, which is why the scope edit belonged in the decision record and was recorded there as an edit to one story's scope rather than a new unit of work.

A second, smaller lesson: the always-on cost of the carrier was worth measuring explicitly. Five skills add five description lines preloaded in every session of every stage, forever, to buy a per-run saving in one stage. Counting those description bytes inside the recorded ceiling, rather than measuring only the command body, is what keeps that trade visible to whoever re-records the ceiling next.
