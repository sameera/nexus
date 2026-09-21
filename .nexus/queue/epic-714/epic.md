---
feature: "Pipeline Command Surface"
feature_path: docs/features/pipeline-command-surface
epic: "Load the distillation stage's exceptional paths only when they apply"
slug: distill-exceptional-paths-on-demand
created: 2026-09-20
type: enhancement
complexity: M
complexity_drivers: [six contracts extracted from one command document, every story edits that same document, conformance coverage moves from prompt wording to load behaviour]
concepts: []
link: "#714"
record: "#733"
record_state: closed
---

# Epic: Load the distillation stage's exceptional paths only when they apply

## Description

`/nxs.distill` states every rule it might need in one command document, and the whole document is read before the run knows which rules apply. Most runs take the ordinary path: a single-repo checkout, an epic entry, no recovery, no continuation hand-off, no domain registry. That run still reads the hub branches, the recovery procedure, the continuation-mode exceptions, the fix and intake rules, and the taxonomy gate. It pays for six paths it is not taking, on every invocation.

This epic moves each of those six paths out of the base stage and into a contract of its own. The base stage resolves what the run is — its mode, its workspace shape, the kind of each entry, whether a registry exists — and then reads exactly the contracts that resolution names. A run that takes none of the exceptional paths reads none of their instructions.

Nothing about what any path does changes. Every refusal, gate and safety property available today is available after the move; it is read at a different moment, by a run that has established it needs it. What changes is the cost of the ordinary run and the number of places one rule is stated.

## Success Metrics

- A drain with no recovery, no continuation hand-off, no hub workspace, no fix entry, no intake entry and no domain registry reads none of those six contracts.
- The ordinary single-repo epic drain's loaded size is smaller than it is today, and a check holds it under a recorded ceiling.
- Each exceptional rule is stated in exactly one contract; the base stage states none of it a second time.
- Every exceptional path behaves as it does today: the same refusals, the same gates, the same order of operations, verified by the suites that already cover them.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Recovery and continuation instructions load only for a run in that mode; Hub instructions load only in a hub workspace; Fix and intake instructions load only when an entry of that kind drains; Registry and taxonomy instructions load only when a registry exists; The ordinary drain's loaded size is measured and held under a ceiling

## User Stories

### Story #727: Recovery and continuation instructions load only for a run in that mode

- **story_type:** system
- **size:** M

**As a** delivery lead draining a closed queue, **I want** the stage to work out which run mode it is in before it reads any mode-specific instructions, **so that** an ordinary drain never pays for the recovery procedure or the continuation hand-off.

#### Acceptance Criteria

- [ ] **Given** an ordinary drain of a closed single-repo epic entry, **when** the stage resolves its run mode, **then** it reads neither the recovery instructions nor the continuation-mode instructions.
- [ ] **Given** a run asked to rebuild one entry from durable state, **when** the stage resolves that mode, **then** it reads the recovery contract and rebuilds the entry with the same steps, refusals and diagnostics it uses today.
- [ ] **Given** a run handed off from a close that already prepared its branch, **when** the stage resolves that mode, **then** it reads the continuation contract and takes the same branch, precondition and tree-state decisions it takes today.
- [ ] **Given** the base stage after this story, **when** its text is read end to end, **then** the recovery procedure and the continuation exceptions appear in it nowhere, and the point that names them states which resolved condition selects each.

#### Notes

This story establishes the convention the three that follow reuse: resolve first, name the contract, read it. It takes the two paths already stated as whole self-contained blocks, so the convention is proved on the cheapest extractions before the scattered ones move.

### Story #728: Hub instructions load only in a hub workspace

- **story_type:** system
- **size:** M

**As a** delivery lead draining in a single-repo checkout, **I want** the hub-only rules to live outside the base stage, **so that** a checkout that is not a hub never reads the rules for one.

#### Acceptance Criteria

- [ ] **Given** a drain in a single-repo checkout, **when** the stage resolves the workspace shape, **then** it reads no hub instructions at any phase of the run.
- [ ] **Given** a drain in a hub workspace, **when** the stage resolves that shape, **then** it reads the hub contract and produces the same queue-age report, reference form, diff range, anchor records and validation set it produces today.
- [ ] **Given** the base stage after this story, **when** its text is read end to end, **then** every rule that applies only to a hub is stated once, in the hub contract, and nowhere in the base stage.
- [ ] **Given** the suites that already cover hub behaviour, **when** they run against the moved contract, **then** they pass unchanged.

#### Notes

The hub rules are the scattered case: today they sit as a branch inside several phases rather than as one block. Gathering them is most of this story's work.

### Story #729: Fix and intake instructions load only when an entry of that kind drains

- **story_type:** system
- **size:** S

**As a** delivery lead draining epic entries, **I want** the fix and intake rules read only when an entry of that kind is in the queue, **so that** a queue holding only epic entries never reads either set.

#### Acceptance Criteria

- [ ] **Given** a queue whose entries are all epics, **when** the stage resolves each entry's kind, **then** it reads neither the fix instructions nor the intake instructions.
- [ ] **Given** a queue holding a fix entry, **when** the stage resolves that kind, **then** it reads the fix contract and applies the same limit on what that entry may change, and the same refusal when it exceeds it.
- [ ] **Given** a queue holding an intake entry, **when** the stage resolves that kind, **then** it reads the intake contract and applies the same rationale check and the same allowed changes it applies today.
- [ ] **Given** a queue holding entries of more than one kind, **when** the stage drains it, **then** it reads each kind's contract once and reports the run's per-kind counts as it does today.

### Story #730: Registry and taxonomy instructions load only when a registry exists

- **story_type:** system
- **size:** S

**As a** delivery lead working in a concept store with no domain registry, **I want** the classification and taxonomy rules read only where a registry is present, **so that** a store without one never reads rules that cannot fire.

#### Acceptance Criteria

- [ ] **Given** a concept store with no domain registry, **when** the stage surveys the store, **then** it reads no classification, taxonomy-gate or drift-advisory instructions, and the run behaves exactly as it does today.
- [ ] **Given** a concept store that has a domain registry, **when** the stage finds it, **then** it reads the taxonomy contract and files, gates and reports classifications as it does today.
- [ ] **Given** the base stage after this story, **when** its text is read end to end, **then** the classification rules, the taxonomy gate and the drift advisory appear in it nowhere.

#### Notes

This path is already gated on presence at run time. What moves is where the instructions are read, not when the behaviour fires.

### Story #731: The ordinary drain's loaded size is measured and held under a ceiling

- **story_type:** system
- **size:** S

**As a** maintainer of the pipeline, **I want** the ordinary drain's loaded size measured and checked, **so that** the saving this epic makes cannot be given back one edit at a time.

#### Acceptance Criteria

- [ ] **Given** the stage after the four extractions, **when** the ordinary single-repo epic drain's loaded size is measured, **then** that measurement becomes the recorded ceiling, stored with its date and the value it replaces.
- [ ] **Given** that recorded ceiling, **when** a change pushes the ordinary drain's loaded size above it, **then** a check fails and names both the measured value and the ceiling.
- [ ] **Given** a change that moves an exceptional rule back into the base stage, **when** the check runs, **then** it fails and names the rule that moved.
- [ ] **Given** the suites that pin the stage's wording today, **when** this story lands, **then** the assertions that hold incidental phrasing are replaced by assertions on which contracts a resolved run reads.

## Assumptions

- Each contract is read by the same loading mechanism the pipeline's other shared contracts already use, so no new delivery or install step is introduced.
- The six paths are separable as stated: no rule belongs to two of them in a way that forces a seventh shared contract.
- Measuring the ordinary drain's loaded size means counting the base stage plus the contracts an ordinary run resolves to read.

## Out of Scope

- Moving deterministic orchestration out of the stage and into the executable. That is a separate track of the initiative.
- Changing what any exceptional path decides, refuses or produces.
- Applying the same treatment to the other pipeline stages.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #727 | none |
| #728 | #727 |
| #729 | #727 |
| #730 | #727 |
| #731 | #727, #728, #729, #730 |
