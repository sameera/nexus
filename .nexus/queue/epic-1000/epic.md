---
feature: "Issue-Sourced Planning"
feature_path: docs/features/issue-sourced-planning
epic: "Planning Reads Features from a Query, and Filing Writes Nothing to the Tree"
slug: planning-reads-features-from-a-query
created: 2026-11-22
type: enhancement
complexity: M
complexity_drivers: [three readers move from the tree to one listing command, filing stops writing the feature folder]
concepts: []
link: "#1000"
record: "#1061"
record_state: closed
---

# Epic: Planning Reads Features from a Query, and Filing Writes Nothing to the Tree

## Description

Today `/nxs.epic`, `nxs-pm` and `nxs-architect` find features by reading the feature folders and the features index in the documentation tree. When `/nxs.epic` files an epic, it writes the feature README and a features index row. So every filing changes the repository, even though the epic itself lives on GitHub.

After #998 and #999, every feature in an opted-in repository is a feature issue, and every epic and stub names its feature issue. This epic adds a `nexus` command that lists features, and lists a feature's epics and open stubs. `/nxs.epic`, `nxs-pm` and `nxs-architect` read features from that command instead of the tree. `/nxs.epic` then files an epic without writing anything to the tree.

This epic also changes how feature issues are filed. A feature issue is filed closed, so it stays out of the open-issue count and the default issues view. Feature issues that are already open are closed by hand, repository by repository. The listing reads feature issues in both states. This supersedes #998's record (D10) and #999's record (D7), which kept feature issues open.

A repository also chooses how features are recorded: in the docs tree, which stays the default, as issues marked by GitHub's Feature issue type, or as issues marked by a label. A repository that marks its epics with labels can still use the Feature type for its features (#1060).

## Success Metrics

- In an opted-in repository, filing an epic leaves the working tree unchanged.
- `/nxs.epic`, `nxs-pm` and `nxs-architect` find every feature, open or closed, without reading a feature README or the features index.
- Every feature issue `/nxs.epic` files in an opted-in repository is closed when the run reports complete.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

A command lists features, and a feature's epics and open stubs; Planning and the advisory agents read features from the listing command; Filing an epic writes no feature README

## User Stories

### Story #1056: A command lists features, and a feature's epics and open stubs

- **story_type:** user
- **size:** M

**As a** lead, **I want** one `nexus` command that lists the repository's features and what is planned under each, **so that** I and the planning stages can find a feature without reading the documentation tree.

#### Acceptance Criteria

- [ ] **Given** an opted-in repository with open and closed feature issues, **when** the lead lists features, **then** every feature issue that records its feature is listed with its name and number, whatever its state, and an issue that carries the feature marker but records no feature is not listed.
- [ ] **Given** a feature issue, **when** the lead lists that feature's epics, **then** every planned epic that names the feature is listed with its state, and no stub is among them.
- [ ] **Given** a feature issue, **when** the lead lists that feature's open stubs, **then** every open stub that names the feature is listed, and no closed stub and no planned epic is among them.
- [ ] **Given** a repository that has not opted in to features as issues, **when** the lead lists features, **then** the command says that features as issues is off and reads nothing from GitHub.
- [ ] **Given** a feature issue that carries the retired-feature label, **when** the lead lists features, **then** it is listed and marked retired.

### Story #1057: Planning and the advisory agents read features from the listing command

- **story_type:** user
- **size:** M

**As a** lead, **I want** `/nxs.epic`, `nxs-pm` and `nxs-architect` to find features through the listing command, **so that** a feature whose folder was never written is still found.

#### Acceptance Criteria

- [ ] **Given** an opted-in repository, **when** `/nxs.epic` resolves the feature for a new intent, **then** it matches the intent against the listed features, open or closed, and reads no feature README and no features index.
- [ ] **Given** an opted-in repository, **when** `nxs-pm` surveys related features, **then** the features and epics it names come from the listing command, and it reads no feature README and no features index.
- [ ] **Given** an opted-in repository, **when** `nxs-architect` looks for prior decisions in similar features, **then** it finds those features and their epics through the listing command, and it reads no feature README and no features index.
- [ ] **Given** a repository that has not opted in, **when** any of the three runs, **then** it reads features from the tree as it does today.

### Story #1058: Filing an epic writes no feature README

- **story_type:** user
- **size:** S

**As a** lead, **I want** `/nxs.epic` to file an epic without writing to the repository, **so that** planning leaves nothing for me to commit.

#### Acceptance Criteria

- [ ] **Given** an opted-in repository, **when** `/nxs.epic` files an epic under a new feature, **then** no feature folder, no feature README and no features index row is written.
- [ ] **Given** an opted-in repository and a feature that already has a README, **when** `/nxs.epic` files another epic under it, **then** the README and the features index are left unchanged.
- [ ] **Given** a repository that has not opted in, **when** `/nxs.epic` files an epic, **then** the feature folder, its README and the features index row are written as they are today.
- [ ] **Given** an opted-in repository with feature READMEs, **when** the lead runs the feature-issue migration with its apply flag, **then** each README whose feature has a feature issue gains one line pointing to that issue, and a repeated run adds no second line.

### Story #1059: Feature issues are filed closed

- **story_type:** user
- **size:** S

**As a** lead, **I want** feature issues to stay closed, **so that** they do not count as open work or crowd the default issues view.

#### Acceptance Criteria

- [ ] **Given** an opted-in repository, **when** `/nxs.epic` files a new feature issue, **then** the feature issue is closed before the run reports complete.
- [ ] **Given** a closed feature issue, **when** `/nxs.epic` files a new epic under that feature, **then** the run reuses the closed feature issue and leaves it closed.
- [ ] **Given** an opted-in repository, **when** the feature-issue migration files a new feature issue, **then** the feature issue is closed before the migration reports complete.

### Story #1060: Features use the Feature issue type even when epics use labels

- **story_type:** user
- **size:** M

**As a** lead, **I want** to choose whether features live in the docs tree, as issues marked by the Feature issue type, or as issues marked by a label, **so that** a repository that marks epics with labels can still give its features GitHub's standard Feature type.

#### Acceptance Criteria

- [ ] **Given** a repository that marks epics with labels and chooses typed feature issues, **when** `/nxs.epic` files a new feature issue, **then** the issue carries the Feature issue type and no feature label, and the feature listing finds it.
- [ ] **Given** a repository that chooses labelled feature issues, **when** `/nxs.epic` files a new feature issue, **then** the issue carries the feature label, whatever marks its epics.
- [ ] **Given** a repository that makes no choice, **when** it plans, **then** features stay in the docs tree, as they do today.
- [ ] **Given** a repository that chooses typed feature issues and either names no feature issue type or names one its repository does not have, **when** `/nxs.epic` would file a feature issue, **then** it stops before approval, files nothing, not even the epic, and names the missing setting or type.
- [ ] **Given** a repository that turned on features as issues with the current setting, **when** it plans after this change, **then** its feature issues carry the same marker as before and are found by the feature listing.

#### Notes

Suggested setting for the decision record: `github.features: docs | types | labels`, with `docs` as the default. It reuses the words of `github.classification`. The current `features-as-issues: true` stays accepted and means "issues, marked the way `classification` says". The decision record settles the final name and whether `types` falls back to a label when the type is missing.

## Assumptions

- The new behavior applies only in a repository that has opted in to features as issues. A repository that has not opted in keeps today's feature folders.
- Every existing feature in an opted-in repository already has a feature issue, because #999 moved them, so no feature disappears from planning when the tree stops being read.

## Out of Scope

- Deleting existing feature folders, feature READMEs or the features index from the tree.
- `/nxs.discover` reading features from the listing command.
- Closing feature issues that are already open. The lead closes them by hand in each repository.
- What the retired-feature label from #999 means once feature issues are closed is settled by the decision record.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #1056 | none |
| #1057 | #1056 |
| #1058 | #1057 |
| #1059 | none |
| #1060 | none |
