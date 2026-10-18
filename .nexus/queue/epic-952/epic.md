---
feature: "PR-Driven Delivery"
feature_path: docs/features/pr-driven-delivery
epic: "Distill and Clean Up by Epic Number"
slug: distill-by-epic-number
created: 2026-10-18
type: enhancement
complexity: M
complexity_drivers: [one command surface gains epic addressing, one new subcommand, every distill ending changes]
concepts: ["distill-command", "planning-run-folder", "release-changelog", "drain-invocation", "close-and-distill-command", "pr-driven-flow", "epic-approval-gate"]
link: "#952"
record: "#956"
record_state: closed
---

# Epic: Distill and Clean Up by Epic Number

## Description

Distill runs once per epic, and the distill worktree belongs to the epic. Today the lead must still give `nexus distill` a pull request number, and must copy a worktree path to remove the worktree at the end. This epic lets the lead name the epic instead, and adds a cleanup command that finds the worktree itself.

`nexus distill --epic <N>` starts the distillation from the epic number. A bare number, `nexus distill N` or `nexus distill #N`, means the same as `--epic N`. `--pr <ref>` keeps working. `nexus distill cleanup <epic>` removes the epic's distill worktree, and every distill ending names that command.

Related to #909, which added `nexus distill --pr <N>`.

## Success Metrics

- A lead distills a closed epic by typing only its number, with no pull request number.
- A lead removes the distill worktree after any distill ending by typing only the epic number, with no worktree path.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Distill an epic by its number; Clean up an epic's distill worktree; Distill endings name the cleanup command

## User Stories

### Story #953: Distill an epic by its number

**As a** lead, **I want** to run `nexus distill --epic <N>` or `nexus distill N`, **so that** I distill a closed epic without looking up one of its pull requests.

## Acceptance Criteria

- [ ] **Given** epic N is closed and close prepared its worktree, **when** I run `nexus distill --epic N`, **then** the distillation runs for that epic exactly as `nexus distill --pr <ref>` does for a pull request of the epic
- [ ] **Given** the same epic, **when** I run `nexus distill N` or `nexus distill '#N'`, **then** the command behaves as `nexus distill --epic N`; **when** the shell drops an unquoted `#N` as a comment, **then** the refusal says so and names `nexus distill N`
- [ ] **Given** a pull request of an epic, **when** I run `nexus distill --pr <ref>`, **then** it works as it did before this epic
- [ ] **Given** a distill run for epic N is in progress or has ended, **when** I run `nexus distill` again for that epic by `--epic`, by a bare number or by `--pr`, **then** it treats both as the same epic's run and refuses a second start while one is live
- [ ] **Given** a distill run stops and prints how to re-run it, **when** I started it with an epic number, **then** the printed command uses `--epic`

## Notes

The run record is kept per epic instead of per pull request. A change to the shipped component needs a version bump and a changelog entry in the same commit, and tests are written first.

### Story #954: Clean up an epic's distill worktree

**As a** lead, **I want** to run `nexus distill cleanup <epic>`, **so that** the distill worktree is removed without my copying its path.

## Acceptance Criteria

- [ ] **Given** epic N has a distill worktree, **when** I run `nexus distill cleanup N`, **then** the worktree is removed and the command says which path it removed
- [ ] **Given** the worktree has uncommitted changes, **when** I run the cleanup, **then** it is still removed and the epic has no distill worktree left
- [ ] **Given** the cleanup already ran, or no distill worktree exists for the epic, **when** I run `nexus distill cleanup N`, **then** it says no worktree was found and exits successfully; a left-over run record for the epic is still deleted, and with no record either it changes nothing
- [ ] **Given** I run the cleanup from inside the worktree, **when** it finishes, **then** it removed the worktree without an error
- [ ] **Given** `nexus pr-worktree remove <worktree>` is used by the analyze flow, **when** this epic ships, **then** that command works as before
- [ ] **Given** a distill run for epic N is still in progress, **when** I run `nexus distill cleanup N`, **then** it removes nothing, names the running process, and exits with an error
- [ ] **Given** epic N has a distill run record, **when** I run `nexus distill cleanup N`, **then** the record is deleted after the worktree is removed, and no other epic's record is touched

## Notes

The cleanup does not delete the distillation branch or the open distillation pull request.

### Story #955: Distill endings name the cleanup command

**As a** lead, **I want** each distill ending to tell me the cleanup command for my epic, **so that** I do not look up or copy a worktree path.

## Acceptance Criteria

- [ ] **Given** a distill run ends in any way, success or stop, **when** I read its final output, **then** it names `nexus distill cleanup <epic>` with the epic's number filled in
- [ ] **Given** a distill run ends, **when** I read its final output, **then** it no longer names `nexus pr-worktree remove <worktree>`

## Notes

Applies equally to runs started with `--pr` and with `--epic`, and to the distillation's own report, which every ending quotes and which an attended distillation also prints.

## Assumptions

- The distill worktree is found from the epic number alone, by the same distillation-branch naming close and distill use; cleanup removes every local worktree on any of the epic's distillation branches and reads nothing from the network

## Out of Scope

- Removing the distillation branch or closing the distillation pull request
- Changing `nexus pr-worktree remove` or the analyze flow

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #953 | none |
| #954 | none |
| #955 | #954 |
