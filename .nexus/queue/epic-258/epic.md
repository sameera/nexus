---
feature: "Component Distribution"
feature_path: docs/features/component-distribution
epic: "Seed the project templates the pipeline stages read"
slug: seed-project-templates
created: 2026-08-25
type: enhancement
complexity: S
complexity_drivers: [three template files, a seeding site not yet fixed, one fallback removed]
concepts: [portable-tooling]
link: "#258"
---

# Epic: Seed the project templates the pipeline stages read

## Description

Three pipeline stages read a tool-agnostic template out of the project's own configuration: setup reads the standards template, the decision-record stage reads the decision-record template, and close reads the close-record template. Nothing seeds any of them. The setup stage says so explicitly in its own body — it declines to seed the templates and names an install step as the thing that will — and that install step does not seed them either.

The result is a gap that only the Nexus checkout hides. In this repository the templates happen to be present, so every stage finds what it reads. In a repository that is not a Nexus checkout, the decision-record stage has no template and the close stage falls back to a master copy at a path that exists only inside the Nexus repository. That fallback is the leak: it is why close appears to work outside a Nexus checkout and does not.

This is the smallest goal in the parent epic and one of the load-bearing ones. The refactor is not an improvement to installation — it is the first installation that works outside the Nexus repository, and a stage that cannot find its template does not work.

## Success Metrics

- All three templates the pipeline stages read are present in a repository that has never been a Nexus checkout, after the ordinary setup path has run.
- No pipeline stage reads a template path that resolves only inside the Nexus repository.
- Seeding never overwrites a template a project has already tuned.

## Personas

Per `docs/product/context.md`.

## User Stories

### Story #323: The tool-agnostic templates are seeded into a repository that is not a Nexus checkout

**As an** adopter setting up Nexus in my own repository, **I want** setup to place the templates the pipeline stages read, **so that** the stages find them without my repository having ever been a Nexus checkout.

## Acceptance Criteria

- [ ] **Given** a repository with no `.nexus/config/templates/` directory, **when** the documented bootstrap sequence for a new adopter completes, **then** all three tool-agnostic templates are present there.
- [ ] **Given** a repository where one of those templates already exists and has been edited, **when** that same sequence runs again, **then** that file is unchanged, and any template that was absent is added.
- [ ] **Given** `nxs.setup.md`, **when** the sentence stating that it does not seed the templates and that an install step does is read, **then** it names whichever step actually seeds them after this story.
- [ ] **Given** the seeded templates, **when** each is compared with the master it came from, **then** they are byte-identical on first seed.
- [ ] **Given** a repository that has never been a Nexus checkout, **when** the setup stage, the decision-record stage and the close stage each read their template, **then** each finds it.

## Notes

The three are `standard.template.md`, `decision-record-template.md` and `close-record-template.md`. They are already tool-agnostic and already have masters under `common/templates/` — this story gives them a way to arrive, not a new definition.

Seed-never-clobber is a decision that predates this epic and is preserved rather than revisited: a project may tune a template, and a re-run must not discard that.

The setup stage's own body currently states that it does **not** seed these and that an install step does. That sentence becomes false when this story lands and is corrected as part of it.

**Where the seeding runs is deliberately not fixed by this story's ACs.** The parent epic gives the install verb to #253, and this story must work whether the templates are placed by the setup stage or by that verb. What it fixes is that they are placed at all, into a repository that is not a Nexus checkout — the ACs therefore trigger on "the documented bootstrap sequence for a new adopter", which is whatever that sequence turns out to be.

**If seeding lands in #253**, this story still owns a deliverable: the three template masters becoming a seedable set, the seed-never-clobber behaviour, and the correction in AC3. It does not become a documentation-only story.

`nxs.setup.md` currently both reads a template (for its standards guidance) and states that it does not seed templates. Both sentences are in one file and only one of them can stay true.

### Story #324: The close stage's checkout-only template fallback is removed

**As an** adopter running close in my own repository, **I want** the stage to fail loudly rather than reach into a Nexus checkout, **so that** a missing template is a diagnosable error rather than a path that silently cannot exist for me.

## Acceptance Criteria

- [ ] **Given** the close stage body, **when** it is read, **then** it names no template path outside the project's own configuration.
- [ ] **Given** a repository whose close-record template is missing, **when** the close stage reaches the step that reads it, **then** it reports the absent template by path and names the remedy, rather than falling back.
- [ ] **Given** the whole component payload, **when** it is searched for a *read* or a *fallback* resolving under the Nexus repository's own template master directory, **then** there are none — a passage that names that directory only to say it is not what a stage reads is not a match.

## Notes

The fallback is one clause in `.claude/commands/nxs.close.md`: read the seeded project template, and if absent fall back to `common/templates/close-record-template.md`. That master directory is part of the Nexus source checkout and ships in no payload, so for every adopter the fallback is a path that cannot resolve.

Removing a fallback usually widens failure. Here it narrows it: the fallback only ever succeeded for a person running close inside the Nexus repository, and Story 1 removes the condition that made it necessary.

The two stories are ordered — the fallback goes after the seeding lands, not before, so there is no window in which close has neither a seeded template nor a fallback.

## Assumptions

- The three templates are genuinely tool-agnostic, so one copy serves every project and no per-tool variant is needed. This was settled when the template home moved under the config surface.
- The `.nexus/` store is a repo-bound resource: templates belong to the project, not to the toolkit, and the toolkit's job is to put a first copy there rather than to own them thereafter.
- No component reads a data file that ships beside a skill; every template a component reads is a project resource under `.nexus/config/templates/`.

## Out of Scope

- Changing what any template contains.
- The install verb itself, its location resolution, and what else it places — that is #253.
- The other resources under `.nexus/` that setup already seeds; only the templates are missing.

## Open Questions

None.

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #323 | none |
| #324 | #323 |
