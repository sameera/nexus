---
feature: "PR-Driven Delivery"
feature_path: docs/features/pr-driven-delivery
epic: "Distill a Closed Epic with One Nexus Command"
slug: nexus-distill-subcommand
created: 2026-10-10
type: enhancement
complexity: M
complexity_drivers: [one M story plus three S stories, new subcommand that starts a harness session, outcome read from the platform instead of the session, a detached run that still reports to the terminal, an attended distillation that runs in a worktree other than its own checkout]
concepts: ["distillation-pr", "distiller", "taxonomy-filing-gate", "drift-advisory", "pr-driven-flow", "intake-lane", "drain-invocation"]
link: "#909"
record: "#946"
record_state: closed
---

# Epic: Distill a Closed Epic with One Nexus Command

## Description

After a pull request merges, the lead runs `nexus close`. Close prepares a worktree and a distillation branch. The lead must then open a Claude Code session inside that worktree and run `/nxs.distill` by hand. That second step asks the lead for nothing they have not already decided, and it is easy to forget.

This epic adds `nexus distill --pr <N>`. The command finds the worktree close prepared, checks that close's result still holds, and runs the distillation there with nobody answering questions. It reports the distillation pull request it opened, or the reason the distillation stopped. The review of that pull request is the only approval the run needs. The epic also lets `/nxs.distill` take the path of that worktree, so a lead who wants an attended run can start it from the session they already have open.

A maintainer script, `close-epic.sh`, already does this for the Nexus repository. The npm package does not ship that script, so adopters cannot use it. This epic moves the distill half of the script into the shipped command. `nexus close` stays a separate command that runs no model.

## Success Metrics

- After `nexus close` succeeds, one command with zero prompts produces an open distillation pull request.
- A lead who installed only the npm package can run the command. No clone of the Nexus repository is needed.
- The command reports success in zero runs where no distillation pull request is open.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Distill a closed epic with one command; Refuse to start when close's result does not hold; Run the distillation in the background

## User Stories

### Story #910: Distill a closed epic with one command

- **story_type:** user
- **size:** M

**As a** lead, **I want** to run one command after `nexus close`, **so that** the distillation pull request opens without my starting a session by hand.

## Acceptance Criteria

- [ ] **Given** a merged pull request whose epic `nexus close` has closed, **when** the lead runs `nexus distill --pr <N>`, **then** the distillation runs with no question asked and the command prints the URL of the distillation pull request it opened
- [ ] **Given** the distillation stops on a blocking condition, **when** the command ends, **then** it prints the reason for the stop, states that no pull request was opened, and exits non-zero
- [ ] **Given** the distillation session ends without an error and no distillation pull request is open, **when** the command ends, **then** it reports a stop, does not report success, and exits non-zero
- [ ] **Given** the command has ended, **when** the lead reads its final output, **then** the output names the command that removes the worktree

## Notes

The command always runs the distillation under the unattended contract. An attended run stays available as `/nxs.distill`.

### Story #911: Refuse to start when close's result does not hold

- **story_type:** user
- **size:** S

**As a** lead, **I want** the command to refuse before it starts a session when close has not finished its work, **so that** a distillation never runs against a half-closed epic.

## Acceptance Criteria

- [ ] **Given** the epic of the pull request is still open, **when** the lead runs `nexus distill --pr <N>`, **then** the command refuses before any session starts and names `nexus close --pr <N>` as the remedy
- [ ] **Given** no worktree that close prepared for this epic is checked out on its distillation branch, **when** the lead runs the command, **then** it refuses before any session starts and names the missing state
- [ ] **Given** the distillation branch is not pushed, **when** the lead runs the command, **then** it refuses before any session starts and names the branch
- [ ] **Given** a hub or a member checkout, **when** the lead runs the command, **then** it refuses before any session starts and names the manual route

### Story #912: Run the distillation in the background

- **story_type:** user
- **size:** S

**As a** lead, **I want** the command to return at once and leave the distillation running, **so that** I can keep working while it drains.

## Acceptance Criteria

- [ ] **Given** the lead passes `--background` and every check passes, **when** the command returns, **then** the distillation is still running and the output names where its log and its outcome will be written
- [ ] **Given** a background run has ended, **when** the lead reads the outcome, **then** it states the distillation pull request URL, or the stop and the final message of the distillation
- [ ] **Given** a background run has written its files, **when** the lead runs `git status`, **then** none of those files appears as a change
- [ ] **Given** a background run is in progress, **when** the lead keeps using the terminal it was started from, **then** that terminal receives a status line at regular intervals until the run ends

### Story #945: Distill a close worktree from the session I am in

- **story_type:** user
- **size:** S

**As a** lead, **I want** to pass the worktree that `nexus close` prepared to `/nxs.distill`, **so that** I can run an attended distillation from the session I already have open instead of starting a new one inside the worktree.

## Acceptance Criteria

- [ ] **Given** a worktree that `nexus close` prepared and that is checked out on its distillation branch, **when** the lead runs `/nxs.distill <worktree-path>` from another checkout of the same repository, **then** the distillation drains that worktree's one entry and opens its distillation pull request, exactly as a run started inside the worktree does
- [ ] **Given** the path names a directory that is not a worktree on a distillation branch that close prepared, and is not a queue entry, **when** the lead runs `/nxs.distill <path>`, **then** the command refuses before it reads any entry and names what it found at the path
- [ ] **Given** the lead runs `/nxs.distill <worktree-path>`, **when** the run writes files and commits, **then** every write lands in that worktree and the lead's own checkout is unchanged
- [ ] **Given** the run has ended, **when** the lead reads its report, **then** the report names the worktree and the command that removes it

## Notes

A path to a queue entry still drains that entry. The gates of an attended run stop where they stop today.

## Assumptions

- The command always runs the distillation unattended, and an attended run remains `/nxs.distill`
- The unattended session runs with the permission default that `close-epic.sh` uses today, and the decision record settles whether the shipped default changes
- The harness is already installed and signed in on the lead's machine, and the command does not install it
- The change ships as a minor release with a changelog entry

## Out of Scope

- Running `nexus close` from this command
- Merging a pull request from this command
- Support for hub and member checkouts beyond the refusal
- Any change to what `/nxs.distill` decides, or to its unattended contract
- A port of `implement-epic.sh`

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #910 | none |
| #911 | #910 |
| #912 | #910 |
| #945 | none |
