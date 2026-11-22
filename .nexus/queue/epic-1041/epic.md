---
feature: "Unattended Epic Implementation"
feature_path: docs/features/unattended-implementation
epic: "nexus implement --retroactive builds an epic that has no decision record"
slug: implement-retroactive
created: 2026-11-21
type: enhancement
complexity: M
complexity_drivers: [three stories, one of size M, as-built record runs after the build and depends on its output]
concepts: ["unattended-epic-implementation", "approval-brief", "decision-record", "nexus-pipeline", "publishing-config-resolution", "hld-build-input", "razor-enforcement"]
link: "#1041"
record: "#1051"
record_state: closed
---

# Epic: nexus implement --retroactive builds an epic that has no decision record

## Description

Today `nexus implement` refuses an epic that needs design and has no decision record. A lead who wants to build such an epic unattended has to write and approve a record first, even when the design is small enough to settle during the build.

The `--retroactive` flag lets the lead choose to build without a record. The run asks the agent to plan its approach before the first story, but does not stop when the agent skips the plan. After the stories are built, the run writes a decision record that describes the design as it was built, and approves that record itself. The record says that the run made and approved those decisions, so it never reads as if the lead had decided them.

The flag is an explicit choice. A run without the flag keeps every decision-record guardrail it has today: it refuses an epic that needs design and has no record, it refuses a decision record that is still open, and it treats an approved record as binding.

## Success Metrics

- A lead can build an epic that needs design and has no decision record with one `nexus implement` command.
- Every run without the flag starts, refuses and builds exactly as it does today, except that a configured implementing model runs its implementation stage and fix rounds.
- Every completed retroactive run leaves the epic with an approved decision record that names the run, not the lead, as the party that decided and approved it.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Build an epic with no decision record when the lead passes --retroactive; Ask the agent to plan before the first story, without enforcing it; Write and approve an as-built decision record after a retroactive build

## User Stories

### Story #1042: Build an epic with no decision record when the lead passes --retroactive

- **story_type:** user
- **size:** S

**As a** lead, **I want** to run `nexus implement <epic> --retroactive` on an epic that has no decision record, **so that** I can build it unattended without writing a record first.

#### Acceptance Criteria

- [ ] **Given** an epic that needs design and has no decision record, **when** the lead runs `nexus implement <epic> --retroactive`, **then** the run builds the epic's stories instead of refusing.
- [ ] **Given** an epic that needs design and has no decision record, **when** the lead runs `nexus implement <epic>` without the flag, **then** the run refuses exactly as it does today.
- [ ] **Given** an epic whose decision record is open, **when** the lead passes the flag, **then** the run refuses as it does today.
- [ ] **Given** an epic with an approved decision record, **when** the lead passes the flag, **then** the run builds from the record as binding and says that the flag was not used.
- [ ] **Given** a retroactive run, **when** it opens its pull request, **then** the pull request states that the epic was built without a decision record.

### Story #1043: Ask the agent to plan before the first story, without enforcing it

- **story_type:** user
- **size:** M

**As a** lead, **I want** a retroactive run to ask the agent for a plan before it builds, **so that** the design is thought through even though no record approved it.

#### Acceptance Criteria

- [ ] **Given** a retroactive run, **when** the stories have not yet been built, **then** a planning session writes a plan of the approach before the implementation stage starts, on the planning model of the run's harness (by default Opus for Claude Code), and the implementation stage receives that plan as guidance.
- [ ] **Given** a retroactive run whose planning session fails or produces no plan, **when** the stories are built, **then** the run continues to review as any other run does.
- [ ] **Given** a retroactive run whose agent wrote a plan, **when** the pull request is opened, **then** the lead can read the plan from the pull request.
- [ ] **Given** a settings file with a section for the run's harness, **when** it names a planning model, an implementing model or both, **then** the planning session uses the planning model and the implementation stage and fix rounds use the implementing model, in runs with or without the flag.
- [ ] **Given** a harness with no planning model in settings or built in, **when** a retroactive run plans, **then** the planning session runs on the implementing model or the harness default and the pull request says so.

### Story #1044: Write and approve an as-built decision record after a retroactive build

- **story_type:** user
- **size:** M

**As a** lead, **I want** a retroactive run to write a decision record of the design as it was built, **so that** the epic ends with an approved record without my approval claiming decisions I did not take.

#### Acceptance Criteria

- [ ] **Given** a retroactive run whose stories are all built, **when** the implementation stage ends and every story has its own commit, **then** the epic has an approved decision record that describes the design as built before the first review round starts.
- [ ] **Given** an as-built decision record, **when** the run files it, **then** the run approves the record without waiting for the lead.
- [ ] **Given** an as-built decision record, **when** anyone reads it, **then** it states that it was written after the build and that the run, not the lead, decided and approved it.
- [ ] **Given** a retroactive run that stopped before every story was built, **when** the run ends, **then** no as-built decision record is filed.
- [ ] **Given** a lead who runs the decision-record stage by hand, **when** it drafts a record, **then** it stops at its approval gates as it does today.
- [ ] **Given** an as-built decision record, **when** the distiller carries its reasons into the concept store, **then** each decision-log entry it writes states that the retroactive run, not the lead, decided it.

#### Notes

The lead's suggested route: the run writes the as-built design document unattended, then passes it to `/nxs.decision-record --from`.

## Assumptions

- An epic that does not need design and has no decision record already starts today; on such an epic the flag adds the planning request and the as-built record, and changes nothing about whether the run starts.
- The review rounds of a retroactive run check the build against the epic's acceptance criteria and against the as-built decision record, which the run files and approves before the first review round.

## Out of Scope

- Changing how a run without the flag treats a missing, open or approved decision record.
- Writing an as-built decision record for a run without the flag.
- Making the agent's plan a condition the run checks before it builds.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #1042 | none |
| #1043 | #1042 |
| #1044 | #1042 |
