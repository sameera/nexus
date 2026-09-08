---
feature: "Landed Change Intake"
feature_path: docs/features/landed-change-intake
epic: "A landed-change lane for design changes that shipped without planning"
slug: landed-change-lane
created: 2026-09-08
type: enhancement
complexity: L
complexity_drivers: [six stories with four sized M, a third entry kind that touches discovery and every phase of the drain, surgical edits to two command definitions over 1000 lines each, a refactor of the fix lane that must leave its entries byte-identical]
concepts: [fix-lane, fix-razor, ephemeral-handoff-entry, distiller, distillation-pr, provenance-reference, pr-worktree, durable-close-record, backlog-stub, conformance-gate, decision-record]
link: "#483"
record: "#504"
record_state: closed
---

# Epic: A landed-change lane for design changes that shipped without planning

> ⚠️ **Utilization risk:** assessed L (1–2 weeks). Fills the sprint with no slack for overruns. Watch for scope creep.

## Description

Engineers land design-grade changes through pull requests that never passed through planning. The pull request often carries the full reasoning: the problem, the alternatives that were closed off, the invariants the change relies on, and the follow-ups it leaves behind. None of that reaches the concept store. The fix lane refuses such a change correctly, because its razor allows one appended log entry to a page that already exists, and a landed design change needs new pages, changed assertions and new invariants. The only other route is a retroactive epic, which manufactures acceptance criteria from the diff and then runs the conformance gate against them. So the reasoning stays in the pull request and the store goes stale. In one member repository, of the last forty merged pull requests, four linked an issue and none linked a Nexus story.

This epic adds a lane for a change that has already landed and whose reasoning lives in its pull request. The lead gives one merged pull request reference. The lane derives what changed from the diff, reads why from the pull request body, its review threads and its commit messages, and drafts the close record from those. It asks the lead only about what the pull request does not answer. After one approval gate it writes a drainable entry and files the pull request's follow-ups as epic stubs. The drain treats the entry with the full epic vocabulary: pages may be created, what a page asserts may change, and invariants may be added or retired.

The lane buys this reach with one review instead of two. An epic's reasoning is approved once as a decision record and again in the distillation pull request. A landed change's reasoning is approved only in the distillation pull request. That is acceptable because the code has already shipped, so the record describes what is rather than what will be. The drain counts these entries so the team can see when the lane is becoming the default way work reaches the store.

## Success Metrics

- A lead records a landed design change with one pull request reference as the only input, creating no epic issue, no story issue and no decision record.
- A drained landed entry creates a page or changes what a page asserts in at least one case where a fix entry would have stopped with no existing page.
- Every follow-up the pull request names is either an open epic stub issue after the drain or was dropped by the lead at the lane's approval gate.
- Draining an epic entry or a fix entry behaves exactly as it did before this change.
- The drain report states how many landed entries it drained, separately from epics and fixes.

## Personas

Per `docs/product/context.md`. The actor is the primary persona in two moments: the engineer whose change has landed, and the lead who records it and reviews the distillation pull request. This epic adds no new persona.

## Smallest Usable Version

Record a landed change from its pull request; The drain accepts a landed entry with the epic vocabulary.

## User Stories

### Story #484: Shared reference and range resolution for landed work

**As a** lead, **I want** the fix lane and the landed-change lane to resolve a reference, its commit range and its qualification the same way, **so that** a rule fixed in one lane cannot silently differ in the other.

## Acceptance Criteria

- [ ] **Given** a bare, hash-prefixed or qualified reference, **when** either lane resolves it, **then** both produce the same repository identity, the same full-SHA range and the same qualified reference.
- [ ] **Given** a member checkout, **when** either lane runs, **then** it refuses before anything is looked up, and the refusal names the hub and the qualified reference form.
- [ ] **Given** a pull request that is open or was closed without merging, **when** either lane resolves it, **then** it stops and writes nothing.
- [ ] **Given** a merged pull request the fix lane recorded before this change, **when** the fix lane records it again after the extraction, **then** the two entry files are byte-identical to the earlier output.

## Notes

The fix lane's decision record said the shape shared by two non-epic entry kinds deserves a name of its own once the second kind appears. This story is that naming. Which phases move and what the skill is called belongs to the decision record.

### Story #485: Record a landed change from its pull request

**As a** lead, **I want** to give one merged pull request reference and get a drafted close record whose reasoning comes from the pull request itself, **so that** the engineer's stated reasoning reaches the store without anyone retyping it.

## Acceptance Criteria

- [ ] **Given** a merged pull request reference, **when** the lead runs the lane, **then** what changed is derived from the diff of the recorded range and the lead is never asked to describe it.
- [ ] **Given** the pull request body, its review threads or its commit messages state why a decision was made, **when** the record is drafted, **then** that decision carries that reason and the lead is not asked for it.
- [ ] **Given** the pull request names an alternative it rejected, **when** the record is drafted, **then** the alternative appears with the trade-off it lost on.
- [ ] **Given** a decision the diff shows but the pull request does not explain, **when** the record is drafted, **then** the lead is asked why for that decision only.
- [ ] **Given** the drafted record, **when** the lane's approval gate renders it, **then** the lead approves or declines before any file or issue is written, and declining writes nothing.

## Notes

The pull request is the reasoning source in the same sense that a developer design document is the source for an imported decision record: it is read as authoritative and never copied verbatim. The lane writes nothing to GitHub before its approval gate. The command's name and the recorded entry kind are decision-record content.

### Story #486: Deferred scope from a landed change becomes epic stubs

**As a** lead, **I want** the follow-ups a pull request names to become open epic stubs, **so that** work the engineer deferred is in the backlog query instead of in a pull request nobody reopens.

## Acceptance Criteria

- [ ] **Given** the pull request names follow-ups, **when** the lane's approval gate renders, **then** each follow-up is listed as a deferred item the lead can keep or drop.
- [ ] **Given** approval, **when** the lane files the kept items, **then** each is an open epic stub issue carrying the unplanned label, on the same terms as a stub filed at close.
- [ ] **Given** an item the lead dropped, **when** the lane files, **then** no issue is created for it and the close record does not mention it.
- [ ] **Given** the filed stubs, **when** the entry is written, **then** its close record lists their issue numbers and carries none of their scope.

## Notes

Filing an issue is irreversible, so stubs are filed only after the lane's approval gate, as the close stage already does. A landed change's follow-ups are the one part of it that has not shipped, so they are the one part that still belongs in planning.

### Story #487: The drain accepts a landed entry with the epic vocabulary

**As a** lead, **I want** the drain to distil a landed entry the way it distils a closed epic, **so that** a landed design change can create pages and change assertions instead of stopping at the fix razor.

## Acceptance Criteria

- [ ] **Given** a landed entry, **when** the drain synthesises its deltas, **then** a delta may create a page, change what a page asserts, and add or retire an invariant.
- [ ] **Given** a landed entry, **when** the deterministic steps run, **then** the append-only check is not applied to any of its pages.
- [ ] **Given** the drain's checkpoint before the distillation pull request, **when** that checkpoint renders, **then** for each landed entry it names every page created and every page whose assertions change.
- [ ] **Given** an entry whose directory name and recorded kind disagree, **when** the drain discovers it, **then** that entry stops with the existing named hard block and nothing is written for it.
- [ ] **Given** epic entries and fix entries discovered in the same run as a landed entry, **when** the drain runs, **then** they drain exactly as they did before this change.

## Notes

The entry's reasoning comes from its close record alone, which the drain already accepts for an epic with no decision record. Provenance is the qualified pull request reference, which the consumption derivation already matches.

### Story #488: An edited pull request is caught at the drain

**As a** lead, **I want** the drain to refuse a landed entry whose pull request body changed after it was recorded, **so that** the store never carries reasoning that the pull request no longer states.

## Acceptance Criteria

- [ ] **Given** a pull request body edited after the entry was recorded, **when** the drain runs, **then** the entry is refused with a diagnostic naming a re-run of the lane as the remedy, and nothing is written for it.
- [ ] **Given** an unchanged pull request body, **when** the drain runs, **then** the entry drains.
- [ ] **Given** a pull request that cannot be fetched, **when** the drain runs, **then** the entry is refused and no local copy of the body is used in its place.

## Notes

This is the treatment the drain already gives a decision record whose issue body changed after close.

### Story #489: The other stages point at the lane

**As a** lead, **I want** the fix lane, the conformance gate and the drain report to know the landed-change lane exists, **so that** a change that belongs there is sent there and its use stays visible.

## Acceptance Criteria

- [ ] **Given** a fix lane run whose behaviours map to no existing page or would change what a page asserts, **when** the advisory warning renders, **then** it names the landed-change lane as the lane to use.
- [ ] **Given** a landed entry, **when** the conformance gate is pointed at it, **then** it stops with a stated reason and writes no receipt.
- [ ] **Given** a drain that drained one or more landed entries, **when** it reports and opens the distillation pull request, **then** both state the count of landed entries separately from epics and fixes.

## Assumptions

- The lane runs in a single-repo checkout or a hub and refuses a member checkout, as the fix lane does.
- The entry is written to the version-ignored area and drained on the same terms as the other ephemeral entries: presence with a close record makes it drainable, and consumption is derived from the store at the trunk.
- A landed entry carries no decision record issue, no conformance receipt and no process lesson.
- The reasoning sources read are the pull request body, its review threads and its commit messages; engineer scratch in the queue is not read.

## Out of Scope

- A pull request template for adopter repositories with why, alternatives, invariants and follow-ups sections.
- Verifying or changing whether the pull-request stages can follow a cross-repo linked issue in a hub setup.
- Back-filling pull requests that landed before the lane exists. The lane starts empty.
- Any loosening of the fix razor. A change that fits the fix lane keeps taking it.
- Refusing a pull request that closes a planned story or epic issue. The lane accepts any merged pull request for now; the refusal that keeps a linked pull request on the standard path is later scope.

## Open Questions

None.

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #484 | none |
| #485 | #484 |
| #486 | #485 |
| #487 | #485 |
| #488 | #485, #487 |
| #489 | #487 |
