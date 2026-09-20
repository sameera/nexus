---
feature: "Pipeline Command Surface"
feature_path: docs/features/pipeline-command-surface
epic: "State each distillation rule once, at the point it acts"
slug: state-each-distillation-rule-once
created: 2026-09-20
type: enhancement
complexity: M
complexity_drivers: [five stories over one command document and one diff-derivation library, one contradictory rule that must be decided before anything is removed, four removals that automated phrase checks currently pin in place]
concepts: []
link: "#713"
record: "#720"
record_state: closed
---

# Epic: State each distillation rule once, at the point it acts

## Description

`/nxs.distill` states many of its rules twice. A rule appears beside the action it governs and again in a closing recap, and the per-kind differences between an epic entry, a fix entry and an intake entry recur in eight separate places. Two copies of a rule is two places to read and two places to change, and one pair has already drifted: one passage says an unreachable range SHA blocks the entry, and the next permits a fallback for exactly that case.

This epic removes the duplication without changing what the stage does. Each rule ends up in one place, at the action it governs. The three entry kinds get one contract instead of eight scattered restatements. The checkpoint, the pull request body and the completion report render one run result instead of restating it three times. The explanations of what the delegated programs do internally come out, leaving the invocation, the output the stage consumes, and the action for each class of failure.

The lead who runs the stage sees the same checkpoint, approves the same pull request and reads the same counts. What changes is the cost of every run and the cost of every future edit. A run that loads the command pays for the duplication before it reads a single queue entry, and a maintainer changing one rule has to find both copies.

## Success Metrics

- The command document falls from 13,035 words to no more than 11,600 words. Initiative #709 projected a band of 8,000 to 10,000 words for six Track 1 consolidation items; this epic carries four of them, and shortening the metadata and usage prose is out of scope here, so that band is not reachable within this scope.
- A run over an unchanged queue produces the same checkpoint decisions, the same pull request body content and the same completion counts as a run before this epic.
- No rule named in the initiative's findings is stated in more than one place in the command document.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

One contract for an unreachable range SHA; One entry-kind contract for epic, fix and intake; One run summary rendered at the checkpoint, the pull request and the report; The Constraints recap goes

## User Stories

### Story #715: One contract for an unreachable range SHA

**As a** delivery lead draining the queue, **I want** one rule for what happens when a recorded range SHA cannot be reached, **so that** the stage does not behave one way in one passage and another way in the next.

## Acceptance Criteria

- [ ] **Given** an entry whose recorded range SHA cannot be reached, **when** the stage derives that entry's diff, **then** it reports one named outcome for that condition and takes exactly one action on it.
- [ ] **Given** the command document, **when** a reader searches it for what happens to an unreachable range SHA, **then** exactly one passage states the rule and no other passage states a different one.
- [ ] **Given** that condition, **when** a caller reads the derivation step's result, **then** the outcome is distinguishable from every other failure class without reading prose.
- [ ] **Given** an entry whose recorded range SHAs are all reachable, **when** the stage runs, **then** the diff it analyzes is identical to the diff it analyzed before this story.

## Notes

The two passages in conflict today are the per-entry error list and the legacy single-repo fallback that follows it; the closing recap states the fallback a third time. Which behaviour survives is a decision, not a transcription, so it is settled before anything is removed.

### Story #716: One entry-kind contract for epic, fix and intake

**As a** maintainer changing how one entry kind drains, **I want** the three kinds' differences stated in one place, **so that** I change one passage rather than hunting for eight.

## Acceptance Criteria

- [ ] **Given** a drained entry of any kind, **when** the stage resolves what kind it is, **then** it resolves it once and every later step reads that one resolution.
- [ ] **Given** the command document, **when** a reader looks up how one kind differs from another on any axis, **then** one passage answers for all three kinds.
- [ ] **Given** a run that drains one kind, **when** the run completes, **then** its checkpoint, its pull request and its report match what the same run produced before this story.
- [ ] **Given** a run that drains two kinds together, **when** the run completes, **then** each entry was treated by its own kind's rules and neither kind's drain was altered by the other.

### Story #717: One run summary rendered at the checkpoint, the pull request and the report

**As a** delivery lead approving a distillation, **I want** the checkpoint, the pull request and the completion report to render one result, **so that** the three surfaces cannot disagree about what the run did.

## Acceptance Criteria

- [ ] **Given** a completed run, **when** the checkpoint, the pull request body and the completion report each state the run's result, **then** all three state the same counts, the same entry outcomes and the same decisions.
- [ ] **Given** a value that appears on more than one of those three surfaces, **when** a maintainer changes what it holds, **then** they change it in one place.
- [ ] **Given** a run in which nothing was skipped and nothing was blocked, **when** each of the three surfaces renders, **then** each says so in the same form it says so today.
- [ ] **Given** a run that drained no intake entry, **when** the checkpoint renders, **then** the intake block is absent, as it is today.

### Story #718: The tool-internal explanations go

**As a** maintainer of the delegated programs, **I want** the command document to stop explaining how they work inside, **so that** changing one of them does not mean editing a second description of it.

## Acceptance Criteria

- [ ] **Given** the command document's description of a step the stage delegates, **when** a reader reads it, **then** it states how to invoke the step, what output the stage consumes, and the action for each class of failure.
- [ ] **Given** that same description, **when** a reader reads it, **then** it states none of the delegated step's internal ordering, parsing, checking or formatting behaviour.
- [ ] **Given** a run over an unchanged queue, **when** it completes, **then** its artifacts match the artifacts the same run produced before this story.

## Notes

Four delegated steps carry such explanations today: diff derivation, concept validation, atlas generation and the drift advisory.

### Story #719: The Constraints recap goes

**As a** maintainer changing one of the stage's rules, **I want** the closing recap gone, **so that** there is no second copy of a rule to leave stale.

## Acceptance Criteria

- [ ] **Given** the command document, **when** a reader reaches its end, **then** it carries no section that restates rules already stated beside the actions they govern.
- [ ] **Given** a whole-run safety property that no action point states, **when** the recap is removed, **then** that property is still stated exactly once.
- [ ] **Given** every rule the removed section stated, **when** a reader looks for it, **then** it is found at the action it governs.
- [ ] **Given** an automated check that asserted the removed copy of a rule, **when** it runs, **then** it asserts the surviving statement and asserts no less than it asserted before.

## Assumptions

- This epic changes what the command document says, not what the stage does: a run over the same queue produces the same artifacts.
- An automated check that pins an exact phrase of the command document is updated in the same story that moves or removes that phrase.
- The word count is measured by a plain word count over the authored command document, taken the same way on the pre-epic commit and the final commit, against a baseline of 13,035 words. This supersedes the initiative's figure of 13,197, which measured the generated skill with its runtime binding subtracted. Decision record #720 settles it.

## Out of Scope

- Loading the stage's exceptional-path contracts only when they apply, which is a separate epic.
- Moving the stage's deterministic orchestration out of the prompt into a structured tooling surface.
- Shortening the command document's metadata and usage prose.
- Re-pointing the phrase-matching checks onto structured results instead of document text.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #715 | none |
| #716 | none |
| #717 | none |
| #718 | #715 |
| #719 | #715, #716, #717 |
