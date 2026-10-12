---
feature: "Model Guideline Alignment"
feature_path: docs/features/model-guideline-alignment
epic: "Stages Follow the Opus 5.5 Prompting Guidelines"
slug: stages-follow-opus-55-guidelines
created: 2026-10-06
type: enhancement
complexity: M
complexity_drivers: [six stories across seven stage and agent files, one shared continue rule loaded by every stage, two stages gain per-item fan-out]
concepts: []
link: "#889"
record: "#905"
record_state: closed
---

# Epic: Stages Follow the Opus 5.5 Prompting Guidelines

## Description

The Claude team's guidance for Opus 5.5, published at https://claude.dev/blog/getting-the-most-out-of-opus-5-5/, changes what a good stage instruction looks like. The model thinks before every reply on its own, keeps going on long work when it knows the finish line, and reports best when the report leads with what it is waiting on. The Nexus components were written for earlier models. They already carry none of the "think carefully" lines the guidance says to delete, and they use few emphasis capitals. What they lack is the additions: no stage names its finish line at the top, no shared rule says when to keep going and when to stop, and no completion report leads with what the lead is being waited on for.

This epic brings the components in line with that guidance. Every stage states its finish line and follows one continue rule. Every completion report has the same three-part shape. The two long-running stages, analyze and distill, fan their per-item reading out to subagents, check the evidence each one returns, and keep a run checklist that survives a context summary. The advisory agents stop asking the model to show its reasoning. The result is a pipeline whose stages run to completion with fewer unnecessary pauses and whose reports tell the lead first what needs them.

## Success Metrics

- A lead running a stage sees no mid-run pause that asks nothing and is not a named gate.
- Every completion report a stage command writes opens with what the lead is waited on for, before what changed and what was found; the close command's own report, which /nxs.close shows unchanged, keeps its shape.
- An analyze or distill run over an epic with many stories or entries ends with one consolidated table, and every row names the evidence behind it.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Every stage names its finish line and follows one continue rule; Every completion report leads with what the lead is waited on for; Advisory agents ask for a stated justification, not reproduced reasoning

## User Stories

### Story #890: Every stage names its finish line and follows one continue rule

- **story_type:** user
- **size:** M

**As a** lead running a stage, **I want** the stage to state at its start what "done" means and to keep going between gates without pausing to report, **so that** a run ends only at a gate I must decide or at its finish line.

#### Acceptance Criteria

- [ ] **Given** any stage command, **when** the lead reads its role block, **then** it states, in one or two sentences before any phase begins, the stage's finish line and the named gates at which it stops for the lead
- [ ] **Given** a stage between two of its gates, **when** a step needs no input from the lead, **then** the stage continues and puts its status note in the same message as its next action
- [ ] **Given** a stage reaching a step that is destructive or that it cannot continue without the lead, **when** it stops, **then** it names what it needs and the gate stays a stop as it is today
- [ ] **Given** the continue rule, **when** a maintainer reads the components, **then** the rule is stated once in one shared place and every stage command loads it rather than restating it, except /nxs.close, which runs one command and shows its output unchanged

#### Notes

The shared place follows the pattern the razor skill set: one normative home, pointers elsewhere. The existing `MANDATORY STOP` gates are not changed by this story.

### Story #891: Advisory agents ask for a stated justification, not reproduced reasoning

- **story_type:** system
- **size:** S

**As a** lead invoking the product council or the PM agent, **I want** the agents to be asked for a short stated justification of their recommendation rather than to show their reasoning, **so that** the request cannot be declined as a request to reproduce internal reasoning.

#### Acceptance Criteria

- [ ] **Given** the PM agent's output guidance, **when** a maintainer reads it, **then** no line asks the agent to show its work or explain its reasoning, and one line asks for a justification of a stated length
- [ ] **Given** the self-check blocks in the PM agent and the council command, **when** they are read, **then** they are either removed or rewritten as output requirements rather than pre-reply thinking steps
- [ ] **Given** the components as a whole, **when** a maintainer searches them, **then** no instruction asks the model to think carefully, think step by step, or reproduce its reasoning

### Story #892: Every completion report leads with what the lead is waited on for

- **story_type:** user
- **size:** S

**As a** lead reading the end of a run, **I want** every stage's completion report to open with what is blocked on me, then what changed, then what was found, **so that** I act on the dependency before I read the rest.

#### Acceptance Criteria

- [ ] **Given** any stage that writes a completion report, **when** the run ends, **then** the report carries the three headings Blocked on me, Changed and Found, in that order
- [ ] **Given** a run that ended with nothing blocked on the lead, **when** the report renders, **then** the first heading says so in one line rather than being omitted
- [ ] **Given** a stage whose report today carries stage-specific content such as the implementation sequence table, **when** the report is reshaped, **then** that content is kept under the heading it belongs to

### Story #893: Analyze marks what it could not confirm and where it looked

- **story_type:** user
- **size:** S

**As a** lead reading a conformance verdict, **I want** every criterion or guarantee the stage could not confirm to be marked as such with the places it looked, **so that** I can tell a gap in the build from a gap in the check.

#### Acceptance Criteria

- [ ] **Given** an acceptance criterion the stage cannot confirm from the implementation surface, **when** the verdict is written, **then** the criterion is marked unconfirmed rather than passed or failed
- [ ] **Given** an unconfirmed item, **when** the lead reads it, **then** it names where the stage looked, by file or by surface
- [ ] **Given** a verdict with unconfirmed items, **when** its severity counts are reported, **then** unconfirmed items are counted separately from findings and do not pass silently

### Story #894: Long-running stages keep a run checklist that survives a context summary

- **story_type:** system
- **size:** S

**As a** lead whose analyze or distill run is long enough to have its context summarized, **I want** the stage to keep a ticked checklist in its run folder, **so that** a run that lost its context picks up where it was instead of starting over.

#### Acceptance Criteria

- [ ] **Given** an analyze or distill run starting, **when** it has resolved its work items, **then** it writes one checklist file in its run folder with one line per item
- [ ] **Given** an item finished, **when** the stage moves on, **then** that item's line is ticked and any new item the run found is appended
- [ ] **Given** a run whose context was summarized mid-way, **when** it continues, **then** it re-reads the checklist and repeats no item already ticked, with zero duplicate verdicts or deltas

### Story #895: Analyze and distill fan out per item and check the evidence before consolidating

- **story_type:** user
- **size:** M

**As a** lead running analyze or distill over an epic with many stories or entries, **I want** the stage to give each story or entry to its own subagent, check each report's evidence before accepting it, and finish with one table, **so that** a large run stays accurate and ends in one place I can read.

#### Acceptance Criteria

- [ ] **Given** an analyze run with more than one story, **when** per-story conformance is checked, **then** each story is checked by its own subagent and the stage accepts a report only after checking the evidence it cites
- [ ] **Given** a distill run with more than one queue entry, **when** the deltas are synthesized, **then** each entry is read by its own subagent and the stage accepts a report only after checking the evidence it cites
- [ ] **Given** the fan-out has finished, **when** the stage consolidates, **then** it produces one table with one row per story or entry, the verdict, and the evidence
- [ ] **Given** a subagent report whose evidence does not hold, **when** the stage checks it, **then** the item is re-checked or marked unconfirmed rather than accepted

#### Notes

The gates and judgments the stages own today stay in the parent run. Only the per-item reading is delegated.

## Assumptions

- The guidance in the Claude team's post applies to the model the stages run on, and `model: inherit` stays the default for every component
- Each story's component change is a substantive stage change and gets its own version bump and changelog entry
- The shared continue rule is loaded by every stage rather than written into an adopter's own instructions file

## Out of Scope

- Rewriting any stage's gates, refusals or phase order beyond what the finish line, the continue rule and the report shape require
- Changes to the portable executable's commands or behaviour, other than its verdict record accepting an unconfirmed state; the specs that pin component text and the distill load ceiling are updated as the components change
- Fast mode, model flagging and other Claude Code settings the lead controls outside the components

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #890 | none |
| #891 | none |
| #892 | #890 |
| #893 | none |
| #894 | #890 |
| #895 | #890, #893 |
