---
feature: "Scope Discipline"
feature_path: docs/features/scope-discipline
epic: "An Initiative Carries the Planning Context of Its Epics"
slug: initiative-planning-context
created: 2026-10-01
type: enhancement
complexity: M
complexity_drivers: [a context record kept in the repository beside the initiative, promotion's source text widens to include the parent initiative's context, the decision-record stage reads the same context]
concepts: []
link: "#850"
record: "#961"
record_state: closed
---

# Epic: An Initiative Carries the Planning Context of Its Epics

## Description

Long planning and design sessions end in a set of stubs. The session produced decisions, deferrals and the reasoning behind the split. The stubs carry a one-line goal, an estimate and candidate story titles. So most of that reasoning is gone by the time a stub is planned. Each stub then gets planned from its own short body, and decisions already made in the session are made again, or made differently.

#705 files an initiative above a coherent set of stubs. That initiative is the natural place to keep the session's context, because every stub in the set sits under it. This epic makes the initiative carry that context. It also makes planning a stub read the context, and makes designing the resulting epic read it too. The context has two sources: the material the decomposition run itself saw (discovery decisions, the reasoning behind the split, the scope it deferred), and a design plan the lead attaches from a session held outside Nexus.

A full design plan does not fit in an issue body. So the initiative body carries a short summary and says where the full context is kept, and the full context is kept in the repository beside the initiative. That copy is meant to be temporary. Removing it once the initiative's last child closes is deferred to a stub of its own.

This epic changes one promise #705 makes. #705 says planning a stub under an initiative takes the same steps as planning one without. Here, planning a stub under an initiative also reads the initiative's context.

## Success Metrics

- A lead planning a stub under an initiative gets a draft built on the decisions the session already made, without pasting the plan into the run.
- An initiative filed from a long design session keeps the whole plan, however long the plan is.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Filing an initiative keeps the planning context that produced it; A lead attaches a design plan to the initiative being filed; Planning a stub under an initiative reads the initiative's context; The decision record reads the initiative's context

## User Stories

### Story #851: Filing an initiative keeps the planning context that produced it

- **story_type:** user
- **size:** M

**As a** lead decomposing a capability into an initiative, **I want** the initiative to keep the reasoning the run produced, **so that** the stubs under it are not planned from a one-line goal alone.

#### Acceptance Criteria

- [ ] **Given** the lead accepts an initiative for a decomposition, **when** the set is filed, **then** a full context for that initiative is kept in the repository, holding the decisions the run made, the reasoning behind the split, and the scope the run deferred.
- [ ] **Given** the initiative is filed, **when** its issue body is read, **then** the body carries a short summary of that context and says where the full context is kept.
- [ ] **Given** the decomposition consumed a finished discovery, **when** the initiative is filed, **then** every resolved decision is kept in full, with its reasoning, so it survives the removal of the discovery folder.
- [ ] **Given** the full context is ready, **when** the lead is asked to consent to filing, **then** the summary the body will carry is on screen, and nothing is kept or filed before the lead answers.
- [ ] **Given** the lead declines the initiative, **when** the stubs are filed, **then** no context is kept anywhere.

#### Notes

The full context is kept even when it is short, so every initiative has the same shape. The run writes it; the lead commits it, as with any other file the run leaves for them.

### Story #852: A lead attaches a design plan to the initiative being filed

- **story_type:** user
- **size:** S

**As a** lead who planned an initiative in a long session outside Nexus, **I want** to hand the session's plan to the decomposition run, **so that** the plan travels with the initiative instead of staying on my machine.

#### Acceptance Criteria

- [ ] **Given** the lead names a design plan when running a decomposition, **when** the initiative is filed, **then** the plan is kept, word for word, in the initiative's full context.
- [ ] **Given** the named plan does not exist, **when** the run starts, **then** the run refuses before anything is drafted and names the missing plan.
- [ ] **Given** a plan is attached, **when** the lead is asked to consent to filing, **then** the plan is named on screen beside the proposed initiative.
- [ ] **Given** a plan is attached and the lead declines the initiative, **when** the stubs are filed, **then** the plan is kept nowhere and the run says so.

#### Notes

The plan is attached at filing. Attaching one to an initiative that already exists is done by hand, as #832's was.

### Story #853: Planning a stub under an initiative reads the initiative's context

- **story_type:** user
- **size:** M

**As a** lead planning one stub of an initiative weeks after the session, **I want** the planning run to read the initiative's context, **so that** the epic is built on the decisions already made rather than re-deriving them.

#### Acceptance Criteria

- [ ] **Given** a stub that sits under an initiative with a kept context, **when** the lead plans it, **then** the run treats the initiative's summary and full context as part of what the lead asked for.
- [ ] **Given** an initiative whose context the lead wrote by hand in the same place, **when** a stub under it is planned, **then** that context is read the same way.
- [ ] **Given** a stub under an initiative with no kept context, **when** the lead plans it, **then** the run reads the initiative body alone and says that no additional context was found.
- [ ] **Given** a stub with no initiative above it, **when** the lead plans it, **then** planning proceeds exactly as it does today.

#### Notes

The context feeds the run's source text, so an item drawn from it can be cited as asked. No part of the context is copied into a filed issue body by this step.

### Story #854: The decision record reads the initiative's context

- **story_type:** user
- **size:** S

**As a** lead designing an epic that sits under an initiative, **I want** the decision-record stage to read the initiative's context, **so that** a design decision the session already made is carried into the record rather than decided again.

#### Acceptance Criteria

- [ ] **Given** an epic under an initiative with a kept context, **when** the lead runs the decision-record stage on it, **then** the stage reads the initiative's summary and full context before drafting.
- [ ] **Given** a decision in the record that the initiative's context already settled, **when** the record is drafted, **then** the record states the settled decision and its reasoning instead of presenting it as an open choice.
- [ ] **Given** an epic with no initiative above it, **when** the lead runs the decision-record stage, **then** the stage runs exactly as it does today.

## Assumptions

- A full design plan does not fit in an issue body, so the body can only summarise it.
- This epic ships after #705's stories, and adds nothing to a decomposition whose initiative the lead declined.
- Nothing writes a context for an initiative filed before this epic ships. A lead may write one by hand.
- The kept context is planning rationale, not concept knowledge, so it never reaches the concept store.

## Out of Scope

- Closing the initiative issue itself.
- Editing an initiative's kept context through Nexus after it is filed.
- Reading the initiative's context in the analyze or close stages.
- Distilling the initiative's context into concept pages.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #851 | none |
| #852 | #851 |
| #853 | #851 |
| #854 | #853 |
