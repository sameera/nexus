---
feature: "Issue-Sourced Planning"
feature_path: docs/features/issue-sourced-planning
epic: "A Feature Is a GitHub Issue That a New Epic Names"
slug: feature-issue-marker
created: 2026-11-05
type: enhancement
complexity: M
complexity_drivers: [a new issue kind every stage must recognise, a new filing step in planning, a feature reference the resolver must carry back]
concepts: ["initiative", "backlog-stub", "epic-approval-gate", "issue-kind-classification", "resumable-batch-filing", "issue-sourced-planning", "publishing-config-resolution"]
link: "#998"
record: "#1010"
record_state: closed
---

# Epic: A Feature Is a GitHub Issue That a New Epic Names

## Description

Today a feature is only a folder under the documentation tree. An epic names its feature by that folder's path, and nothing on GitHub stands for the feature itself.

This epic makes a feature a GitHub issue. The repository declares the marker a feature issue carries, the same way it declares the epic and initiative markers. When `/nxs.epic` plans a new feature, it files a feature issue. Each epic and stub it files is linked to that feature issue by GitHub's relates-to relationship, and names the feature issue by number beside the feature path.

The behavior is opt-in. A repository whose settings do not set `features-as-issues: true` plans, files and closes features exactly as today. The current behavior stays the default until features as issues has proven more usable on a couple of projects. A later epic then removes the current behavior and its instructions.

A feature issue is related, never a parent. An epic under an initiative already has the initiative as its parent, and GitHub allows one parent per issue. The relates-to link shows from both issues, can be removed, and works across repositories, so a feature's epics can be read from the feature issue in one query. The feature folder and its README are still written, so nothing that reads the tree today loses anything. Moving existing features onto issues and reading features from a query come in the two epics after this one.

## Success Metrics

- In an opted-in repository, every epic and stub `/nxs.epic` files for a new feature is linked to one feature issue by a relates-to relationship, and that feature issue carries the declared feature marker.
- No feature issue is the parent of any epic, stub or story.
- A repository that has not opted in plans, files and closes features exactly as today.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

A repository opts in to features as issues and declares the feature marker; Planning files a new feature as an issue; An epic and a stub name their feature issue

## User Stories

### Story #1006: A repository opts in to features as issues and declares the feature marker

**As a** lead, **I want** to opt my repository in to features as issues and declare how it marks a feature issue, **so that** I can try the new model on one project while every other project keeps the current behavior.

#### Acceptance Criteria

- [ ] **Given** a repository that has not set `features-as-issues: true`, **when** `/nxs.epic` plans a new feature, **then** the feature is created the same way as today, and no feature issue, relates-to link or feature issue number is written.
- [ ] **Given** a repository that has not opted in, **when** any stage asks what an issue is filed as, **then** no issue is read as a feature.
- [ ] **Given** an opted-in repository, **when** Nexus resolves the feature marker, **then** the marker is the declared feature issue type when the repository files issues by type, and the declared feature label, or a built-in one when none is declared, when it files by label.
- [ ] **Given** an opted-in repository that files issues by issue type and declares no feature issue type, **when** Nexus resolves the feature marker, **then** the marker resolves to nothing and no issue is read as a feature.
- [ ] **Given** an opted-in repository and an issue that carries the feature marker and no epic, story, record or initiative marker, **when** a stage asks what the issue is filed as, **then** the answer is a feature.
- [ ] **Given** an opted-in repository and an issue read as a feature, **when** a stage is handed it as its epic, **then** the stage refuses it and names it as a feature.

### Story #1007: Planning files a new feature as an issue

**As a** lead, **I want** `/nxs.epic` to file a feature issue when it plans a new feature, **so that** the feature exists on GitHub beside the epics that belong to it.

#### Acceptance Criteria

- [ ] **Given** an opted-in repository and a new feature the lead confirmed, **when** the lead approves the epic, **then** a feature issue carrying the feature marker is filed, titled with the feature name and holding the one-line capability statement.
- [ ] **Given** the lead chooses stubs at the right-size gate for a new feature, **when** the stubs are filed, **then** the feature issue is filed before them.
- [ ] **Given** a run whose feature issue was filed and whose filing stopped incomplete, **when** the lead repeats the run, **then** it reuses that feature issue and files no second one.
- [ ] **Given** an opted-in repository whose feature marker resolves to nothing, **when** `/nxs.epic` plans a new feature, **then** it says in one line that no feature issue is filed and why, and files the epic as it does today.

### Story #1008: An epic and a stub name their feature issue

**As a** lead, **I want** each epic and stub to name its feature issue, **so that** a reader can reach the feature from the epic, and the epics from the feature, in one click.

#### Acceptance Criteria

- [ ] **Given** a feature issue exists for the feature, **when** `/nxs.epic` files an epic or a stub under that feature, **then** the epic or stub names the feature issue by number beside the feature path.
- [ ] **Given** a feature whose feature issue a previous run filed, **when** a second epic is planned under that feature, **then** the epic names the same feature issue and no second feature issue is filed.
- [ ] **Given** an epic or a stub that names its feature issue, **when** the stub is promoted with `/nxs.epic <n>` or a later stage rebuilds the epic from its issue number, **then** the result names the same feature issue.
- [ ] **Given** an epic or a stub filed under a feature issue, **when** the lead opens the feature issue on GitHub, **then** the epic or stub is listed as related, including one filed in another repository.
- [ ] **Given** an epic or a stub that names its feature issue, **when** it is filed, **then** it is not a sub-issue of the feature issue, and one filed under an initiative stays the initiative's child.

## Assumptions

- The feature folder and its README are still written at filing.
- A feature issue is filed in the same repository as the epics that name it.

## Out of Scope

- Filing feature issues for existing feature folders, naming them on existing epics and stubs, and stopping close's writes to the feature path belong to #999.
- Reading features from a query, and filing an epic with no write to the tree, belong to #1000.
- Removing the current feature-folder behavior and its instructions, once features as issues has proven more usable on a couple of projects, is a later epic.
- Whether feature issues stay open or are closed, what happens to the feature folders, and what close writes are settled by the decision record.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #1006 | none |
| #1007 | #1006 |
| #1008 | #1007 |
