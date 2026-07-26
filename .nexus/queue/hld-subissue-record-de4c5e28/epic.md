---
feature: "Multi-Repo Workspaces"
feature_path: docs/features/multi-repo-workspaces
epic: "The Decision Record Becomes an Approvable Sub-Issue"
slug: hld-subissue-record
created: 2026-07-25
type: enhancement
complexity: L
complexity_drivers:
    [
        "six pipeline surfaces change together (epic, hld, analyze, close, distill, resolver)",
        "new resolver obligation: classify sub-issues so a decision record is not mistaken for a story",
        "one canonical record hash four stages depend on",
        "high cross-story interlock — the resolver and the hash gate four downstream stories",
    ]
concepts: ["issue-sourced-planning", "committed-queue", "distiller", "nexus-pipeline"]
link: "#139"
---

# Epic: The Decision Record Becomes an Approvable Sub-Issue

> ⚠️ **Utilization risk:** assessed L (1–2 weeks). Fills the sprint with no slack for overruns. Watch for scope creep — the command-line extraction and the publishing-config consolidation are explicitly out of scope below.

## Description

An epic's **decision record** — the architectural *why* the design stage produces — has no durable home. It is written into the queue entry, and the queue is a drain buffer: the distiller deletes the entry once the distillation pull request merges. The rationale for every architectural decision therefore evaporates by design, leaving nothing addressable for a later concept page or issue to point at. Since planning stopped committing anything, the situation is worse: at design time there is no committed entry to write it into at all, so the record lands in a gitignored scratch path and both the conformance gate and the drain run in a downgraded mode that skips invariants entirely.

This epic moves the record onto the surface that is already durable and already the source of truth: a **sub-issue of the epic issue**, carrying the record as its body. One copy, born durable, addressable by the issue-reference form the knowledge store already uses for provenance. Approval stops being a Nexus-authored field and becomes a native act — closing the sub-issue — so the timeline supplies who approved and when for free, and an unapproved record visibly blocks the work downstream of it.

Making the record durable also makes it verifiable. A canonical **record hash** of the approved body, stamped into the conformance receipt and the close record, turns "the design changed after we analysed it" into a detectable condition — a second staleness axis beside the code commit the gates already track. Not every epic needs a record: a simple one is marked as not needing design at planning, and the design stage can conclude that none is warranted without filing anything, so the gate never demands an artifact the work does not justify.

## Success Metrics

- For every epic planned under issue-sourced planning, exactly one copy of its decision record exists at any moment — the record sub-issue's body. The design stage writes no decision-record file for such an epic.
- Record approval carries an auditable actor and timestamp with no Nexus-authored approval field: both are read from the issue timeline.
- A record body modified between conformance analysis and close is reported as stale on the record axis in every such case, named separately from a stale code commit.
- Exactly one digest implementation exists across every stage that stamps or verifies the record hash.
- Draining an epic that has an approved record sub-issue sources its *why* from the issue, with zero reads of a decision-record file.
- An epic marked as not needing design completes the pipeline through close with no record and no waiver.

## Personas

Per `docs/product/context.md`. One role deviation: the **delivery lead** — the person who runs the lead-side stages (design, conformance, close, drain) and holds the approval act — is the primary actor across every story here. The canonical primary persona (engineer on a small team adopting Nexus) appears only as the party blocked by an unapproved record.

## User Stories

### Story 1: The resolver tells a record sub-issue apart from a story

**As a** delivery lead, **I want** the epic reconstruction to recognise a record sub-issue as a decision record rather than a user story, **so that** attaching the record to the epic does not silently corrupt the story set every downstream stage validates against.

## Acceptance Criteria

- [ ] **Given** an epic issue with N story sub-issues and one record sub-issue, **when** the epic is reconstructed, **then** its user-story set contains exactly the N story sub-issues and the record sub-issue is absent from it.
- [ ] **Given** that same epic, **when** it is reconstructed, **then** the output carries the record sub-issue's issue number and its open/closed state as recoverable fields.
- [ ] **Given** an epic with no record sub-issue, **when** it is reconstructed, **then** no record field is emitted (never a fabricated or placeholder value) and the reconstruction is byte-identical to the pre-change output for that epic.
- [ ] **Given** the publishing classification is label-based, **when** a sub-issue carries the configured record label, **then** it is classified as the decision record; **given** the classification is type-based, **then** the configured record issue type classifies it — both resolved through the existing shared publishing resolver, with no second config reader introduced.
- [ ] **Given** a record sub-issue that cannot be fetched, **when** reconstruction runs, **then** it aborts with a named diagnostic and produces no output file, preserving the fail-closed guarantee.

## Notes

`story_type: system` · size **M**.

The reconstruction currently fetches sub-issues and treats every one as a story. Without this, filing the record as a sub-issue would inject it into the story set, and every stage that iterates stories — design coverage, conformance, close's all-stories-closed gate — would act on a phantom story.

This is the foundation for the rest of the epic. The byte-identical requirement for an epic with no record sub-issue is the regression guard: reconstruction is a shared surface and every existing epic must resolve exactly as before.

### Story 2: One canonical hash of an approved record body

**As a** delivery lead, **I want** a single canonical way to hash an approved record body, **so that** the stages that stamp and verify it cannot disagree about whether the design changed.

## Acceptance Criteria

- [ ] **Given** the same record body, **when** the hash is computed on two separate runs, **then** the two values are identical.
- [ ] **Given** two bodies that differ only in trailing whitespace or line-ending convention, **when** each is hashed, **then** the two values are equal — the canonicalisation rule is stated, not incidental.
- [ ] **Given** two bodies differing in any other character, **when** each is hashed, **then** the values differ.
- [ ] **Given** the delivered system, **when** the codebase is searched for digest computation over a record body, **then** exactly one implementation is found and every stamping or verifying stage obtains its value from it.

## Notes

`story_type: system` · size **S**.

Three stages stamp or verify this value and a fourth will. Independent implementations would drift on canonicalisation and report false staleness — a design that did not change reported as changed, blocking a close for no reason.

The sibling `pipeline-gh-cli` scope, which owns the eventual command surface for these verbs, is blocked on this epic, so it cannot supply the implementation — it must exist here and be the one that scope later wraps.

### Story 3: Only design-warranting epics carry a decision record

**As a** delivery lead, **I want** the needs-design decision made explicitly at planning and revisable at design time, **so that** a simple epic is never blocked downstream waiting for a record nobody intends to write.

## Acceptance Criteria

- [ ] **Given** an epic whose complexity rollup is M or larger, **when** the epic issue is filed, **then** it carries the needs-design label.
- [ ] **Given** an epic whose complexity rollup is S, **when** the epic issue is filed, **then** it does not carry the needs-design label.
- [ ] **Given** the lead judges at the design checkpoint that no record is warranted, **when** they choose the no-design-needed outcome, **then** no sub-issue is filed, the needs-design label is removed from the epic, and the run reports that the epic proceeds without a record.
- [ ] **Given** the target repository does not yet define the needs-design label, **when** it is applied, **then** it is created first.
- [ ] **Given** an epic filed by hand outside Nexus with no needs-design label and no record sub-issue, **when** the downstream stages run against it, **then** they treat it as an epic without a decision record rather than erroring.

## Notes

`story_type: user` · size **M**.

The M-or-larger threshold is a stated default, so the behaviour is predictable; the lead can add or remove the label on the issue directly. The downstream gates read the label and the sub-issue, never a remembered decision — which is what makes the hand-filed case work for free.

Touches two stages: the epic stage applies the label from its complexity rollup, and the design stage can revoke it via the no-design-needed outcome. Both halves answer one question — does this epic need a record — so they ship together.

### Story 4: The design stage files the record as a sub-issue and drives the label lifecycle

**As a** delivery lead, **I want** the design stage to file the decision record as a sub-issue of the epic and move the epic's labels accordingly, **so that** the record is durable and addressable the moment it is produced, and the epic's state is visible on the issue itself.

## Acceptance Criteria

- [ ] **Given** a planned epic that needs design, **when** the design stage completes, **then** a sub-issue of that epic exists whose body is the decision record and which is classified as a decision record, and the run writes no decision-record file anywhere — neither into a committed queue entry nor into the gitignored scratch path.
- [ ] **Given** that same run, **when** it completes, **then** the epic issue no longer carries the needs-design label and does carry the in-progress label.
- [ ] **Given** an epic that already has a record sub-issue, **when** the design stage is re-run for it, **then** no second record sub-issue is created and the existing one is the target.
- [ ] **Given** the lead approves the record at the design checkpoint, **when** they choose to approve now, **then** the record sub-issue is closed in the same run and the issue timeline shows the approving account and the approval time.
- [ ] **Given** a label the target repository does not yet define, **when** the stage applies it, **then** the label is created first, so no run fails or leaves the epic mislabelled.

## Notes

`story_type: user` · size **M**.

Approval is the close of the sub-issue, not a field Nexus writes. Closing early (approve-now, in the same run) and closing later (the lead reviews and closes on GitHub) are the same act, so both paths converge without a second approval mechanism and the timeline is the only audit surface needed.

The "writes no decision-record file anywhere" criterion is the point of the epic: one copy, and it is the issue body.

### Story 5: A record revision reopens, records, updates, and re-closes

**As a** delivery lead, **I want** a change to an approved record to go through reopen, a dated comment, a body update, and a re-close, **so that** the current body is always the approved one and every earlier approved state stays reconstructible.

## Acceptance Criteria

- [ ] **Given** an approved record that must change, **when** the revision flow runs, **then** the sub-issue is reopened, a dated comment records what changed, why, and the hash of the body being superseded, the body is updated to the new record, and the sub-issue is re-closed.
- [ ] **Given** a record revised N times, **when** its comment trail is read, **then** every previously approved body state and the reason each was superseded are recoverable from that trail alone.
- [ ] **Given** a record sub-issue that is closed, **when** any design-stage path other than the revision flow runs, **then** none of them edits its body — a body change is reachable only through a reopen.
- [ ] **Given** a revision completes, **when** the record hash is recomputed, **then** it differs from the superseded hash, so any receipt stamped against the earlier body is detectably out of date.

## Notes

`story_type: system` · size **S**.

The freeze is what makes the hash meaningful: if the body could be edited while closed, "approved" would name a moving target and every downstream stamp would be unfalsifiable. Reopening is therefore not ceremony — it is the only way to make the record editable, and it re-fires the downstream blocks (STORY-139.06, STORY-139.07) until the record is approved again.

### Story 6: Conformance blocks on an unapproved record and stamps the record hash

**As a** delivery lead, **I want** conformance analysis to refuse to run while the decision record is unapproved, and to record which record it checked against, **so that** no analysis result is produced against a design still being argued over, and a later change is detectable.

## Acceptance Criteria

- [ ] **Given** an epic whose record sub-issue is open, **when** conformance analysis runs, **then** it stops with a named diagnostic identifying the open record issue, and produces neither a receipt file nor a pull-request review.
- [ ] **Given** an epic whose record sub-issue is closed, **when** conformance analysis runs, **then** it runs in full mode with the invariants taken from the record issue body, and the recorded mode states full.
- [ ] **Given** an epic that legitimately has no decision record, **when** conformance analysis runs, **then** it runs in the existing downgraded no-invariant mode and states that it did so — unchanged from today's behaviour.
- [ ] **Given** a full-mode run, **when** the result is recorded, **then** both the receipt frontmatter and the pull-request review's machine-readable block carry the record issue reference and the canonical record hash, alongside the analysed commit.

## Notes

`story_type: system` · size **M**.

This is where the downgraded no-invariant posture stops being the norm and becomes the exception it was always meant to be — reached only when the epic genuinely has no record, never because the record had nowhere durable to live.

Producing no receipt at all on the block (rather than a receipt marked blocked) matters: close treats a missing receipt as "analyze never ran", which is the correct reading.

### Story 7: Close blocks on any open sub-issue and carries the record baseline durably

**As a** delivery lead, **I want** close to block on any open sub-issue regardless of kind, treat a changed record as its own staleness axis, and carry the record reference onto the durable surfaces, **so that** an epic cannot close over an unapproved design and the deviations it records name what they deviated from.

## Acceptance Criteria

- [ ] **Given** an epic with any open sub-issue — a story or the decision record — **when** close runs, **then** it hard-blocks and names each open sub-issue and its kind.
- [ ] **Given** a conformance receipt whose stamped record hash differs from the record issue's current body hash, **when** close evaluates the receipt, **then** it classifies the receipt as stale, names the record axis explicitly and separately from the code-commit axis, and requires the same explicit waiver the code-commit staleness path already requires.
- [ ] **Given** deviations detected by the close-from-diff pass, **when** the close record is written, **then** each deviation's rationale names the record issue as the baseline it deviates from.
- [ ] **Given** close completes, **when** the close record and the epic's close comment are written, **then** both carry the record issue reference and the approved-body hash, and the comment expresses the reference as an issue reference — never as a queue path, which the drain deletes.
- [ ] **Given** an old-contract epic whose entry carries a committed decision-record file and has no record sub-issue, **when** close runs, **then** it uses that file as the baseline exactly as today.

## Notes

`story_type: system` · size **M**.

Close's existing gate is all-child-story-issues-closed; broadening it to any open sub-issue is what makes an unapproved record block the epic without a separate mechanism.

The close comment is the durable surface, so the record reference must reach it as an issue reference. A queue path would dangle the moment the distillation PR merges — the exact failure this epic exists to fix.

### Story 8: The drain takes its why from the record issue, hash-verified

**As a** delivery lead, **I want** the drain to fetch the *why* from the record issue and verify it against the hash recorded at close, **so that** the rationale reaching the knowledge store is provably the rationale that was approved and analysed.

## Acceptance Criteria

- [ ] **Given** a queue entry whose epic has an approved record sub-issue, **when** the drain reads the *why*, **then** it fetches the record issue body and reads no decision-record file for that entry.
- [ ] **Given** the fetched body's hash equals the hash stamped in the close record, **when** the drain proceeds, **then** synthesis continues normally; **given** the hashes differ, **then** the drain hard-errors for that entry with a named diagnostic and writes nothing for it.
- [ ] **Given** an entry whose epic has no decision record, **when** the drain reads the *why*, **then** it falls back to the close record as the sole source — unchanged from today.
- [ ] **Given** an old-contract entry that carries a committed decision-record file, **when** the drain reads the *why*, **then** that file is still read, so entries in flight before this change drain unchanged.

## Notes

`story_type: system` · size **S**.

Closes the loop: the record that was durable at design time and gated at close is the same record the concept store's rationale derives from, and the hash proves it. The hard-error on mismatch is deliberate — a silently-drained mismatched record would write rationale into the store for a design nobody approved, which is worse than a blocked drain.

## Assumptions

- An epic warrants a decision record when its complexity rollup is M or larger; an S epic does not. The lead can override by editing the label on the issue.
- The record sub-issue is classified through the existing publishing-classification setting (label-based here, type-based where configured) resolved by the shared publishing resolver — no new configuration surface and no second reader.
- The existing `decision-record` label is reused as the record classification label rather than minting a new one; the needs-design and in-progress labels are new and are created on first use.
- Approval requires no reviewer-assignment rule: whoever closes the sub-issue is the approver, and the timeline records it.
- The record's body remains human prose with no machine block, exactly as the record is written today; only its home changes.

## Out of Scope

- Extracting the GitHub transaction layer for the epic and design stages into the `nexus` command-line tool — that is the `pipeline-gh-cli` stub, which is blocked on this epic.
- Folding the record label and type mappings into the declared publishing configuration block — that is the `github-publishing-config` stub; this epic consumes the resolver that stub's shipped portion already provides.
- Workspace, hub-born, and multi-pull-request close behaviour — `hub-close-multi-pr` and `story-analyze-hub`. This epic is single-repo first and workspace-agnostic.
- Migrating decision records already committed in old-contract queue entries onto sub-issues. Those entries keep their file; both paths coexist until they clear.
- A continuous-integration-callable preflight that enforces the open-record block outside a Nexus session — that is part of `pipeline-gh-cli`.

## Open Questions

<!-- none -->

## Implementation Sequence

| STORY | Issue | blocked_by |
|---|---|---|
| STORY-139.01 | #140 | none |
| STORY-139.02 | #141 | none |
| STORY-139.03 | #142 | none |
| STORY-139.04 | #143 | STORY-139.01, STORY-139.03 |
| STORY-139.05 | #144 | STORY-139.04 |
| STORY-139.06 | #145 | STORY-139.01, STORY-139.02, STORY-139.04 |
| STORY-139.07 | #146 | STORY-139.02, STORY-139.06 |
| STORY-139.08 | #147 | STORY-139.02, STORY-139.07 |
