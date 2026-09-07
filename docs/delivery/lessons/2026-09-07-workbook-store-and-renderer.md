---
date: 2026-09-07
epic: "The workbook store, and the renderer that turns lesson markdown into pages"
source: "#405"
---

# Lesson: An invariant with no implementing code is the thing conformance actually finds

This epic was assessed L — six stories across two independent halves, three of them M — and it
landed in nine commits with every acceptance criterion met on the first conformance pass. The
estimate held. What is worth carrying forward is not the sizing but the shape of what the gates
caught, because the same shape will recur in every epic this feature ships.

Three of the six in-flight decisions exist because an invariant the record stated had nothing in
the code holding it up. Invariant 6 said a workbook lives in its member repository, and
`createWorkbook` took whatever root a caller handed it. Invariant 15 said a failed render leaves
no partial or stale output, and a failed render left the previous render in place. Invariant 9
said nothing writes a personal record until git confirms the path is ignored, and one of the two
write paths — the append that resolves a handoff — did not ask. None of these was a story that
was missed or an acceptance criterion that was wrong. Every story's criteria were met while the
invariant underneath it was unenforced, because the criteria describe what a learner sees and the
invariants describe what must never happen. A gate that only reads acceptance criteria would have
passed all three.

The practical consequence for the next epic in this area: write the record's invariants as a
checklist of things to point at in code, and expect roughly one in six to have no implementing
code at the point the story that "covers" it is complete. Budget for that. The conformance pass
found two of these before merge and the engineer's own scratch found the third, which is the
system working — but each of them was a fix commit after the feature commits, not part of them.

The second lesson is about the record itself. Its generated-pages decision named four properties
of a page, and the fourth — a check mode that catches drift — had no implementing code when the
first conformance pass ran. The choice at that point was to ship the check mode or to revise the
record to drop it, and shipping was right. But a key decision that bundles four properties into
one paragraph is a decision whose fourth property is easy to lose, because no story's acceptance
criteria named it. A record enumerating four properties should expect the last one to be the one
nobody implements, and either split it or expect to pay for it at the gate.

The third is smaller and mechanical. The epic's final commit landed roughly 7,250 lines of
generated vitest coverage output at the repository root, and it merged. It merged because it rode
a commit whose message described a documentation change, and because the ignore rules covered a
different coverage path than the one the tool wrote to. A repository that commits generated output
deliberately — as this feature now does for workbook pages — needs its ignore rules to be tight
about the generated output it does *not* commit, or the distinction stops being legible in a diff.
