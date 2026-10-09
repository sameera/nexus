---
feature: "Concept Store Read-Back"
feature_path: docs/features/concept-read-back
epic: "Planning and Conformance Read the Concept Store"
slug: concept-read-back
created: 2026-10-06
type: enhancement
complexity: L
complexity_drivers: [three stages each gain a new input or check, the reading list must survive filing onto the epic issue and come back through the resolver, the conformance gate gains a departure kind that pull-request answers must handle]
concepts: [concept-store, grep-native-retrieval, two-store-split, conformance-gate, decision-record, distiller]
link: "#896"
record: "#902"
record_state: closed
---

# Epic: Planning and Conformance Read the Concept Store

> ⚠️ **Utilization risk:** assessed L (1–2 weeks). Fills the sprint with no slack for overruns. Watch for scope creep.

## Description

The distiller writes a concept page for every concept a closed epic touched. Each page records the concept's current behaviour, the invariants a new design must keep, the alternatives that were considered and rejected, and the pages it interacts with. No later stage reads those pages. The epic stage writes an empty reading list that nothing fills. The record stage reads concept pages only when the list names them, so it reads none. The conformance gate never looks at the store.

The result is that every planning run starts without the project's recorded reasoning. An architect can re-propose an alternative a past epic already rejected, or design something that breaks a recorded invariant, and nothing in the pipeline notices. The store costs a drain on every close and returns nothing.

This epic makes the store an input. The epic stage proposes the concept pages relevant to the intent. The record stage designs against those pages and says when a design changes one. The conformance gate flags code that breaks a listed page's invariant when the record never declared that change.

## Success Metrics

- An epic whose intent names an existing concept is filed with that concept on its reading list, with no hand edit.
- A decision record drafted for an epic with a reading list ties each guarantee that preserves a listed invariant to that page.
- A design that reverses a listed page's invariant reaches the record approver as a stated change, never silently.
- Code that breaks a listed invariant without a declared change is reported by the conformance gate before close.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

The epic stage proposes a reading list of concept pages; The architect designs against the listed concept pages; A design that contradicts a concept page says so at approval; The conformance gate flags code that breaks a listed invariant

## User Stories

### Story #897: The epic stage proposes a reading list of concept pages

- **story_type:** user
- **size:** M

**As a** delivery lead, **I want** the epic stage to propose the concept pages relevant to my intent, **so that** the stages after it start from the project's recorded reasoning.

#### Acceptance Criteria

- [ ] **Given** an intent whose words match a concept page's title or one of its aliases, **when** the epic is drafted, **then** the reading list names that page.
- [ ] **Given** a matched page that names neighbouring pages, **when** the reading list is built, **then** those neighbours are on the list and their own neighbours are not.
- [ ] **Given** more relevant pages than the cap allows, **when** the reading list is built, **then** the list holds no more pages than the cap.
- [ ] **Given** a drafted epic, **when** the reviewer reads the approval digest, **then** the reading list is shown and the reviewer can change it before anything is filed.
- [ ] **Given** a filed epic, **when** a later stage rebuilds the epic from its issue number, **then** the reading list comes back unchanged.

### Story #898: The architect designs against the listed concept pages

- **story_type:** user
- **size:** M

**As a** record approver, **I want** the architect to design against the pages on the epic's reading list, **so that** a new design keeps the invariants a past epic recorded or says that it does not.

#### Acceptance Criteria

- [ ] **Given** an epic with a reading list, **when** the decision record is drafted, **then** the architect's input includes each listed page's summary, invariants and refuted alternatives.
- [ ] **Given** a guarantee that preserves an invariant on a listed page, **when** the record is drafted, **then** the guarantee names that page and that invariant.
- [ ] **Given** an epic with an empty reading list, **when** the record is drafted, **then** the record states that no concept pages were read.
- [ ] **Given** a listed page that no longer exists in the store, **when** the record is drafted, **then** the run names the missing page and continues without it.

### Story #899: A design that contradicts a concept page says so at approval

- **story_type:** user
- **size:** S

**As a** record approver, **I want** every contradiction between the design and a listed page shown to me as a change, **so that** I approve a reversal of recorded reasoning knowingly.

#### Acceptance Criteria

- [ ] **Given** a design that contradicts an invariant on a listed page, **when** the record is drafted, **then** the record states the change, quoting the page's current statement and the statement that replaces it.
- [ ] **Given** a record that states such a change, **when** the approver reads the approval brief, **then** the change appears there as a decision to approve.
- [ ] **Given** a design that contradicts no listed page, **when** the record is drafted, **then** the record states no concept-store change.

### Story #900: The conformance gate flags code that breaks a listed invariant

- **story_type:** user
- **size:** M

**As a** delivery lead, **I want** the conformance gate to flag code that breaks an invariant on a listed page, **so that** a reversal of recorded reasoning never reaches close unapproved.

#### Acceptance Criteria

- [ ] **Given** a change that contradicts an invariant on a listed page, and a record that states no concept-store change for it, **when** the conformance gate runs, **then** it lists a departure naming the page and the invariant.
- [ ] **Given** a record that states a concept-store change for that invariant, **when** the conformance gate runs, **then** no departure is listed for it.
- [ ] **Given** such a departure on a pull request, **when** an engineer answers it, **then** it is accepted or left open exactly as any other departure is.
- [ ] **Given** an epic with an empty reading list, **when** the conformance gate runs, **then** its report states that no concept invariants were checked.

## Assumptions

- A concept page's title, alias and neighbour lines name it well enough for an intent's own words to match it.
- The decision record for this epic sets the number the reading list is capped at.

## Out of Scope

- Any retrieval index, embedding or computed graph over the concept store.
- The distiller reading engineer scratch or plans.
- Adding reading lists to epics filed before this change.
- The discovery stage reading the concept store.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #897 | none |
| #898 | #897 |
| #899 | #898 |
| #900 | #897, #899 |
