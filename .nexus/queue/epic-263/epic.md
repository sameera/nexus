---
feature: "Lightweight Fix Lane"
feature_path: docs/features/lightweight-fix-lane
epic: "A lightweight lane for small fixes to reach the concept store"
slug: lightweight-fix-lane
created: 2026-08-17
type: enhancement
complexity: L
complexity_drivers: [seven stories with four sized M, the razor spans the authoring command and the drain, surgical edits to two command definitions over 1000 lines each, a new validator mode that must not disturb the existing checks]
concepts: [append-only-decision-log, forcing-function-razor, ephemeral-handoff-entry, distiller, distillation-pr, concept-store, provenance-reference, grep-native-retrieval, durable-close-record, conformance-gate, pr-worktree]
link: "#263"
record: "#271"
record_state: closed
---

# Epic: A lightweight lane for small fixes to reach the concept store

> ⚠️ **Utilization risk:** assessed L (1–2 weeks). Fills the sprint with no slack for overruns. Watch for scope creep.

## Description

The knowledge machinery is gated on epics. The distiller is the only writer of the concept store, it drains only entries, and an entry is drainable only when it holds both an `epic.md` and a `close-record.md`. Each of those two files has exactly one producer today, and both producers require an epic issue and at least one story sub-issue. So recording the reason behind a two-line fix costs four durable artifacts and two review cycles: an epic issue, a story issue, an implementation pull request, and a distillation pull request.

The practical result is that the reasons behind small fixes are not recorded at all. A developer facing that price either skips the rationale or dresses the fix as an epic. The first loses knowledge the store exists to hold. The second inflates the store with ceremony and buries the decisions that matter.

This epic adds a fifth entry point. A new `/nxs.fix` command creates the two files directly for a change that has already landed, taking one GitHub reference as its input and asking the developer why the change mattered. A structural rule, called the razor, keeps the lane honest. A fix entry may only append decision log entries, exactly one per changed page, and only to pages that already exist. It may not create a page, retire one, or change what a page asserts. The rule is enforced mechanically in the validator, on the computed page diff, before the distillation pull request opens. A change that needs to alter a page's stated behavior is a design change, and it keeps taking the epic lane.

## Success Metrics

- A developer records the reason for a small fix with one GitHub number as the only durable artifact required, against the four the epic lane forces today.
- Every fix entry that reaches a distillation pull request appends exactly one decision log entry per changed page and leaves the rest of that page byte-identical, apart from the `last_updated_by:` frontmatter line and trailing whitespace.
- A fix whose page changes would alter what a page asserts is refused with a named reason before the distillation pull request opens, rather than merged.
- Draining an epic entry behaves exactly as it did before this change.
- Running `/nxs.fix` creates nothing on GitHub and commits nothing to the repository.

## Personas

Per `docs/product/context.md`. The actor throughout this epic is the primary persona, the engineer on a small team adopting Nexus, in two moments of their work: landing a small fix and later running the drain. This epic adds no new persona.

## User Stories

### Story #264: Read a merged pull request's range without creating a worktree

**As a** developer landing a small fix, **I want** the pull-request helper to report a merge range on its own, **so that** a command that needs only the range does not have to check out a worktree to get it.

## Acceptance Criteria

- [ ] **Given** a merged pull request number, **when** the helper runs `range --pr <N>`, **then** it prints one JSON object carrying `repo`, `base`, and `head`, where `base` and `head` are full commit SHAs, and it exits 0.
- [ ] **Given** a pull request that is open, or closed without merging, **when** the helper runs `range --pr <N>`, **then** it exits non-zero with a named diagnostic and prints no range.
- [ ] **Given** the subcommand has completed, **when** the repository's worktree list is inspected, **then** no worktree was created and none was removed.
- [ ] **Given** a squash-merged pull request and a rebase-merged pull request, **when** the subcommand resolves each range, **then** the changed-file set implied by the resolved range matches the changed-file set the pull request reports.
- [ ] **Given** the existing `preflight`, `open`, and `remove` subcommands, **when** the new subcommand is added, **then** their behavior and output are unchanged.

## Notes

Reuse the existing range derivation rather than writing a second one. That derivation already handles squash, merge-commit, and rebase merges, including the changed-file-set check for the ambiguous squash-against-rebase case.

The existing `open --mode close` path returns the range only as a side effect of checking out a worktree. This subcommand exists because the fix lane needs the range and has no use for the worktree.

**story_type:** system · **size:** S

### Story #265: Validate that a changed page only gained a decision log entry

**As a** maintainer of the concept store, **I want** a validator mode that proves a page changed in no way except gaining one decision log entry, **so that** the razor is enforced mechanically instead of by asking a human to judge which kind of change they made.

## Acceptance Criteria

- [ ] **Given** a page whose only change against the base is one appended decision log entry, **when** the validator runs `--append-only-log --base <ref> <page paths...>`, **then** it exits 0 and reports no finding.
- [ ] **Given** a changed path whose git status against the base is added, deleted, or renamed, **when** the validator runs in append-only-log mode, **then** it exits non-zero and the finding names the status that failed.
- [ ] **Given** a page path that does not resolve at the base reference, **when** the validator runs in append-only-log mode, **then** it exits non-zero.
- [ ] **Given** a page that gains one decision log entry and also changes a Key Invariant, a Summary sentence, a `touches` value, an `aliases` value, a `domain` value, a `status` value, an Integration Points bullet, or any earlier log entry, **when** the validator runs in append-only-log mode, **then** it exits non-zero and the finding describes the change as altering what the page asserts rather than adding to its history.
- [ ] **Given** a page that gains zero decision log entries, or more than one, **when** the validator runs in append-only-log mode, **then** it exits non-zero.
- [ ] **Given** a page whose only difference outside the appended entry is the `last_updated_by:` frontmatter line or trailing whitespace, **when** the validator runs in append-only-log mode, **then** it exits 0.
- [ ] **Given** the validator is run without `--append-only-log`, **when** it validates the same pages, **then** every existing check and its exit behavior are unchanged.

## Notes

The byte-identity check needs no list of forbidden fields, which is why it is stated as a comparison rather than as an enumeration. Truncate the page at the line where the gained heading starts, remove the `last_updated_by:` line, normalize trailing whitespace, and compare the result byte for byte against the base content. Every forbidden edit lands inside the compared region, so nothing has to be enumerated and nothing can be forgotten.

The mode reuses the helpers the validator already has for reading a file at a git reference, counting decision log headings, and parsing frontmatter.

This story ships the check. Wiring it into the drain is a separate story.

**story_type:** system · **size:** M

### Story #266: Resolve a fix reference and its range, or refuse the fix

**As a** developer who has landed a small fix, **I want** the command to resolve my reference and the exact commit range before it writes anything, **so that** a fix is never recorded against the wrong commits or in a place the lane does not support.

## Acceptance Criteria

- [ ] **Given** a reference written as `123`, `#123`, or `acme/web-app#123`, **when** the command resolves it, **then** a bare reference resolves against the home repository, a qualified reference resolves against the named repository, and the command determines whether the number is an issue or a pull request.
- [ ] **Given** a reference that resolves to an issue carrying the repository's declared epic classification, **when** the command runs, **then** it stops, names `/nxs.epic` as the lane to use, and writes nothing.
- [ ] **Given** `.nexus/tmp/epic-<n>/` already exists for the same number, **when** the command runs, **then** it stops and writes nothing.
- [ ] **Given** the command is run inside a member repository of a workspace, **when** it starts, **then** it stops with a diagnostic naming the qualified-reference form to run from the hub, and writes nothing.
- [ ] **Given** the reference is a pull request that has not been merged, **when** the command resolves the range, **then** it stops and writes nothing.
- [ ] **Given** the reference is an issue with exactly one merged closing pull request, **when** the command resolves the range, **then** it takes the range from that pull request.
- [ ] **Given** a `--range <base>..<head>` argument, **when** the command resolves the range, **then** it uses those commits verbatim and does not prompt for a range.
- [ ] **Given** a reference to an issue with no merged closing pull request, or with more than one, and no `--range` argument, **when** the command resolves the range, **then** it asks the developer for the range and never falls back to a guessed default such as the previous commit.
- [ ] **Given** a resolved range whose `head` commit is not an ancestor of the trunk, **when** the command checks it, **then** the command stops and writes nothing.
- [ ] **Given** any of the resolution paths above, **when** the range is recorded, **then** `base` and `head` are full commit SHAs, never a branch name and never `HEAD`.

## Notes

Provenance is always the reference the developer named. The command never substitutes a pull request for the issue, or an issue for the pull request, even when it took the range from that pull request.

Refusing an epic and refusing a colliding entry directory are both guards against one silent, expensive failure: a fix entry shadowing an epic's materialization.

The trunk-ancestry rule is what keeps the entry drainable later. Recording a fix against work that has not landed guarantees the entry fails the drain's merge precondition and trains the operator to waive it.

This story resolves and refuses. It writes no files: #267 does that.

**story_type:** system · **size:** M

### Story #267: Create the fix entry from a resolved range

**As a** developer who has landed a small fix, **I want** to record why it mattered in one command, **so that** the reason reaches the concept store at a cost the change justifies.

## Acceptance Criteria

- [ ] **Given** a resolved reference and range, **when** the developer completes `/nxs.fix <ref>`, **then** the command creates `.nexus/tmp/fix-<n>/` holding exactly `epic.md` and `close-record.md`, and reports both paths and that `/nxs.distill` will drain them.
- [ ] **Given** the command has completed, **when** GitHub and the repository are inspected, **then** no issue, comment, branch, or pull request was created and nothing was committed.
- [ ] **Given** the created `epic.md`, **when** its frontmatter is read, **then** it carries `title`, `link` holding the reference the developer gave in canonical provenance form, `slug: fix-<n>`, and `entry_kind: fix`, and the file has no body.
- [ ] **Given** the created `close-record.md`, **when** it is read, **then** it carries one `range` entry of `repo`, `base`, and `head`, an `analyze:` value of `n/a — fix entry (no acceptance criteria)`, a `## Key Decisions` section holding the reason the developer gave, and a `## Deviation Rationale` section stating that a fix entry has no decision record to deviate from.
- [ ] **Given** the created `close-record.md`, **when** it is read, **then** it has no `record` key, no `record_hash` key, no `## Deferred Scope` section, and no `## Process Lesson` section.
- [ ] **Given** a resolved range, **when** the command prompts the developer, **then** it asks for exactly two things: the reason the change mattered, which is required, and the feature the fix belongs to, which the developer may leave empty.
- [ ] **Given** a resolved range, **when** the command builds that prompt, **then** it has already derived the description of what changed from the diff of the range, and it does not ask the developer to describe the change.
- [ ] **Given** the developer left the feature empty, **when** `epic.md` is written, **then** the `feature` key is omitted rather than written with a value the command guessed.
- [ ] **Given** a diff whose changed paths map to no page in the store, **when** the command prepares the prompt, **then** it prints a warning naming how many behaviors it found with no existing page, and it still writes the entry. The check is best-effort, so failing to warn is not a defect.
- [ ] **Given** the command has completed, **when** the run is inspected, **then** no approval checkpoint was presented and no `analyze-receipt.md` was written.

## Notes

The prompt for the reason is the lane's forcing function, and it is the only required human input. #266's range prompt is separate and conditional: it happens before this one, and only when the range cannot be resolved from the reference and no `--range` argument was given.

The warning in the second-to-last criterion is advisory and fails soft. It cannot be load-bearing, because this command writes no pages and can only guess at what the drain will later synthesize. The load-bearing gate is #269.

There is no approval checkpoint because the command writes nothing durable and nothing to GitHub. A second gate over a scratch directory would be ceremony.

The file names `epic.md` and `close-record.md` are deliberate. They assert nothing about an epic existing or about anything having been closed. They keep the drain's discovery change to one line instead of a parallel code path, and `entry_kind: fix` is the field that carries the truth.

**story_type:** user · **size:** M

### Story #268: Drain a fix entry into the concept store

**As a** developer whose fix carries a recorded reason, **I want** the distiller to drain the fix entry, **so that** the reason lands as a decision log entry on the page it belongs to.

## Acceptance Criteria

- [ ] **Given** `.nexus/tmp/fix-<n>/` holding both `epic.md` and `close-record.md`, **when** `/nxs.distill` runs, **then** it discovers that directory as a drainable entry alongside `.nexus/tmp/epic-<n>/`.
- [ ] **Given** a fix directory missing either file, **when** `/nxs.distill` runs, **then** it skips the entry, the same way it skips an epic entry missing either file.
- [ ] **Given** a drained fix entry, **when** the changed page is read, **then** it carries one new decision log entry holding the reason the developer gave, and that entry's heading carries the provenance reference recorded in `link`.
- [ ] **Given** a discovered fix entry, **when** the drain computes its deltas, **then** every delta is an update, and no delta creates a page, retires a page, adds or removes a `touches` neighbour, or sets `domain`.
- [ ] **Given** a discovered fix entry, **when** the drain writes its deltas, **then** each changed page gains exactly one decision log entry.
- [ ] **Given** a fix entry whose recorded reason maps to no page that already exists, **when** the drain processes it, **then** it reports a per-entry hard block named `no-existing-page`, writes nothing for that entry, and leaves the directory in place for a later run.
- [ ] **Given** a fix entry whose recorded `range.head` is not an ancestor of the trunk, **when** the drain runs its merge precondition, **then** the entry fails that precondition under the existing two-test form.
- [ ] **Given** a drained fix entry, **when** the drain reaches the step that removes committed entries, **then** it removes nothing for that entry and reports no missing removal target.
- [ ] **Given** a fix entry and an epic entry discovered in the same run, **when** the drain completes, **then** the epic entry is drained exactly as it was before this change.
- [ ] **Given** a drained fix entry, **when** the reciprocity fan-out and the atlas regeneration run, **then** both run unchanged and neither produces a change for that entry.

## Notes

Consumption derivation needs no widening. A fix entry's provenance token is `#<n>` or `<owner>/<repo>#<n>`, which is exactly what the existing matcher handles in structured positions. A fix that succeeds always leaves a provenance token, because the razor requires exactly one appended entry per changed page and that entry's heading is a structured provenance position.

A fix whose reason maps to no page is the razor firing correctly, not a defect in the lane. A decision with no page is a decision that needs a page, and creating pages is epic work.

The reciprocity fan-out is vacuous by construction here, because a fix entry may not add or remove a `touches` neighbour. Atlas regeneration is a no-op in practice for the same reason, but it still runs so the atlas check cannot drift.

**story_type:** system · **size:** M

### Story #269: Block the distillation pull request when a fix entry breaks the razor

**As a** maintainer of the concept store, **I want** the drain to run the validator in append-only-log mode on a fix entry's page changes before it opens the pull request, **so that** a fix can never leave a page whose body contradicts its own log.

## Acceptance Criteria

- [ ] **Given** a fix entry whose staged page changes satisfy the razor, **when** the drain runs the validator in append-only-log mode against those pages, **then** the validator exits 0 and the distillation pull request opens.
- [ ] **Given** a fix entry whose staged page changes edit a Key Invariant or a Summary sentence, **when** the drain runs the validator in append-only-log mode, **then** the validator exits non-zero, no distillation pull request opens, and the reported message names the fix entry, names the page, states that changing what a page asserts is a design change, and tells the reader to plan it with `/nxs.epic`.
- [ ] **Given** an epic entry in the same run, **when** the drain runs the validator, **then** append-only-log mode is not applied to that entry's pages.
- [ ] **Given** a fix entry, **when** the drain runs its validation step, **then** the validator's existing checks still run against the changed pages in addition to append-only-log mode.

## Notes

The gate rides the contract the drain already honours, that a non-zero exit from the validator blocks the pull request. No new gate semantics are introduced, which is the point: the razor cannot be talked past by a prompt.

This is the load-bearing half of a two-sided check. The advisory warning in `/nxs.fix` fails soft and is not a gate, because the authoring command writes no pages and cannot see what the drain will later synthesize. Putting the weight here puts it on the side that can see the page writes it constrains.

The refusal message matters as much as the exit code. A developer who hits it needs to learn that their change alters what a page asserts, which makes it a design change rather than a fix.

**story_type:** system · **size:** S

### Story #270: Refuse to run the conformance gate against a fix entry

**As a** developer, **I want** `/nxs.analyze` to stop with a clear reason when it is pointed at a fix entry, **so that** an undefined check does not degrade into a misleading result.

## Acceptance Criteria

- [ ] **Given** a fix entry, **when** `/nxs.analyze` is invoked against it, **then** it stops with a reason stating that a fix entry has no acceptance criteria, no success metrics, and no decision record to check against.
- [ ] **Given** `/nxs.analyze` has stopped against a fix entry, **when** the entry directory is inspected, **then** no `analyze-receipt.md` was written and no file in the entry was modified.
- [ ] **Given** an epic entry, **when** `/nxs.analyze` runs against it, **then** its behavior is unchanged.

## Notes

`/nxs.analyze` checks implemented code against an epic's acceptance criteria, its success metrics, and the decision record's invariants. A fix entry has none of the three, so running the gate against one is not optional, it is undefined. Stopping is the honest outcome.

The fix entry's `analyze:` value is a literal string rather than a blank, so the state is greppable and can never be read as a waiver.

The lane drops conformance checking because there is nothing to check, and pays for it with a hard structural bound on what a fix may write.

**story_type:** system · **size:** S

## Assumptions

- `/nxs.fix` is a command definition under `.claude/commands/`, driven the way the other `nxs.*` commands are. The only new code is the validator mode in Story 2 and the helper subcommand in Story 1.
- The `range --pr <N>` subcommand is added to the existing pull-request worktree helper script rather than published as a new skill.
- The entry files keep the names `epic.md` and `close-record.md` for a fix entry, as the specification decides, so the drain changes one line of discovery instead of gaining a parallel code path. The `entry_kind: fix` field carries the truth about what the entry is.
- New TypeScript reaches the repository's 95% coverage bar through spec files beside each changed module.
- The trunk branch is resolved the way the drain already resolves it, and no new configuration key is added.
- Refusing a member repository is a hard block with no migration path, matching how `/nxs.close --pr` already behaves.

## Out of Scope

- A migration path that lets a member repository drain its own fix entries. The hub path covers the case, by running `/nxs.fix` from the hub with a qualified reference.
- A `--pr` worktree flow for `/nxs.fix`. The lane commits nothing, so there is nothing to commit on a branch.
- Batching. `/nxs.fix` creates one entry per run, and `/nxs.distill` batches as it already does.
- Back-filling fixes that landed before this lane existed. The lane starts empty.
- Any change to `/nxs.close`, `/nxs.epic`, or `/nxs.decision-record`.
- Fixing the `--require-epic` guard in the epic resolver. The specification names it as the lane's first customer, to be done through the lane once the lane exists.
- Letting a fix strike through an existing invariant in place. The specification defers this loosening until there is evidence the razor binds too tightly.
- A drift advisory that watches for the lane becoming the default entry point.

## Open Questions

None.

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #264 | none |
| #265 | none |
| #266 | #264 |
| #267 | #266 |
| #268 | #267 |
| #269 | #265, #268 |
| #270 | #267 |
