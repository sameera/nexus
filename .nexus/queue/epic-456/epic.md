---
feature: "Roadmap-Driven Learning"
feature_path: docs/features/roadmap-driven-learning
epic: "Concepts are extracted per story, and every slice is marked learner or handoff"
slug: concepts-per-story-and-focus-marking
created: 2026-09-11
type: enhancement
complexity: M
complexity_drivers: [fanned-out extraction that must still produce one shared concept vocabulary, a judgement mark made against a focus recorded in the learner's own words, adoption of the plan contract epic #407 shipped]
concepts: []
link: "#456"
record: "#550"
record_state: closed
---

# Epic: Concepts are extracted per story, and every slice is marked learner or handoff

## Description

Epic #455 resolves a roadmap and records what the learner already knows and what they came to learn. This epic is the reading pass that comes next. It reads each story once and writes two facts onto the slice that story becomes. The first fact is the concepts the slice introduces and assumes. The second is whether the learner builds the slice or hands it off. What the pass writes is a stub, not a lesson. The teaching session that epic #407 shipped already reads a plan of slices, each with a story, a learner-or-handoff mark and a list of concepts, and decision record #469 requires the planning half to adopt that contract rather than define a second one.

Each story is read by its own extraction unit, which returns a short structured list. The planning session then holds only those lists. It never holds the story text, records or diffs the lists came from, because a session that carried every body could not plan a roadmap of any size. Lists from different stories must name a shared concept the same way. Subtraction and ordering in #457 match concepts across stories, and decision record #478 left the concept vocabulary to this epic.

Every slice is marked as one the learner builds or one handed off to a coding-agent session the learner runs separately. The mark is a judgement made against the focus the learner recorded, and it is the most consequential decision this stage makes. A learner who named no focus has the whole roadmap in focus, so none of their slices is handed off. A handoff slice carries no concepts and no sources, because it teaches nothing. It carries the story it builds, and the other slices of its epic are the slices it must not touch.

## Success Metrics

- The planning session holds the extracted lists and none of the story text, records or diffs they came from.
- A concept that two stories need carries one identifier in both of their lists.
- Every slice in a planned roadmap carries exactly one mark, learner or handoff.
- A roadmap whose learner named no focus produces no handoff slice.
- The teaching session epic #407 shipped reads every mark and concept identifier this pass writes without renaming either.

## Personas

Per `docs/product/context.md`. The learner in this epic is the canonical primary persona, here in the role of someone about to be taught rather than someone running the delivery pipeline.

## Smallest Usable Version

Per-story concept extraction runs as its own unit and returns a structured list; A stub declares its story, its mark and its concepts in the plan contract the teaching session already reads; Every slice is marked against the learner's recorded focus; A handoff slice carries the story it builds and no concepts or sources.

## User Stories

### Story #545: A stub declares its story, its mark and its concepts in the plan contract the teaching session already reads

- **story_type:** system
- **size:** S

**As a** learner, **I want** every stub to state its story, its mark and its concepts in the terms the teaching session already reads, **so that** the plan I approve can be taught without anyone translating it.

## Acceptance Criteria

- [ ] **Given** any slice, **when** its stub is written, **then** the stub names exactly one story.
- [ ] **Given** any slice, **when** its stub is written, **then** the stub carries a mark of learner or handoff, and a stub carrying any other value is refused.
- [ ] **Given** a learner slice, **when** its stub is written, **then** the stub lists the concepts that slice introduces and the concepts it assumes.
- [ ] **Given** any stub, **when** it is written, **then** it carries no lesson prose.
- [ ] **Given** a stub this pass wrote, **when** the teaching session epic #407 shipped reads its mark and its concepts, **then** it accepts both without renaming or translating either.

## Notes

Decision record #469 carries the risk that the plan contract was defined by its only consumer, and it requires the planning half to adopt that contract rather than re-derive it. The shipped plan holds one concept list per slice. The assumed concepts are new, and #457 needs them for subtraction and the coverage check. A learner stub is born without pinned sources, because #459 pins those when its epic is promoted.

### Story #546: Per-story concept extraction runs as its own unit and returns a structured list

- **story_type:** system
- **size:** M

**As a** learner, **I want** each story's concepts extracted by its own unit that returns a short list, **so that** a roadmap of any size can be planned without one session holding every story's full text.

## Acceptance Criteria

- [ ] **Given** a story in the roadmap, **when** its extraction runs, **then** it returns a structured list of the concepts that story introduces and the concepts it assumes.
- [ ] **Given** a roadmap of several stories, **when** extraction runs, **then** each story is read by its own unit, and no unit reads another story's text.
- [ ] **Given** extraction has finished for every story, **when** the planning session continues, **then** it holds the returned lists and none of the story text, records or diffs they came from.
- [ ] **Given** two stories that need the same concept, **when** both lists are returned, **then** that concept carries one identifier in both lists.
- [ ] **Given** a story whose extraction fails or returns no readable list, **when** the pass ends, **then** the pass writes no stubs and names that story, rather than planning the roadmap without it.

## Notes

Decision record #478 kept concept identifiers out of the interview so that one idea would not get two names. The identifiers first exist here, so this story is where one name per concept is decided.

### Story #547: Every slice is marked against the learner's recorded focus

- **story_type:** user
- **size:** M

**As a** learner on a roadmap that also builds things I did not come to build, **I want** each slice marked as one I build or one handed to a coding agent, **so that** I spend my time on what I came to learn.

## Acceptance Criteria

- [ ] **Given** a planned roadmap, **when** the pass marks its slices, **then** every slice carries exactly one mark, learner or handoff.
- [ ] **Given** a recorded focus that leaves part of the roadmap outside it, **when** the pass marks the slices, **then** a slice whose story serves what the learner came to learn is marked learner, and a slice whose story does not is marked handoff.
- [ ] **Given** a learner who named no focus, **when** the pass marks the slices, **then** every slice is marked learner.
- [ ] **Given** the pass marking slices, **when** it needs the learner's focus, **then** it reads the focus the interview recorded and asks the learner nothing.
- [ ] **Given** a slice marked handoff, **when** the pass ends, **then** nothing has been built and no coding-agent session has been started.

## Notes

The mark is a judgement rather than a heuristic, so this story fixes what the mark is decided against and not a rule for deciding it. A person reviews the marks at the gate planned as #458. Decision record #478 names the failure the no-focus criterion guards against: a reader that treats "no focus" as "nothing in focus" hands off the entire roadmap.

### Story #548: A handoff slice carries the story it builds and no concepts or sources

- **story_type:** system
- **size:** S

**As a** learner, **I want** a handoff slice to carry only the story it builds and the slices it must not touch, **so that** the coding agent builds that one story and leaves my slices for me.

## Acceptance Criteria

- [ ] **Given** a slice marked handoff, **when** its stub is written, **then** the stub carries no concepts and no sources.
- [ ] **Given** a slice marked handoff, **when** its stub is written, **then** the slice is given no lesson, so it never becomes a page in the workbook.
- [ ] **Given** a slice marked handoff, **when** the slices it must not touch are worked out, **then** they include every other slice of the same epic.

## Notes

The handoff prompt shipped in #464 already works out the sibling slices from the plan, as every other slice in it. For a roadmap of one epic that is the same set. Whether a handed-off story's concepts are extracted and then dropped, or never extracted, is left to the decision record. The coverage check planned as #457 fails a learner slice that assumes such a concept either way.

## Assumptions

- The roadmap epic #455 resolves carries every story's text and dependency edges, so this pass reads nothing further from the issue graph.
- The interview epic #455 builds records the learner's focus in their own words, and records the whole roadmap as in focus when the learner named none.
- A slice is one story at this stage, and splitting a story into several slices happens in #457.
- An epic that is still unplanned under an initiative contributes no stories, so it produces no slice and no extraction.
- The pass runs in the planning phase and loads none of the lesson-writing references.

## Out of Scope

- Subtraction, ordering, slice splitting, scaffold insertion, placing each handoff before the slice it unblocks, and the coverage check, which are planned as #457.
- The gate that approves the marks, and the home page that shows handed-off slices, which are planned as #458.
- Pinning a learner stub's sources, which is planned as #459.
- Writing the handoff prompt and pausing the session, which #464 already shipped.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #545 | none |
| #546 | #545 |
| #547 | #545 |
| #548 | #547 |
