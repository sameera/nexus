---
feature: "Issue-Sourced Planning"
feature_path: docs/features/issue-sourced-planning
epic: "Existing Features and Epics Move onto Feature Issues"
slug: feature-issue-migration
created: 2026-11-21
type: enhancement
complexity: M
complexity_drivers: [every existing feature and epic is touched, including closed ones, a re-run must file nothing twice, a change to what close writes]
concepts: ["initiative", "backlog-stub", "epic-approval-gate", "issue-kind-classification", "resumable-batch-filing", "issue-sourced-planning", "publishing-config-resolution"]
link: "#999"
record: "#1049"
record_state: closed
---

# Epic: Existing Features and Epics Move onto Feature Issues

## Description

Epic #998 made a feature a GitHub issue, but only for features planned after it. Every feature that already exists is still a folder under the documentation tree, and every existing epic and stub still names its feature only by that folder's path.

This epic moves what already exists onto feature issues. Each feature folder gets a feature issue. Each existing epic and stub then names that feature issue, so the whole backlog reads the same way as a newly planned feature.

Goal 3 of the initiative stops reading the tree only after every existing feature has an issue. Otherwise an unmigrated feature would vanish from planning. This epic is the step that makes that safe.

## Success Metrics

- Every existing feature folder has exactly one feature issue that carries the declared feature marker.
- Every existing epic and stub names the feature issue of its feature.
- Running the migration a second time files and changes nothing.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Each feature folder becomes a feature issue; Each epic and stub names its feature issue; Close stops writing to the feature path

## User Stories

### Story #1046: Each feature folder becomes a feature issue

**As a** product lead, **I want** every existing feature folder to have a feature issue, **so that** the feature exists on GitHub and not only in the tree.

#### Acceptance Criteria

- [ ] **Given** a repository opted in to features as issues and a feature folder with no feature issue, **when** the lead runs the migration, **then** one feature issue is filed for that folder and carries the declared feature marker
- [ ] **Given** a feature folder that already has a feature issue, **when** the migration runs again, **then** no second feature issue is filed for it
- [ ] **Given** a migration interrupted partway, **when** it is run again, **then** it files only the feature issues still missing
- [ ] **Given** a filed feature issue, **when** the lead reads it, **then** it shows the feature's name and one-line capability statement from the folder's index
- [ ] **Given** a feature issue that carries the retired-feature label, **when** the migration runs again, **then** no second feature issue is filed for that folder and the label is left unchanged

#### Notes

The feature folders and their README files stay where they are.

### Story #1047: Each epic and stub names its feature issue

**As a** product lead, **I want** every existing epic and stub to name its feature issue, **so that** a feature's epics and open stubs can be found from the feature issue.

#### Acceptance Criteria

- [ ] **Given** an existing epic or stub whose feature has a feature issue, **when** the migration completes, **then** that epic or stub names the feature issue by number
- [ ] **Given** a closed epic, **when** the migration completes, **then** it names its feature issue and stays closed
- [ ] **Given** an epic or stub that already names its feature issue, **when** the migration runs again, **then** it is left unchanged
- [ ] **Given** an epic that sits under an initiative, **when** the migration completes, **then** its parent is unchanged and the feature issue is not made its parent
- [ ] **Given** an epic or stub that names its feature issue, **when** the lead reads the feature issue's related issues, **then** that epic or stub is listed there

#### Notes

Epic #998 links each epic it files to its feature issue as related, never as a parent. The migration does the same for existing epics.

### Story #1048: Close stops writing to the feature path

**As a** product lead, **I want** closing an epic to leave the feature's folder alone, **so that** the feature issue is the only record of the feature that close touches.

#### Acceptance Criteria

- [ ] **Given** a feature that has a feature issue, **when** an epic of that feature is closed, **then** close writes nothing under that feature's path, and every stub close files names that feature issue and is listed in its related issues
- [ ] **Given** a repository that has not opted in to features as issues, **when** an epic is closed, **then** close behaves as it does today
- [ ] **Given** a feature that has no feature issue, **when** an epic of that feature is closed, **then** close behaves as it does today

## Assumptions

- The migration runs only in a repository opted in to features as issues.
- This epic does not delete or move any feature folder; what happens to the folders is settled by the decision record.
- A feature issue is filed in the same repository as the epics that name it.

## Out of Scope

- Reading features from a query, and filing an epic with no write to the tree, belong to #1000.
- Whether feature issues stay open or are closed is settled by the decision record.
- Filing a feature issue for a newly planned feature belongs to #998, which is done.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #1046 | none |
| #1047 | #1046 |
| #1048 | #1047 |
