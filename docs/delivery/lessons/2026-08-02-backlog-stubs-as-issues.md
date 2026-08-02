---
date: 2026-08-02
epic: "Backlog Stubs Become GitHub Issues"
source: "#185"
---

# Lesson: a record that edits story scope leaves the story issues behind

## The record superseded three acceptance criteria, and nothing made the issues follow

Decision record #192 was approved with five explicit scope edits: promotion populates the stub in
place rather than closing it, slug lookup is retired, and the backlog surfaces once rather than per
feature. Those edits invalidated four acceptance criteria already written onto story issues #188 and
#190 — including one, "the source stub issue is closed as completed", that the record's own invariant
4 forbids outright.

The code followed the record. The issues did not. Nothing in the pipeline noticed until
`/nxs.analyze` ran at the end and reported it as a HIGH finding, at which point the lead hand-amended
both issue bodies and the epic body before close would run against criteria the build contradicted.

**What the next epic in this area should do differently:** treat "which story ACs does this record
supersede, and have they been re-filed" as a step of `/nxs.decision-record`, not a discovery for
`/nxs.analyze`. The record already writes a per-story Story Coverage section naming its scope edits —
that section is the exact worklist, and it is produced at the moment the edits are decided. Amending
the issues then costs minutes; amending them at analyze time costs a re-analysis and a waived
conformance gate, which is what this epic actually paid.

## An absolute invariant met two file classes nobody had in mind

Invariant 17 read: the file deletion lands only after **every** committed reference has been
repointed. Written that way it was clean and checkable. In this repository it met two kinds of file it
could not have meant — a derived anchor the distillation PR regenerates, and a frozen decision archive
whose whole value is recording what was true at the time. Satisfying the invariant literally would
have hand-edited a generated file and falsified an audit trail.

Both were resolved correctly at implementation time, with a stub each, and both surfaced at close as
deviations. That is the system working — but the cost was two deviations on a close record for
something the record could have said in one clause. **Next time:** when an invariant quantifies over
"every committed X", state its exclusions where it is written. Generated surfaces and frozen archives
are the two that recur here.

## Estimates were sized against a moving inventory

The epic was planned against 22 proposed and 12 promoted backlog blocks. The record corrected 12 → 13
at approval; the migration ran against 24 proposed. Two blocks were appended to the committed
backlogs between planning and implementation — by the ordinary act of deferring scope, which is what
those files were for.

Nothing broke: the migration is batch-driven and counted what it found. But the record's risk section
named "twenty-two irreversible creations in one run" as the thing to rehearse, and the rehearsal
figure was wrong by two before it was run. **For any future migration of a live surface, take the
count at the migration commit, not at planning**, and phrase the risk as "every block present at
migration time" rather than a number.

## Sizing held, and the record predicted where it wouldn't

Four S stories and one M, complexity M overall. The four S stories landed as S. Story #188 was the one
the record flagged in advance — "this is the change that most pressures that story's sizing" — because
in-place promotion needed an update path the epic filing surface did not have. It did absorb the most
work.

Worth keeping: the record's ADDRESS risks named the sizing pressure on a specific story rather than on
the epic. That is a more useful signal than a complexity rollup, and it was accurate here.
