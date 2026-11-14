---
feature: "Scope Discipline"
feature_path: docs/features/scope-discipline
epic: "An Initiative Keeps Its Planning Context on Its Own Issue"
slug: initiative-context-on-issue
created: 2026-11-08
type: enhancement
complexity: M
complexity_drivers: [the context moves from a committed folder to the initiative issue, both readers change where they read the context from, one filed initiative is migrated and the folder store is retired]
concepts: ["initiative", "issue-asset-store", "hld-build-input", "release-changelog", "epic-approval-gate", "publishing-config-resolution", "decision-record"]
link: "#1011"
record: "#1016"
record_state: closed
---

# Epic: An Initiative Keeps Its Planning Context on Its Own Issue

## Description

#850 keeps an initiative's planning context in a committed folder in the repository, and the initiative body points at that folder. That folder was always meant to be removed once the initiative's last child closes. When it is removed, the pointer on the issue points at nothing. Nexus avoids exactly that kind of link everywhere else. The folder also stays invisible to teammates until the lead commits and pushes it, so a teammate who plans a stub before that push is stopped.

This epic moves the context onto the initiative issue itself. The body carries the full context when it fits. When it does not fit, the context continues in comments on the initiative, in order, and the body says how many parts there are. Planning a stub and designing an epic read the context from the issue, so they need nothing from the checkout. They read only parts posted by someone who can speak for the repository, and they stop when a part is missing or was changed after filing.

The one initiative already filed with a context folder gets its context moved onto its issue, and the folder store is then retired.

## Success Metrics

- No initiative issue points at a file in the repository.
- A teammate plans a stub under an initiative right after the initiative is filed, without pulling anything.
- An initiative filed from a long design session keeps the whole plan, however long the plan is.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Filing an initiative keeps its context on the initiative issue; Planning and design read the context from the initiative issue; The repository stops holding initiative context

## User Stories

### Story #1012: Filing an initiative keeps its context on the initiative issue

- **story_type:** user
- **size:** M

**As a** lead filing an initiative, **I want** its planning context kept on the initiative issue, **so that** the context lasts as long as the issue and every teammate sees it at once.

#### Acceptance Criteria

- [ ] **Given** the lead accepts an initiative whose full context fits in the issue body, **when** the run files it, **then** the full context is in the initiative body below the context summary, collapsed, and nothing is written to the repository
- [ ] **Given** the full context does not fit in the issue body, **when** the run files the initiative, **then** the context is posted as numbered comments on the initiative, in order, each within the comment limit, and the body says how many parts there are
- [ ] **Given** the initiative is filed, **when** the run reports, **then** it names no folder and asks the lead to commit nothing
- [ ] **Given** a run interrupted after some parts were posted, **when** the lead repeats it, **then** no part is posted twice and the initiative carries exactly one copy of its context

### Story #1013: Planning and design read the context from the initiative issue

- **story_type:** user
- **size:** M

**As a** lead planning a stub or designing an epic under an initiative, **I want** the run to read the initiative's context from the initiative issue, **so that** I can plan without pulling anything and without trusting text a stranger posted.

#### Acceptance Criteria

- [ ] **Given** a stub under an initiative that carries its context on its issue, **when** the lead plans the stub or designs the resulting epic, **then** the run reads the whole context from the initiative, whatever the state of the checkout
- [ ] **Given** a context part posted by someone who cannot speak for the repository, **when** the run reads the context, **then** that part is not read, and the run says it ignored it
- [ ] **Given** a context part that is missing, or that was changed after the initiative was filed, or an initiative whose body still names a context folder, **when** the run reads the context, **then** the run stops before drafting and names the initiative and the part or the folder
- [ ] **Given** an initiative with no context beyond its summary, **when** the lead plans a stub under it, **then** the run reads the body alone and says that no additional context was found

### Story #1014: The repository stops holding initiative context

- **story_type:** system
- **size:** S

**As a** maintainer, **I want** the initiative already filed with a context folder moved onto its issue and the folder store retired, **so that** no initiative points at a file in the repository.

#### Acceptance Criteria

- [ ] **Given** an initiative whose body points at a context folder, **when** its context is migrated, **then** the initiative carries the folder's text unchanged on its issue, and its body no longer names any repository path
- [ ] **Given** the migration is done, **when** the main branch is read, **then** it holds zero initiative context files, and the analyze, close and distill gates no longer list an initiative context store among the stores they leave out
- [ ] **Given** the retired store, **when** a lead files a new initiative, **then** no stage writes or reads an initiative context folder

## Assumptions

- The rule that the initiative body holds no table applies only outside the collapsed context block
- An issue body and an issue comment each hold at most 65,536 characters
- #997 is the only initiative filed with a context folder
- The run posts context parts as the lead, who can speak for the repository

## Out of Scope

- Editing an initiative's context after it is filed
- Keeping the context in a gist, the wiki, or a sub-issue of the initiative
- Reading the initiative's context in the analyze or close stages

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #1012 | none |
| #1013 | #1012 |
| #1014 | #1012, #1013 |
