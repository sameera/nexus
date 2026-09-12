---
date: 2026-09-12
epic: "Ordering, splitting, scaffolds and the coverage check"
source: "#457"
---

# Lesson: A pass that replaces its own input needs a rerun test from the first story

Epic #457 (assessed L, seven stories on one PR) added a rewrite that replaces the plan draft whole
and is then run again over its own output. Every story's criteria were written and tested against a
single run over a fresh draft. The rerun path was only exercised at analyze, and it surfaced two
defects there: split parts read back as separate stories (scaffolding every concept an earlier part
taught and reordering the parts), and the recorded declaration dropped by a re-draft or overwritten
by a re-declare. The first was fixed in the PR; the second was deferred.

Both defects break the epic's own success metric — "a roadmap planned twice with nothing changed
produces the same slices in the same order" — which the epic named up front. The metric was
treated as a property of the arithmetic, not as a sequence of real commands a lead would run.

Next time an epic's pass writes an artifact that a later run reads back:

- Turn the idempotence metric into a test in the first story that writes the artifact: run the
  command, run it again (and run every upstream step that rewrites the same file again), and compare.
- Each later story that adds a new shape to that artifact (a split part, a scaffold, a recorded
  mapping) extends that same rerun test, so the shape is read back before the next story builds on it.
- In the decision record, name every command that rewrites the artifact, not only the pass under
  design, so the reuse rule is stated for each of them.
