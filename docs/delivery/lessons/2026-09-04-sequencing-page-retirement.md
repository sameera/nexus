---
date: 2026-09-04
epic: "Retire the Sequencing Page Into Issue State"
source: "#218"
---

# Lesson: A retirement epic's real work is discovery, and it sizes nothing like the diff

Epic #218 was sized S on the strength of an accurate driver list — documentation-only, no code
paths touched, three independent single-surface stories — and it landed as one 99-line deletion
plus committed scratch. The estimate held. What the estimate did not describe is where the effort
actually went, and that gap is worth carrying into the next epic of this shape.

Almost none of the work was in the diff. Three stories produced one deleted file between them.
The effort was in reading every line of the retired page and deciding, per line, whether its
content already existed somewhere durable. That decision could not be made from the page — it
required opening eight stub issues, reading their bodies, and querying eight `blocked_by` edges.
Five of the eight stubs already carried their reasoning; two verdicts named items that had never
been filed as issues at all. Better than half the page was already redundant, and nothing in the
page said so.

**The estimate should name discovery as the driver, not the surface count.** "Three independent
single-surface stories" describes the diff, and the diff was trivial. A retirement epic's cost
scales with the number of destinations that must be *read to decide nothing is needed*, not with
the number that are written. The next epic in this area should size on "how many issues must be
opened and compared", and should expect the majority of those comparisons to end in "already
present, leave it alone".

**Decomposition held up well.** Splitting move-the-rationale, change-the-verdicts, and
delete-the-file gave three stories with genuinely independent verification, and each closed
against evidence rather than assertion. Keep that shape. The one refinement: story #403 was
written as if four issue-state transitions were pending, when discovery found one. Framing such a
story as "reconcile the verdicts with reality" rather than "apply the verdicts" would have made
the found-nothing outcome a success rather than something to explain at close.

**Ephemeral scratch was the right home for the audit.** The line-by-line accounting that proves
no rationale was lost is the kind of artifact that begs to be committed, and committing it would
have quietly rebuilt the surface the epic was deleting. Doing that audit in branch scratch gave
the reviewer everything at review time and left nothing behind to reconcile later. Retirement
epics should assume their accounting artifact is ephemeral by default.

**Watch for unrelated fixes riding a documentation branch.** A pre-existing red suite on `main`
was cleared on this branch; `main` fixed it independently and the merge left the commit
contributing nothing. On an epic whose entire diff is one deletion, a stray commit is a large
fraction of the history and costs a reader real time to dismiss. On a documentation-only branch,
push the unrelated fix separately.
