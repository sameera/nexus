---
title: "Pinned Lesson Sources"
aliases: ["pinned sources", "source pinning", "sources pinned at record approval", "lesson grounding", "exemplar file", "pin workbook sources"]
touches: ["teaching-plan", "plan-field-ownership", "plan-re-approval", "decision-record", "record-digest"]
last_updated_by: "#459"
status: active
verification: verified
---

# Pinned Lesson Sources

Each slice the learner builds carries the material its lesson is written from: one decision-record section, one exemplar file in the codebase, and the refuted alternative that section's decision states. The design stage pins these sources when it approves the epic's decision record. A lesson is written before the learner builds the story, so the sources are fixed before any lesson in that epic exists.

## How It Works

Sources cannot be known when the plan is approved, because they come from a decision record that does not exist until the slice's epic is designed. The design stage closes the record, and then it pins the sources for every workbook that teaches that epic. A revised record that is closed again runs the same step.

The step checks each source against material that already exists. The named section must be a heading the record carries that holds no other section. A refuted alternative must be one that its decision states. A refuted alternative must be named whenever the named section itself states one, and it is absent otherwise. The exemplar must be one file already in the codebase, because the story's own code does not exist yet.

Approval is read live, through the same fetch the record digest uses, from the checkout that holds the pipeline. In a workspace that checkout is the hub, while the plan stays in the member.

## Key Invariants

1. Only slices the learner builds are pinned; a handoff slice or a scaffold never carries sources.
2. Every unpinned learner slice of one epic is pinned together, or none is pinned.
3. A slice that already carries sources keeps them unchanged when pinning runs again.
4. An epic with no decision record, or with a record that is not approved, pins nothing and raises no error.
5. A record closed as not planned is not approved, so it pins nothing.
6. Sources are absent until pinned; no placeholder is ever written, including for a refuted alternative the record does not state.
7. A refused pin writes nothing to the committed plan.

## Integration Points

- [teaching-plan](teaching-plan.md) — the committed plan whose learner slices hold the pinned sources.
- [plan-field-ownership](plan-field-ownership.md) — assigns the sources field to the design stage and keeps it absent until pinned.
- [plan-re-approval](plan-re-approval.md) — carries a slice's pinned sources into the new plan while the slice stays one the learner builds.
- [decision-record](decision-record.md) — the approved record the sources name, whose close triggers the pinning.
- [record-digest](record-digest.md) — the record fetch whose approval reading the pinning step reuses.

## Decision Log

### 2026-09-17 — #459 — Sources are pinned on the plan slice when the decision record is approved

A slice's lesson needs grounding that the plan cannot hold at approval, so the design stage now pins it on the slice when the epic's decision record is approved. The sources live on the committed plan slice, because a second committed file describing one plan can disagree with the plan without anyone noticing. Pinning happens at record approval and not at close, because a lesson is written before its story is built and close waits for every story to merge. Close-time pinning would always land after the lessons it exists to ground. Approval is read through the record digest's fetch, so there is one approval rule and not a second one that can drift. The exemplar is a file already in the tree and not the story's own code, which corrects story #625's third acceptance criterion. Refuted alternative: keep close as a backstop that pins later. It lost because close would pin sources onto slices whose lessons were already written without them.
