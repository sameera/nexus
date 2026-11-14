---
feature: "Component Distribution"
feature_path: docs/features/component-distribution
epic: "Read stage templates from the installed release instead of per-repository copies"
slug: release-resident-templates
created: 2026-11-14
type: enhancement
complexity: M
complexity_drivers: [two stages change how they read templates, template seeding command retired, existing repository copies must stop being read]
concepts: []
link: "#1028"
record: "#1033"
record_state: closed
---

# Epic: Read stage templates from the installed release instead of per-repository copies

## Description

Today every repository that uses Nexus holds its own copy of the stage templates. Setup copies them into the repository, and the decision-record stage and the setup stage read that copy. The same templates already travel inside every Nexus release, so each repository carries a second copy that it must keep in step by hand.

The repository copy goes stale. A copy seeded before a template changed keeps the old shape, because seeding never overwrites. The decision-record stage then has to detect the stale copy and stop, and the lead has to move the copy aside and seed again.

This epic makes the stages read the templates from the installed release. A repository then needs no template files of its own, and a template change reaches every repository with the next release.

## Success Metrics

- A repository with no template folder can run setup and draft a decision record with no extra step.
- After a release that changes a template, the next decision record drafted in any repository follows the new template with no action from the lead.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Locate a release template by name; Draft decision records from the release templates; Generate standards from the release template during setup; Retire template seeding

## User Stories

### Story #1029: Locate a release template by name

- **story_type:** system
- **size:** S

**As a** pipeline stage, **I want** to find a template in the installed release by its name, **so that** I can read it without a copy in the repository.

#### Acceptance Criteria

- [ ] **Given** an installed release, **when** a stage asks for a template the release ships, **then** it receives the location of that template inside the installed release and the request exits zero.
- [ ] **Given** an installed release, **when** a stage asks for a name the release does not ship, **then** the request exits non-zero and names every template the release does ship.
- [ ] **Given** a maintainer whose install location points at a Nexus checkout, **when** a stage asks for a template, **then** it receives the checkout's template, so an edit to a template is live without a release.
- [ ] **Given** a repository that holds its own template folder, **when** a stage asks for a template, **then** the location returned is inside the installed release and never inside the repository.

### Story #1030: Draft decision records from the release templates

- **story_type:** user
- **size:** M

**As a** lead, **I want** the decision-record stage to draft from the templates in the installed release, **so that** my repository needs no template files and every record follows the current template.

#### Acceptance Criteria

- [ ] **Given** a repository with no template folder, **when** the lead runs the decision-record stage on a planned epic, **then** the record is drafted in the approval-first format with no stop about a missing template.
- [ ] **Given** a revision of a record approved in the old format, **when** the lead runs the stage with revise, **then** the revision is drafted from the release's old-format template.
- [ ] **Given** a repository whose own template copy is missing the Guarantees section, **when** the lead runs the decision-record stage, **then** the record is drafted from the release template and the stage does not stop to ask the lead to replace the repository copy.
- [ ] **Given** the stage's instructions, **when** a reader looks for where the stage reads its templates, **then** no instruction names the repository's template folder as a place to read from.

### Story #1031: Generate standards from the release template during setup

- **story_type:** user
- **size:** S

**As a** lead bootstrapping a repository, **I want** setup to generate standards from the template in the installed release, **so that** setup leaves no template files in my repository.

#### Acceptance Criteria

- [ ] **Given** a repository with no template folder, **when** the lead runs setup, **then** the standards documents are generated and setup writes no template folder into the repository.
- [ ] **Given** a repository that already holds a template folder, **when** the lead runs setup, **then** setup reads the release template and leaves the repository's folder untouched.
- [ ] **Given** a completed setup run, **when** the lead reads its report, **then** the report names no template seeding step.

### Story #1032: Retire template seeding

- **story_type:** user
- **size:** S

**As a** lead, **I want** the template seeding command retired, **so that** nothing suggests my repository still needs its own copy.

#### Acceptance Criteria

- [ ] **Given** a lead who runs the template seeding command, **when** it runs, **then** it writes nothing and says that templates are read from the installed release.
- [ ] **Given** the shipped stage instructions, **when** they are searched, **then** none names the template seeding command as a step or a remedy.
- [ ] **Given** a new release, **when** it is built, **then** it still ships every template a stage reads.

## Assumptions

- Every machine that runs a stage has an installed Nexus release, because the stages already call its commands.
- The template set stays the three templates the release ships today: the decision-record template, its old-format template and the standards template.

## Out of Scope

- Letting a repository override a release template with its own copy.
- Deleting template folders that repositories already hold; they are left in place and no longer read.
- Changing the content of any template.
- The repository files that are not stage templates and sit in the same folder today, such as the workspace and hub templates.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #1029 | none |
| #1030 | #1029 |
| #1031 | #1029 |
| #1032 | #1030, #1031 |
