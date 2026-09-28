---
feature: "Solo Delivery"
feature_path: docs/features/solo-delivery
epic: "Close and Distill a Merged Epic PR in One Command"
slug: close-epic-one-command
created: 2026-09-27
type: enhancement
complexity: M
complexity_drivers: [changes two existing stages, new lead-facing script on two harnesses, the script depends on the unattended distill path]
concepts: []
link: "#814"
record: "#818"
record_state: closed
---

# Epic: Close and Distill a Merged Epic PR in One Command

## Description

After an epic's pull request merges, the lead runs `/nxs.close --pr <N>`, changes into the worktree that close opened, and runs `/nxs.distill` there. That is two commands, a directory change and a second approval. A lead working alone has the same path, because `utils/implement-epic.sh` always opens a pull request.

One command takes a merged epic pull request, runs close interactively, and then runs distill in the same worktree with nobody watching. Close and distill stay separate stages, each in its own fresh context, because one session carrying both stages' instructions and work loses accuracy. Distill reading the diff a second time costs less than that. Distill gets an unattended path: run with nobody to answer, it opens the distillation pull request without asking, because the review of that pull request is already the human gate.

The epic also fixes a defect. Since epic #769, `/nxs.close` without `--pr` can never pass its own shipped-record gate, which issue #797 recorded. Close without `--pr` now refuses before it writes anything and names `/nxs.close --pr <N>`.

## Success Metrics

- A lead goes from a merged epic pull request to a closed epic and an open distillation pull request with one command and one approval.
- No close run without `--pr` writes a file or touches an issue before it refuses.
- Every unattended distill run ends with an open distillation pull request or a stated reason it stopped, never with an unanswered question.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Local close refuses up front; Distill runs unattended; One command closes and distills a merged epic PR

## User Stories

### Story #815: Local close refuses up front

- **story_type:** user
- **size:** S

**As a** lead, **I want** `/nxs.close` without `--pr` to refuse before it does anything, **so that** I never reach a shipped-record gate that a local close cannot pass.

#### Acceptance Criteria

- [ ] **Given** a lead runs `/nxs.close` without `--pr`, **when** the stage starts, **then** it refuses before it writes any file or changes any issue, and it names `/nxs.close --pr <N>` as the path that works.
- [ ] **Given** a lead runs `/nxs.close --pr <N>` on a merged pull request, **when** the stage runs, **then** it closes the epic exactly as it did before this epic.

#### Notes

Commit `484c86b` (#801) on the abandoned branch `feat/799-solo-lane` is the starting point.

### Story #816: Distill runs unattended

- **story_type:** user
- **size:** M

**As a** lead, **I want** `/nxs.distill` to finish without me when nobody can answer it, **so that** it can run in the background after close and its pull request review is the only approval I give.

#### Acceptance Criteria

- [ ] **Given** `/nxs.distill` runs with `--unattended`, **when** drafting finishes with no blocking condition, **then** it opens the distillation pull request without asking for approval.
- [ ] **Given** `/nxs.distill` runs with `--unattended`, **when** a blocking condition occurs, **then** it opens no pull request, and its final message names the condition and what would clear it.
- [ ] **Given** an unattended run opened the distillation pull request, **when** the reviewer opens that pull request, **then** its description shows everything the skipped checkpoint would have shown.
- [ ] **Given** `/nxs.distill` runs without `--unattended`, interactively or not, **when** drafting finishes, **then** the stage asks for approval before opening the pull request, as it does today.

### Story #817: One command closes and distills a merged epic PR

- **story_type:** user
- **size:** M

**As a** lead, **I want** one command that closes and distills a merged epic pull request, **so that** I answer one checkpoint and never change directory between the two stages.

#### Acceptance Criteria

- [ ] **Given** a merged epic pull request, **when** the lead runs `utils/close-epic.sh <PR>` on either the claude or the codex harness, **then** close runs interactively with its one checkpoint, and distill then runs in the worktree close left, without the lead changing directory and without a second question.
- [ ] **Given** a merged epic pull request, **when** the lead runs `utils/close-epic.sh <PR>`, **then** it runs `/nxs.analyze --pr <PR>` unattended before close starts, so close finds the pull request's shipped record, and it does not start close when that run fails.
- [ ] **Given** a pull request that is not merged, **when** the lead runs the command without asking it to merge, **then** it refuses before close starts and names the pull request's state.
- [ ] **Given** an open, non-draft pull request that carries a clean conformance verdict, **when** the lead runs the command with `--merge`, **then** it merges the pull request and continues with close.
- [ ] **Given** an open pull request that is a draft, is not mergeable, or carries no clean conformance verdict, **when** the lead runs the command with `--merge`, **then** it refuses before merging and names the reason.
- [ ] **Given** the lead asks for distill in the background, **when** close finishes, **then** the command returns to the lead, and distill's progress and outcome are kept where the lead can read them later.
- [ ] **Given** the lead declines at close's checkpoint, or close fails, **when** close ends, **then** distill does not start.

## Assumptions

- Epic #799 and pull request #808 are closed without merge, and the story issues of #799 close as not planned.
- The review of the distillation pull request is the human approval for distill.
- Every story's change ships with a version bump and a CHANGELOG entry.

## Out of Scope

- Any change to `/nxs.analyze`; its local receipt stays as it is.
- Hub and member workspaces.
- Running close and distill in one session.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #815 | none |
| #816 | none |
| #817 | #816 |
