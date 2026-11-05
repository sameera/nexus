---
feature: "Unattended Epic Implementation"
feature_path: docs/features/unattended-implementation
epic: "nexus implement builds from the /nxs.hld page when the record has one"
slug: implement-builds-from-hld-page
created: 2026-11-04
type: enhancement
complexity: M
complexity_drivers: [fetching a page from a store that may be private, stale-page and violation checks before the build, change to the goal prompt the implementing agent receives]
concepts: ["decision-record", "approval-brief", "unattended-epic-implementation", "record-digest", "issue-asset-store", "publishing-config-resolution", "epic-approval-gate"]
link: "#971"
record: "#986"
record_state: closed
---

# Epic: nexus implement builds from the /nxs.hld page when the record has one

## Description

`/nxs.hld` is the optional step after the decision record and before implementation. It renders a page with the components, flows, delivery order and HLD choices the lead already reviewed, and posts a comment on the record that links to it.

Today `nexus implement` ignores that page. It reads only the epic and the record, so an unattended run builds without the design detail the lead approved.

With this epic, a run on an epic whose record has a current HLD comment tells the implementing agent to build from the page. A page that is out of date or reports violations is ignored, and the run output says so. The record stays binding where the two disagree. A run with no HLD comment behaves as it does today.

## Success Metrics

- A run on an epic whose record has a current HLD comment gives the implementing agent the page to build from.
- A run whose newest HLD comment is stale builds from the record alone and reports why.
- A run on an epic with no HLD comment produces the same agent instructions as before this epic.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Find the newest HLD comment on the record; Fetch the HLD page, including from a private store; Ignore a stale page or a page with violations, and say so; Tell the agent to build from the page, with the record still binding

## User Stories

### Story #982: Find the newest HLD comment on the record

- **story_type:** user
- **size:** S

**As a** lead running `nexus implement`, **I want** the run to find the newest HLD comment on the epic's decision record, **so that** it works from the latest page `/nxs.hld` rendered.

#### Acceptance Criteria

- [ ] **Given** a record with two HLD comments, **when** the run starts, **then** it uses the newer comment and ignores the older one
- [ ] **Given** a record with no HLD comment, **when** the run starts, **then** the agent instructions and the run output are the same as before this epic
- [ ] **Given** a record whose comments include ones that are not HLD comments, **when** the run starts, **then** only a comment whose first line marks it as an HLD comment and whose author can speak for the issues repository counts

#### Notes

The HLD is optional, so a missing comment is not an error and produces no warning.

### Story #983: Fetch the HLD page, including from a private store

- **story_type:** user
- **size:** M

**As a** lead running `nexus implement`, **I want** the run to read the page the HLD comment links to, **so that** the agent can build from it even when the store holding it is private.

#### Acceptance Criteria

- [ ] **Given** an HLD comment linking to a page in a private store, **when** the run starts with the lead's configured access, **then** the page text is available to the agent
- [ ] **Given** a page that cannot be read, **when** the run starts, **then** the run stops before its branch is created, says the page could not be read, and asks the lead whether to build from the record alone, naming the option that does so on a re-run
- [ ] **Given** an HLD comment whose design link points to the page at a pinned commit, **when** the page is read, **then** the run reads the file's raw text at that commit, not the rendered page

#### Notes

The run follows the comment's link to the raw file at the pinned commit. It adds no command to `nexus assets`. An unattended run cannot wait for an answer, so on a page it cannot read it stops with the question in its output and the lead re-runs the command.

### Story #984: Ignore a stale page or a page with violations, and say so

- **story_type:** user
- **size:** S

**As a** lead running `nexus implement`, **I want** the run to skip a page that is out of date or reports violations, **so that** the agent never builds from a design the record no longer matches or the page itself flags.

#### Acceptance Criteria

- [ ] **Given** an HLD comment stating a record digest that differs from the record's current digest, **when** the run starts, **then** the page is ignored and the run output says it was ignored because it was rendered from an older record
- [ ] **Given** a stale comment, **when** the run starts, **then** the agent is not told to read the page at all
- [ ] **Given** an HLD comment whose verdict is not the clean verdict, because it lists violations or criteria that cannot be met or cannot be read, **when** the run starts, **then** the page is ignored and the run output says it was ignored because of its verdict, quoting it

#### Notes

The current record digest comes from `nexus record-digest`.

### Story #985: Tell the agent to build from the page, with the record still binding

- **story_type:** user
- **size:** S

**As a** lead running `nexus implement`, **I want** the agent told to build from a current page, **so that** the unattended build follows the design I reviewed.

#### Acceptance Criteria

- [ ] **Given** a current HLD page, **when** the run starts the build, **then** the agent is told to read the page and follow its architecture, mechanisms, data and delivery plan
- [ ] **Given** a page and a record that disagree, **when** the agent builds, **then** it is told the record is binding
- [ ] **Given** a page open choice, **when** the agent builds, **then** it is told the choice guides the build but binds nothing
- [ ] **Given** a fix round item whose fix would contradict a record decision, **when** the fix round meets it, **then** it is still treated as an escalation, as before this epic

#### Notes

The agent is told which parts of the page bind and which do not. It is not asked to judge whether the page is correct.

## Assumptions

- The verdict and the record digest are read from the HLD comment, so the stale and violation checks need no page read
- A run that ignores a page continues from the record alone and does not stop

## Out of Scope

- Changes to `/nxs.hld`, the page it renders or the comment it posts
- Fix rounds and `/nxs.analyze` reading the page

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #982 | none |
| #983 | #982 |
| #984 | #982 |
| #985 | #982, #983, #984 |
