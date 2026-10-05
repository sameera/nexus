---
feature: "PR-Driven Delivery"
feature_path: docs/features/pr-driven-delivery
epic: "Close becomes a deterministic subcommand"
slug: close-deterministic-subcommand
created: 2026-10-03
type: enhancement
complexity: L
complexity_drivers: [three M stories chained through one close run, close's outputs must keep the shape distill reads, retires a stage and its script stage in one release]
concepts: []
link: "#830"
record: "#872"
record_state: closed
---

# Epic: Close becomes a deterministic subcommand

> ⚠️ **Utilization risk:** assessed L (1–2 weeks). Fills the sprint with no slack for overruns. Watch for scope creep.

## Description

Today close is a model-driven stage. It re-reads the diff, mines key decisions, asks the lead why the code departs from the record and stops at a checkpoint before it writes anything to GitHub. So the one-command close script cannot run without someone at the terminal, and every close costs a model pass over work analyze already judged.

After #829, the pull requests' verdicts carry every judgment close makes: the key decisions, each departure with its answer and who accepted it, the record decisions the code supersedes, and the deferred scope the lead approved. This epic turns close into a plain `nexus` command that reads those verdicts. It gates on #828's evidence, writes the close record and the close comment in the shape distill already reads, files the approved scope, closes the epic issue and hands off to distill. When something needs a person, it stops and names the reason. It never asks.

`/nxs.close` stays only so existing habits keep working. It calls the new command and says to call it directly. Distill does not change.

## Success Metrics

- Close runs no model pass and asks no question on any epic.
- The one-command close script runs from merge to an open distillation pull request with no one at the terminal.
- Distill drains an epic closed by the new command with no change to distill.
- Every close that stops names the reason and the remedy.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Close runs without a model and stops instead of asking; Close writes its record from the pull requests' verdicts; Close files the approved scope and hands off to distill; A record revised after close can still be re-stamped; Close writes no process lesson; The old close command runs the new one; The close script runs unattended from merge to distill

## User Stories

### Story #864: Close runs without a model and stops instead of asking

- **story_type:** user
- **size:** M

**As a** lead, **I want** close to run as a plain command that asks nothing, **so that** a merged epic closes with no model pass and no one at the terminal.

## Acceptance Criteria

- [ ] **Given** a merged pull request whose every story is current, **when** I run the close command, **then** it finishes with no model pass and no question
- [ ] **Given** an open sub-issue, a member checkout or a story that is not current, **when** I run the close command, **then** it stops, names the reason and the remedy, and writes nothing to GitHub
- [ ] **Given** a revised record or a landed-file mismatch, **when** I run the close command, **then** it proceeds and states the waiver only when a trusted waiver is already on the pull request, and otherwise stops and names the waiver to post; **given** a blocking finding, it proceeds only when the pull request's verdict records the finding as waived, and otherwise stops and names answering on the pull request and running analyze to record the answer
- [ ] **Given** an epic with no committed queue entry, **when** I run the close command, **then** it creates the epic's queue entry on a fresh distill branch, as close does today

### Story #865: Close writes its record from the pull requests' verdicts

- **story_type:** user
- **size:** M

**As a** lead, **I want** close to write the close record and the close comment from the pull requests' verdicts, **so that** what distill learns comes from judgments made before the merge.

## Acceptance Criteria

- [ ] **Given** verdicts that carry key decisions and answered departures, **when** close runs, **then** the close record and the close comment carry the same key decisions and deviation rationale, each departure naming who accepted it
- [ ] **Given** a close record the new command wrote, **when** distill reads it, **then** distill finds every field it reads today, in the same shape
- [ ] **Given** a departure marked as superseding a record decision, **when** close runs, **then** it posts one amendment comment on the decision record naming each superseded decision, and posts nothing when there is none
- [ ] **Given** close runs, **when** it writes its record, **then** it reads no diff and asks no question about rationale

### Story #866: Close files the approved scope and hands off to distill

- **story_type:** user
- **size:** M

**As a** lead, **I want** close to file the deferred scope I approved on the pull request and hand off to distill, **so that** nothing after the merge needs me.

## Acceptance Criteria

- [ ] **Given** deferred scope a trusted person approved on the pull request, **when** close runs, **then** each approved item is filed as an unplanned epic issue that the close record names, and scope nobody approved is not filed
- [ ] **Given** a story with no pull request of its own and a trusted waiver comment on that story's issue, **when** close runs, **then** it writes that story's marker
- [ ] **Given** close has written its record, **when** it finishes, **then** it has pushed the distill branch, posted the close comment, closed the epic issue and written the hand-off note in today's format
- [ ] **Given** the close comment fails to post, **when** close reports, **then** the epic issue stays open and close names the command that posts the comment

### Story #867: A record revised after close can still be re-stamped

- **story_type:** user
- **size:** S

**As a** lead, **I want** to re-stamp a closed epic whose decision record was revised, **so that** distill can still drain it.

## Acceptance Criteria

- [ ] **Given** a closed epic whose record was revised and approved again, and a trusted waiver on each merged pull request accepting the new revision, **when** I run close's recovery, **then** it stamps the new record hash, takes the record's decisions from the new body, keeps the deviation rationale, and distill accepts the entry
- [ ] **Given** a revised record and a merged pull request with neither a verdict judged against the new revision nor a trusted waiver accepting it, **when** I run close's recovery, **then** it stops and names re-running analyze on that pull request or posting the waiver, and once every merged pull request has a verdict against the new revision it rebuilds the key decisions and deviation rationale from those verdicts
- [ ] **Given** a revised record that is still open, **when** I run close's recovery, **then** it stops and names approving the record

### Story #868: Close writes no process lesson

- **story_type:** user
- **size:** S

**As a** lead, **I want** close to stop writing a process lesson nothing reads, **so that** a close leaves only artifacts some stage uses.

## Acceptance Criteria

- [ ] **Given** an epic closed by the new command, **when** I read the close record and the close comment, **then** neither names a lesson and no lesson file was written
- [ ] **Given** a new project, **when** I run setup, **then** setup does not create the lesson folder
- [ ] **Given** a discovery closed with no build, **when** its note is written, **then** the note is written as today, and the folder is created if it is absent

### Story #869: The old close command runs the new one

- **story_type:** user
- **size:** S

**As a** lead used to `/nxs.close`, **I want** it to run the new close command, **so that** my habit keeps working while I learn the new name.

## Acceptance Criteria

- [ ] **Given** a merged pull request, **when** I run `/nxs.close --pr <N>`, **then** it runs the new close command with the same arguments and gives the same result
- [ ] **Given** `/nxs.close` ran the new command, **when** it finishes, **then** it tells me to call the new command directly next time
- [ ] **Given** `/nxs.close` without `--pr`, **when** I run it, **then** it refuses and names the form that works, as today

### Story #870: The close script runs unattended from merge to distill

- **story_type:** user
- **size:** S

**As a** lead, **I want** the one-command close script to run close without me, **so that** I start it and come back to a distillation pull request.

## Acceptance Criteria

- [ ] **Given** a merged pull request that was analyzed before merge, **when** I run the close script, **then** it runs close and distill with no one at the terminal
- [ ] **Given** close stops, **when** the script reports, **then** it prints close's reason and starts no distill
- [ ] **Given** the Codex entry point of the script, **when** I run it, **then** it behaves the same way

### Story #877: A pull request shows its verdict's judgments to no reader but Nexus

- **story_type:** user
- **size:** S

**As an** engineer whose pull request carries an analyze verdict, **I want** the machine-read judgments kept out of the rendered comment, **so that** my pull request shows the summary I act on, not tens of thousands of characters of data.

## Acceptance Criteria

- [ ] **Given** analyze publishes a verdict on a pull request, **when** anyone views the pull request, **then** the comment shows the summary and the verdict block, and none of the judgments' content
- [ ] **Given** a verdict published in the earlier, visible form, **when** analyze, its answer-recording run or close reads it, **then** each reads the same items, answers, key decisions and deferred scope it reads today
- [ ] **Given** the judgments of an epic the size of #829's (#874: 32,783 characters of judgments), **when** analyze publishes its verdict, **then** every departure, finding and result keeps its file list, and the published comment is under 20,000 characters
- [ ] **Given** an answer reason that quotes the judgments marker, a comment closer or a fenced block, **when** the verdict is published and read back, **then** it reads back unchanged and no reader parses a second block
- [ ] **Given** a published verdict, **when** an engineer asks the `nexus` command line for its judgments, **then** it prints them as readable JSON

## Notes

Prerequisite for #864: close reads every judgment through this block, so its format settles before close is built on it. Agreed shape: the block's JSON is compressed and encoded inside an HTML comment, behind the same marker, and the one parser keeps reading the old fenced form.

## Assumptions

- #828 and #829 have shipped, so close's evidence gate exists and the verdicts carry every judgment close writes.
- The pipeline sentence in the project guide, close's own description and the PR-driven delivery docs are updated when this code lands.

## Out of Scope

- Any change to distill or to what distill reads.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #864 | #877 |
| #865 | #864 |
| #866 | #865 |
| #867 | #865 |
| #868 | #865 |
| #869 | #866, #867 |
| #870 | #866 |
| #877 | none |
