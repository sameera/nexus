---
feature: "Artifact Prose Style"
feature_path: docs/features/artifact-prose-style
epic: "[codex] Decision Records That Are Quick to Review and Hide No Gaps"
slug: codex-decision-records-approval-contract-first
created: 2026-09-27
type: enhancement
complexity: M
complexity_drivers: [three Codex stage interactions, existing shared record contract and checks]
concepts: []
link: "#809"
record: "#819"
record_state: closed
---

# Epic: [codex] Decision Records That Are Quick to Review and Hide No Gaps

## Description

The [decision-record contract in #787](https://github.com/sameera/nexus/issues/787) puts the approval decision at the front of a record. A lead should get the same review surface when running Nexus in Codex: a short explanation in the epic's words, a brief that exposes blockers and trade-offs, grouped guarantees, and the full reasons in an appendix.

This epic makes that contract work through the Codex skill and its later stages. The shared record rules already exist. The remaining work is to make Codex's drafting, approval interaction, and later reading of the record satisfy those rules in a real Codex run.

## Success Metrics

- In a Codex run, a reviewer can find every blocker, trade-off, and pending epic or story amendment in the record's front sections before reading the appendix.
- Codex can approve a new-format record and carry it through analyze, close, and distill without losing a guarantee or decision.
- A record approved in the old format remains usable by the Codex stages.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Codex drafts the approval-first record; Codex presents and checks the record at approval; Codex carries both record formats through later stages

## User Stories

### Story #810: Codex drafts the approval-first record

- **story_type:** user
- **size:** S

**As a** lead using Codex, **I want** the decision record to explain the design and its costs up front, **so that** I can review the decision without hunting through repeated sections.

#### Acceptance Criteria

- [ ] **Given** a planned epic, **when** I draft its decision record in Codex, **then** the record follows #787's order: How it works, Approval brief, Guarantees, Risks and dependencies, optional Concept-store changes, and Design rationale and mechanism.
- [ ] **Given** a decision with a trade-off, **when** Codex drafts the record, **then** the Approval brief states the trade-off once in its appropriate group and the appendix preserves the full decision and reason.
- [ ] **Given** the record's front sections, **when** I read them without the appendix, **then** I can identify the design's blockers, pending amendments, accepted costs, and guarantees in the epic's vocabulary.

### Story #811: Codex presents and checks the record at approval

- **story_type:** user
- **size:** S

**As a** lead approving a record in Codex, **I want** the checkpoint to show the choices and refuse hidden gaps, **so that** approval covers what the record actually promises.

#### Acceptance Criteria

- [ ] **Given** a new-format draft in Codex, **when** the approval checkpoint appears, **then** it lists every offered alternative and model-added guarantee and risk for an explicit keep-or-cut decision.
- [ ] **Given** a guarantee without a supporting decision, a decision without a delivering story, or an unlisted trade-off, **when** Codex checks the draft, **then** filing stops and names the gap unless the Approval brief explicitly lists the unresolved item.
- [ ] **Given** a promised amendment to an epic or story, **when** Codex checks the live issue, **then** a missing amendment remains pending and appears first among the matters to resolve before approval.

### Story #812: Codex carries both record formats through later stages

- **story_type:** system
- **size:** M

**As a** lead running the Codex pipeline, **I want** later stages to read either approved record format, **so that** changing the review format does not lose a promise or its reason.

#### Acceptance Criteria

- [ ] **Given** a new-format approved record, **when** Codex runs analyze, close, and distill, **then** each stage reads the decisions and guarantees from that record and completes its existing record-dependent checks.
- [ ] **Given** an approved new-format record with a broken guarantee, **when** Codex runs analyze, **then** the result names the guarantee and reports it as critical.
- [ ] **Given** a record approved in the old format, **when** Codex runs analyze, close, or distill, **then** the stage accepts the record and its existing hash verification and decision reading still pass.

## Assumptions

- The Codex counterpart uses the shared record contract established by #787.
- A Codex run uses the same GitHub issue as the durable home of a decision record.

## Out of Scope

- Changing the record format approved in #787.
- Rewriting records already approved in the old format.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #810 | none |
| #811 | #810 |
| #812 | #810 |
