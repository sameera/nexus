---
feature: "Unattended Epic Implementation"
feature_path: docs/features/unattended-implementation
epic: "Implement an epic unattended with one nexus command"
slug: unattended-epic-implementation
created: 2026-10-11
type: enhancement
complexity: M
complexity_drivers: [replaces a 586-line script and its codex counterpart with one command, two M stories run in a fixed order inside one run, depends on an unfinished epic (#923)]
concepts: ["scope-claim", "decision-record", "pr-story-resolution", "issue-sourced-planning", "epic-approval-gate", "publishing-config-resolution", "nexus-pipeline"]
link: "#928"
record: "#966"
record_state: closed
---

# Epic: Implement an epic unattended with one nexus command

## Description

Today a lead implements an epic unattended with `utils/implement-epic.sh`. That script lives only in this repository, so an adopter cannot run it. It implements the stories, opens a draft pull request, and repeats analyze and fix rounds until no Critical or High finding is open. Each fix round reads a captured prose report and may fix any finding, including one whose only honest fix is a change to the decision record.

This epic makes the same flow one `nexus` command. Its fix loop reads the findings and their severities from the analyze verdict. It works only Critical, High and Medium findings, and it stops and reports to the lead when a fix would need a decision-record change or an architectural change. A code-review loop with `/nxs.code-review`, and posting its final ranking on the pull request, are deferred to a separate epic.

The command depends on two epics that are not finished. #923 makes the analyze verdict structured, so a script can read each finding's severity and how to resolve it. #918 adds `/nxs.code-review`. Work on this epic starts only after both are closed.

## Success Metrics

- A run on an epic whose findings all fit the loop ends with a pull request marked ready for review and an analyze verdict for its head commit.
- No fix round changes code for a Low analyze finding.
- Every run that meets a finding needing a decision-record or architectural change stops and names that finding to the lead, with no commit made for it.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Implement an epic unattended with one nexus command; Fix only Critical to Medium findings that the decision record allows

## User Stories

### Story #929: Implement an epic unattended with one nexus command

- **story_type:** user
- **size:** M

**As a** lead, **I want** to run one `nexus` command with an epic number and get a pushed branch, a pull request and a published analyze verdict, **so that** I can implement an epic unattended in any repository that installs Nexus.

#### Acceptance Criteria

- [ ] **Given** a planned epic with an approved decision record, **when** the lead runs `nexus implement-epic <epic>`, **then** each story is implemented in its own commit in blocked-by order, the branch is pushed, and a draft pull request names every story it closes.
- [ ] **Given** the fix loop ends with no blocking finding open, **when** the command finishes, **then** the pull request carries an analyze verdict published for its head commit and is marked ready for review.
- [ ] **Given** any stage stops before it finishes, **when** the command exits, **then** it exits non-zero, names the stage and the reason, and the pull request, when one exists, states that the run stopped and why.
- [ ] **Given** the implementation stage meets something it cannot do from the checkout, such as a decision record's "Before implementation" item, **when** it stops, **then** its goal ends at once instead of re-prompting until the turn cap, and the command exits non-zero naming what blocked it, before it pushes a branch or opens a pull request.
- [ ] **Given** a departure or finding on the pull request that needs an answer, **when** the run reaches it, **then** it accepts or waives the item only when the answer can be inferred from an artifact a person wrote before the run started, names that artifact in the answer, and otherwise leaves the item unanswered for a person.
- [ ] **Given** the lead selects the codex harness instead of the default claude harness, **when** the command runs, **then** every stage runs under the selected harness, and the command applies the same checks and stop rules to what each stage produces.

#### Notes

The command replaces `utils/implement-epic.sh` and `utils/codex/implement-epic.sh`, which are removed in the same change.

A `/goal` that can hold only by finishing keeps its Stop hook re-prompting a run that has correctly stopped, because nobody can run `/goal clear` in `-p` mode. Epic #31 in sameera/magpie burned its whole turn budget that way on R1 of record #38. `utils/implement-epic.sh` fixes it by giving the goal a second outcome, a final line beginning `Implementation blocked:`, which the goal check accepts and the script reads back to stop before pushing. The command keeps an equivalent.

### Story #930: Fix only Critical to Medium findings that the decision record allows

- **story_type:** user
- **size:** M

**As a** lead, **I want** the fix loop to work only Critical, High and Medium findings whose fix needs no decision-record or architectural change, **so that** the loop spends its turns only on findings it may fix and hands me the rest.

#### Acceptance Criteria

- [ ] **Given** an analyze verdict with Critical, High, Medium and Low findings, **when** a fix round starts, **then** it works the Critical, High and Medium findings and leaves every Low finding untouched.
- [ ] **Given** a fix round, **when** it builds its work list, **then** it takes the findings and their severities from the latest analyze verdict, and does not read the epic or the decision record end to end.
- [ ] **Given** a Critical, High or Medium finding whose fix needs a change to a decision-record guarantee or decision, or an architectural change, **when** the loop meets it, **then** the loop stops without changing code for it and reports each such finding to the lead with the reason.
- [ ] **Given** no Critical, High or Medium finding remains open, **when** the loop checks the latest verdict, **then** it ends and the command confirms that this verdict, already published on the pull request, is for its head commit.
- [ ] **Given** a round that leaves the open findings unchanged, or a round cap that is reached, **when** the loop checks, **then** it stops and reports the findings still open.

## Assumptions

- Work on this epic starts only after #918 and #923 are closed.
- The analyze verdict carries each finding's severity in a form a script can read.
- The code-review loop is deferred to a separate epic, so an unattended run reads no code-review ranking.
- The command ships to adopters. This makes an exception to the product anti-goal that Nexus does not write the target project's code.

## Out of Scope

- Revising the decision record or making an architectural change during the run. The lead makes those changes.
- Answering a departure or waiving a finding when the answer cannot be inferred from the local scratch or other artifacts. A person answers those.
- Merging the pull request, or running close or distill.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #929 | none |
| #930 | #929 |
