---
feature: "Unattended Epic Implementation"
feature_path: docs/features/unattended-implementation
epic: "A re-run of nexus implement continues an interrupted run"
slug: resumable-implement
created: 2026-11-05
type: enhancement
complexity: M
complexity_drivers: [preflight changes from refusing an existing branch to continuing on it, the build stage and the review rounds each need a resume entry point, each story commit must reach the remote while the build stage is still running]
concepts: ["unattended-epic-implementation", "decision-record", "record-digest", "nexus-pipeline", "publishing-config-resolution", "committed-queue", "distiller"]
link: "#991"
record: "#996"
record_state: closed
---

# Epic: A re-run of nexus implement continues an interrupted run

## Description

Today `nexus implement` cannot recover from an interruption. When a run stops partway, because the harness crashed, the machine slept, the network failed or an agent stage failed, a re-run refuses because the run's branch already exists. Everything the run knew about its progress lived only in memory, so the lead finishes the work by hand with `/nxs.analyze --pr` and their own fixes.

With this epic, the lead re-runs the same command. The command works out what the interrupted run already finished from what the run left behind: the per-story commits on its branch, and the draft pull request with its published verdicts. It builds only the stories that have no commit yet, then continues the analyze and fix rounds on the existing pull request.

Each story commit is pushed as soon as it is made, and the draft pull request opens at the first one. A partial implementation is therefore never held on one machine: the lead can re-run from any clone, and the pull request shows which stories are built while the run is still going.

The resume point comes from the branch and the pull request, not from a plan or progress file written by a model. Every story already ends in its own commit, so the stories are the milestones, and the commits are the record of which milestones were reached.

## Success Metrics

- A run interrupted at any stage finishes after a re-run of the same command, with no manual git or `/nxs.analyze` step.
- A re-run builds no story that already has its commit on the branch.
- After an interruption, no finished story exists only on the machine that ran the build.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Re-run continues on the epic's existing run branch; Re-run builds only the stories without a commit; Re-run continues the analyze and fix rounds on the existing pull request; Each story commit reaches the remote as it is made

## User Stories

### Story #992: Re-run continues on the epic's existing run branch

- **story_type:** user
- **size:** S

**As a** lead whose `nexus implement` run was interrupted, **I want** a re-run to continue on the branch the earlier run created, **so that** I do not delete work to start again.

#### Acceptance Criteria

- [ ] **Given** the epic's run branch exists and holds only commits made on top of the base branch, **when** the lead re-runs `nexus implement` for that epic, **then** the command continues on that branch and does not refuse.
- [ ] **Given** the lead's checkout is on another branch, **when** the re-run continues, **then** the command switches to the run branch before any agent stage starts.
- [ ] **Given** the run branch exists but does not descend from the base branch, **when** the lead re-runs, **then** the command stops before any agent stage and names the branch and the reason.
- [ ] **Given** the re-run continues on an existing branch, **when** it starts, **then** the command's first output line says it is resuming and names the branch.
- [ ] **Given** a clone where the run branch exists only on the remote, **when** the lead re-runs there, **then** the command continues on that branch as it would on the machine that ran the build.

### Story #993: Re-run builds only the stories without a commit

- **story_type:** user
- **size:** M

**As a** lead re-running an interrupted build, **I want** the build to start from the first story that has no commit, **so that** finished stories are not rebuilt or rewritten.

#### Acceptance Criteria

- [ ] **Given** stories A, B and C, where A and B each have their own story commit on the run branch, **when** the lead re-runs, **then** the build stage is given only C to build.
- [ ] **Given** a re-run that builds the remaining stories, **when** the build stage ends, **then** the commits from the earlier run are unchanged, and the story commit check covers every live story of the epic.
- [ ] **Given** every live story already has its story commit, **when** the lead re-runs, **then** no build stage starts and the run continues to push and the draft pull request.
- [ ] **Given** the remaining stories, **when** the build stage is given them, **then** they are listed in blocked-by order, and each story they wait on is named as already committed.

### Story #994: Re-run continues the analyze and fix rounds on the existing pull request

- **story_type:** user
- **size:** S

**As a** lead whose run stopped during the analyze and fix rounds, **I want** a re-run to continue those rounds on the open draft pull request, **so that** I do not finish the review by hand.

#### Acceptance Criteria

- [ ] **Given** a draft pull request for the run branch is open and every story has its commit, **when** the lead re-runs, **then** the command reuses that pull request and starts with an analyze round on its current head.
- [ ] **Given** an earlier run posted inferred answers on the pull request, **when** the re-run reaches the answer step, **then** the command posts none of those answers a second time.
- [ ] **Given** the re-run reaches a clean verdict for the pull request's current head, **when** the round ends, **then** the command marks the pull request ready, as an uninterrupted run does.

### Story #995: Each story commit reaches the remote as it is made

- **story_type:** user
- **size:** M

**As a** lead running `nexus implement`, **I want** each finished story pushed and the draft pull request opened at the first one, **so that** an interruption never leaves finished work on one machine only.

#### Acceptance Criteria

- [ ] **Given** the build stage commits its first story, **when** that commit passes the story commit check, **then** the command pushes it and opens the draft pull request before the build stage ends.
- [ ] **Given** a later story commit passes the story commit check, **when** the build stage makes it, **then** the command pushes it before the build stage ends.
- [ ] **Given** a story commit fails the story commit check, **when** the command checks it, **then** the command does not push it and stops the run with the reason.
- [ ] **Given** the draft pull request is open while stories remain unbuilt, **when** the lead reads its status section, **then** it names which stories are built and which are pending.

## Assumptions

- Each re-run gets the full round cap again, so the lead decides by re-running whether a run that hit the cap gets more rounds.
- The existing refusal of uncommitted changes, before any agent stage, is enough for a crash that left the tree dirty.

## Out of Scope

- A planning stage that writes an implementation roadmap for a separate model to execute. Anthropic's guidance favours one model when the work is one dependent chain, and the roadmap would repeat the record, the HLD page and the stories.
- A progress file the build stage writes for the next session. The story commits already record progress.
- Choosing a model and effort per stage. Harness arguments after `--` already reach every stage.
- A stale-design check on resume. Preflight already reads the current HLD page on every run, and analyze checks the build against the current record.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #992 | none |
| #993 | #992 |
| #994 | #993 |
| #995 | none |
