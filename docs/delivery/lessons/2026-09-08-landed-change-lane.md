---
date: 2026-09-08
epic: "A landed-change lane for design changes that shipped without planning"
source: "#483"
---

# Lesson: a Key Decision with no acceptance criterion and no invariant number went unbuilt

## Estimate versus actual

Assessed **L** on four drivers: six stories with four sized M, a third entry kind touching
discovery and every phase of the drain, surgical edits to two command definitions over a thousand
lines each, and a fix-lane refactor that had to leave its entries byte-identical. The shipped
change is close to the assessed size, and it landed in one branch with seven commits, each closing
its own story in `blocked_by` order.

## What went unbuilt, and why nothing caught it

Decision record #504 named a rule under Key Decisions and assigned it to story #484: the
epic-classification refusal and the number-collision refusal move out of `/nxs.fix` into the
shared `nxs-landed-reference` skill, and a same-number collision refuses across kinds while a
same-kind re-record rewrites in place. Story #484 shipped the shared skill's four sections, but
neither refusal moved into it, and `/nxs.intake` was built with no equivalent check at all.

Two gates that should have caught this both missed it for the same structural reason. `/nxs.analyze`
checks a story's acceptance criteria, and story #484's acceptance criteria describe the four
sections the skill must expose, not the two refusals the record's prose separately named. The
record's own invariant spot-check also missed it, because this rule lives in the Key Decisions
section, not in one of the twenty numbered invariants, and only the numbered invariants get
spot-checked against the diff. A rule stated once, in prose, attached to a story by name rather
than by acceptance criterion or invariant number, has no surface that verifies it landed.

**When a decision record assigns a Key Decision to a story, restate the load-bearing half of that
decision as an acceptance criterion or a numbered invariant on that story.** A decision that lives
only in prose, however clearly it names its owning story, is invisible to both the conformance
gate and the invariant spot-check, and the only remaining net is a human close review reading the
diff line by line.

## What the decomposition got right

Splitting the shared reference and range rules into a skill loaded by section (checkout-role gate,
reference resolution, range resolution, qualification) let `/nxs.fix` keep its own interleaved
epic/collision refusal without forcing `/nxs.intake` through the same interleaving. Building that
skill first, in story #484, meant every later story could load it rather than restate it, and nine
of the ten in-flight decisions captured during implementation were about keeping one rule stated in
exactly one place — the diff review found no case of the two lanes stating the same rule twice.
