---
feature: "PR-Driven Delivery"
feature_path: docs/features/pr-driven-delivery
epic: "Tmp-First Analyze & Close Artifacts, with GitHub Fallback for Distill"
slug: tmp-first-analyze-close-artifacts
created: 2026-07-29
type: enhancement
complexity: L
complexity_drivers: [three-command contract change across /nxs.analyze, /nxs.close, /nxs.distill, durability-model change touching existing invariants (born-at-close, drain-SLO, distill's merge precondition), new GitHub-fallback path for distill's *why* source]
concepts: []
link: "#170"
record: "#176"
record_state: closed
---

# Epic: Tmp-First Analyze & Close Artifacts, with GitHub Fallback for Distill

> ⚠️ **Utilization risk:** assessed L (1–2 weeks). Fills the sprint with no slack for overruns —
> watch for scope creep, particularly in the distill fallback story.

## Description

Under issue-sourced planning (#114), a **local (non-`--pr`)** run of `/nxs.analyze` already resolves
an epic it doesn't find committed by materializing it under the gitignored `.nexus/tmp/`, and writes
`analyze-receipt.md` beside it there — nothing to commit, nothing durable, by design. `/nxs.close`,
however, still talks about writing `close-record.md` "into the committed queue entry" even when the
entry it inherited is that same `.nexus/tmp/` materialization. There is no born-at-close mechanism
for the local path (that only exists for `--pr` mode, in Phase 0.5), and in single-repo or hub mode a
local close never runs `git commit` itself — so today, a local close against an issue-sourced epic
produces a `close-record.md` that the spec calls "committed" but that no step ever actually commits.
(**Member mode is the exception**: its Phase 7.5 migration does commit the entry, into the hub queue —
Story 5 carries that path.) `/nxs.distill` then has nothing reliable to drain: it scans only the
committed queue for a `close-record.md`.

This epic makes the **local, same-sitting flow** the primary case it should already be: the same
person runs `/nxs.analyze` then `/nxs.close` then `/nxs.distill` back to back, so `analyze-receipt.md`
and `close-record.md` are legitimately **transient** — they exist to hand off from one command to the
very next, not to survive to a different session or machine. Both land in `.nexus/tmp/` and
`/nxs.distill` looks there first, consuming the entry directly without requiring anyone to commit a
throwaway file. `--pr` mode is materially unaffected — it already commits `close-record.md` onto the
distill branch (Phase 7.6) because those artifacts have no feature PR to ride, and `/nxs.analyze --pr`
already publishes its result as a PR review rather than a file. Those two mechanisms stay as they are.

The gap this closes is **recovery when `.nexus/tmp` is gone** — a different machine, a cleared tmp
directory, a distill run days after the close. For a `--pr`-closed epic, `/nxs.distill` can already
fall back to durable GitHub state: the analyze verdict lives in the PR's published review, and the
close record's Key Decisions + Deviation Rationale prose is already posted verbatim on the epic
issue's close comment (`/nxs.close` Phase 8.2). This epic wires that fallback into distill's entry
discovery. For a **local, non-`--pr`** close, there is no PR to fall back to — if `.nexus/tmp` is gone,
distill has no durable copy of the close record's rationale to recover. This epic requires distill to
report that condition precisely (name the entry, name why it can't be drained) rather than silently
mistaking it for "not yet closed" or fabricating an empty rationale; the exact resolution (a hard
block vs. a degraded close-record-only drain) is a judgment call for `/nxs.decision-record` to settle
against this epic's invariants, not something decided here.

## Success Metrics

- A local close of an issue-sourced epic (`/nxs.analyze` → `/nxs.close`, no `--pr`) in single-repo or
  hub mode produces zero new files in the committed queue — `analyze-receipt.md` and `close-record.md`
  both live under `.nexus/tmp/` — and nothing requires a manual `git add`/`git commit` to hand off to
  `/nxs.distill`. (Member mode still migrates its entry into the hub queue, as today.)
- A tmp-resolved entry is drained **exactly once**: after its distillation-PR merges, a later
  `/nxs.distill` run does not rediscover it.
- `/nxs.distill` run immediately after such a local close drains the entry with no extra flags and no
  prior commit, in the same sitting.
- `/nxs.distill --recover <epic-issue>` run against a `--pr`-closed epic whose `.nexus/tmp` is empty
  (fresh checkout, cleared tmp) recovers the analyze verdict and the close record's rationale from
  GitHub, with no content loss versus draining it fresh off the worktree. (Amended at implementation
  per record #176: recovery is an explicit per-entry path, never a discovery source — an ordinary
  no-argument run does not scan closed epic issues.)
- `/nxs.distill` never silently drains an epic with fabricated or missing rationale, and never
  silently treats a genuinely-closed-but-unrecoverable local entry as "not yet closed."

## Personas

Per `docs/product/context.md`. The **Secondary — Solo developer** persona is the direct motivator for
the local same-sitting flow (Description); the **Primary — Engineer on a small team** persona is the
one who hits the tmp-cleared / different-machine recovery case this epic's distill fallback covers.

## User Stories

### Story #171: Local analyze receipts are contractually tmp-only for issue-sourced epics

**As an** engineer running `/nxs.analyze` locally against an issue-sourced epic, **I want**
`analyze-receipt.md` to land under `.nexus/tmp/` as a stated contract rather than incidental resolver
behavior, **so that** `/nxs.close` and `/nxs.distill` can depend on where it lives without
re-deriving it.

## Acceptance Criteria

- [ ] **Given** a local (non-`--pr`) `/nxs.analyze` run against an issue-sourced epic (materialized
      by the resolver, no committed entry), **when** the receipt is written, **then** it is written
      under `.nexus/tmp/` beside the resolver-materialized `epic.md`, and the command's own
      documentation states this placement as intentional, not an artifact of where the epic happened
      to resolve.
- [ ] **Given** a local run against an old-contract entry whose `epic.md` is already committed under
      `.nexus/queue/`, **when** the receipt is written, **then** it is still written into that
      committed directory, unchanged from today.
- [ ] **Given** `--pr` mode, **when** analyze runs, **then** it continues to publish a PR review only
      (no receipt file) — unchanged from today.

## Notes

Mostly a spec clarification pinning today's resolver behavior as a hard contract Story
`STORY-170.02`/`STORY-170.03` depend on; expected to be low-risk / low-new-code. Part of epic #170.

### Story #172: Local close writes ephemeral artifacts to .nexus/tmp, never an implied commit

**As an** engineer closing an epic locally without a PR, **I want** `close-record.md` written to
`.nexus/tmp/` (alongside the born-here `epic.md`, when one was materialized there) instead of a path
the spec calls "committed" but nothing actually commits, **so that** a same-sitting local close needs
no manual git step to hand off to `/nxs.distill`.

## Acceptance Criteria

- [ ] **Given** a local close of an epic resolved from `.nexus/tmp` (the issue-sourced, #114 norm),
      **when** `/nxs.close` writes its artifacts, **then** `close-record.md` (and `epic.md`, if this
      is where it was first materialized) is written under `.nexus/tmp/`, and the Phase 7 checkpoint
      summary describes it as ephemeral hand-off content — never as "committed."
- [ ] **Given** a local close of an old-contract entry with an already-committed `epic.md`, **when**
      `/nxs.close` writes its artifacts, **then** `close-record.md` still lands in that committed
      `.nexus/queue/` directory, unchanged from today.
- [ ] **Given** `--pr` mode, **when** `/nxs.close --pr` runs, **then** nothing changes: Phase 0.5 /
      Phase 7.6 keep committing the born-at-close `epic.md` + `close-record.md` onto the distill
      branch, because those artifacts have no feature PR of their own to ride.
- [ ] **Given** a local close under the new tmp-only path, **when** the epic issue is closed, **then**
      the close comment (Phase 8.2) still carries the close record's Key Decisions + Deviation
      Rationale prose in full — this is now the *only* durable copy of that rationale for a local
      close, so nothing in the comment-writing step may be skipped or thinned as a result of this
      change.

## Notes

Part of epic #170. Depends on `STORY-170.01`'s tmp contract for analyze receipts.

### Story #173: Distill drains a same-sitting tmp entry with nothing to commit first

**As an** engineer who just ran `/nxs.analyze` then `/nxs.close` locally in one sitting, **I want**
`/nxs.distill` to discover and drain that `.nexus/tmp` entry directly, **so that** I don't have to
commit a receipt/record pair whose only purpose was to hand off to the very next command.

## Acceptance Criteria

- [ ] **Given** a `.nexus/tmp` entry carrying both `epic.md` and `close-record.md` for an epic not yet
      drained, **when** `/nxs.distill` runs with no arguments, **then** it discovers and drains that
      entry in the same run as the ordinary committed-queue scan (Input Resolution), without
      requiring the entry to exist under `.nexus/queue/`.
- [ ] **Given** such a tmp-resolved entry, **when** Phase 5's "remove the consumed entry" step runs,
      **then** the committed deletion is **re-aimed** at the epic's committed per-user scratch
      directory `.nexus/queue/epic-<n>/` when one exists — never at any path under `.nexus/tmp/` —
      so scratch keeps its existing lifecycle (deleted atomically with the page writes when the
      distillation-PR merges) instead of being stranded on the trunk with nothing to ever delete it.
      *(Amended at implementation per record #176: a literal skip, as this criterion originally read,
      would make that leak permanent by design.)*
- [ ] **Given** a tmp-resolved entry this run drained, **when** its distillation-PR has merged and
      `/nxs.distill` runs again, **then** the entry is **not** rediscovered — a tmp entry is consumed
      exactly once. Re-aiming the committed deletion at scratch must not mean skipping consumption:
      distill's `presence = unconsumed` rule has no committed deletion of the tmp entry to lean on
      here, and nothing in the tree cleans `.nexus/tmp` today, so this story states what marks a tmp
      entry consumed and when that mark is applied — never before the PR carrying its pages has
      merged (C12 still holds: an undrained entry is never auto-deleted).
- [ ] **Given** such a tmp-resolved entry in single-repo mode, **when** the Phase 0.4 merge
      precondition is evaluated, **then** it is the **two-test form** against the recorded `range:`
      head — the head being reachable from the trunk, **or** that head resolving to a merged pull
      request — and only when **both** fail does the existing not-merged gate fire, unchanged and
      never silently. It is never satisfied by `epic.md`'s presence at the trunk, which is
      meaningless for a file that never left `.nexus/tmp`. *(Amended at implementation per record
      #176: reachability alone, as this criterion originally read, is not sufficient — see the next
      criterion.)*
- [ ] **Given** a local close whose recorded `range:` head is the pre-merge feature-branch tip and
      whose work was **squash- or rebase-merged** (so that commit never becomes a trunk ancestor),
      **when** the Phase 0.4 merge precondition is evaluated, **then** it passes via the second test
      — resolving that head to its associated merged pull request — so the not-merged gate does not
      fire on the ordinary local path. Reachability alone would report every squash-merged local epic
      as not-merged, training the operator to waive the gate and destroying its meaning.
- [ ] **Given** a recorded `range:` head that cannot be resolved locally at all (the SHA is unknown
      to this repo and no PR resolves it), **when** the entry is evaluated, **then** it is the named
      per-entry hard error `range-unresolvable` — reported, with nothing drained for that entry —
      never a silent empty diff, never a partial one, and never an invented range.
- [ ] **Given** a mixed run (some entries committed, some in `.nexus/tmp`), **when** the Phase 6
      checkpoint digest is rendered, **then** it distinguishes which drained entries came from
      `.nexus/tmp` vs. the committed queue, so the reviewer isn't misled about what's being deleted
      from where.

## Notes

Part of epic #170. Depends on `STORY-170.02` writing tmp-resident close records to drain.

### Story #174: Distill falls back to GitHub when .nexus/tmp is gone

**As a** lead draining the queue on a different machine, or days after a close whose local tmp was
cleaned, **I want** `/nxs.distill` to recover the analyze verdict and the close record's rationale from
GitHub instead of failing outright, **so that** a wiped local tmp doesn't strand an otherwise-closed
epic.

## Acceptance Criteria

- [ ] **Given** a `--pr`-closed epic whose `.nexus/tmp` copy is gone and no committed `close-record.md`
      exists, **when** `/nxs.distill` resolves that entry's *why* source, **then** it falls back to
      the epic issue's close comment (posted by `/nxs.close` Phase 8.2, carrying Key Decisions +
      Deviation Rationale verbatim) with no loss of content versus draining it fresh off the worktree.
- [ ] **Given** the same missing-tmp condition for an epic with a linked PR, **when** `/nxs.distill`
      wants the analyze verdict for its own report, **then** it can recover it from the PR's published
      review (the existing `--pr` machine block) rather than treating conformance as unknown.
- [ ] **Given** a **local** (non-`--pr`) close whose `.nexus/tmp` copy is gone and no PR exists for the
      epic, **when** `/nxs.distill --recover <epic-issue>` looks for that entry's rationale, **then**
      it recovers it from the epic issue's close comment exactly as in `--pr` mode — that comment is
      the durable close record in every mode — rather than treating a local close as unrecoverable.
      *(Amended at implementation per record #176: this criterion's original premise — that a local
      close leaves no GitHub surface to recover from — is false.)*
- [ ] **Given** an epic issue carrying **no** trusted close comment (or none carrying the machine
      block), or a recovered `range:` head that cannot be resolved locally and that no PR resolves,
      **when** recovery runs, **then** each is a **named per-entry hard block**
      (`no-close-comment` / `range-unresolvable`) reported precisely — naming the entry and why it
      cannot be drained — never silently treated as "not yet closed", never drained with fabricated
      or empty rationale, and never a silent empty or partial diff.
- [ ] **Given** the two cases above, **when** the recovery behavior is implemented, **then** it traces
      to explicit invariants recorded by `/nxs.decision-record` for this epic (record #176,
      invariants 14 and 15) — this story does not itself mandate the resolution.

## Notes

Part of epic #170. Builds on `STORY-170.03`'s tmp-first discovery mechanism in `/nxs.distill`.

### Story #175: Member-mode close still lands its entry, durably, in the hub queue

**As an** engineer closing an epic in a member repo of a multi-repo workspace, **I want** the move to
ephemeral `.nexus/tmp/` artifacts to leave the hub migration intact, **so that** a member close still
ends with exactly one durable, drainable entry in the hub queue rather than a gitignored copy that
never migrates.

## Acceptance Criteria

- [ ] **Given** a member-mode close (always non-`--pr`; `/nxs.close` Phase 7.5) of an issue-sourced
      epic whose `close-record.md` and `analyze-receipt.md` were written under `.nexus/tmp/`, **when**
      the migration helper runs, **then** the entry still lands committed in the hub queue with those
      files byte-for-byte — being under a gitignored path must not make the migration copy nothing,
      skip the entry, or fail its verify step.
- [ ] **Given** that migration has succeeded, **when** close finishes, **then** the entry exists in
      exactly one place (the hub queue) — no tmp copy is left behind that a later `/nxs.distill` in
      the member checkout could discover as a second, separately drainable entry (STORY-170.03).
- [ ] **Given** the migrated entry, **when** `/nxs.distill` runs in the hub, **then** the drain-SLO
      report still attributes it to its originating repo from the first `range:` entry's `repo` in
      `close-record.md`, and the introducing-commit age still measures from the migration commit —
      unchanged from today.
- [ ] **Given** single-repo or hub mode, **when** a local close runs, **then** no migration happens
      and STORY-170.02's tmp-only behaviour applies unchanged — this story adds no committed artifact
      to those two modes.

## Notes

Part of epic #170. Closes the gap the epic's first draft asserted away ("close never runs `git commit`
itself in local mode") — member mode is non-`--pr` **and** commits, so "ephemeral" describes where a
member close *writes*, never where it *ends*.

## Assumptions

- `--pr` mode's existing artifact placement (PR review for analyze, committed-then-`git rm`'d
  `close-record.md` on the distill branch for close) is materially correct and stays as-is; this epic
  only adds tmp-first lookup and GitHub-fallback *discovery* on top of it for `/nxs.distill`, it does
  not change what `--pr` mode writes or where.
- "Same sitting" in local mode means the same machine, uncleared `.nexus/tmp`, no requirement that it
  be the same terminal session — `.nexus/tmp` persisting across a wrapper restart is treated as normal,
  not as the "different machine" recovery case.
- Old-contract entries (a committed `epic.md` predating #114) are out of scope for behavior change —
  every story above preserves their existing committed-artifact path unchanged.
- **Member mode keeps its durable end-state.** A member-repo close is always non-`--pr`, and its
  Phase 7.5 migration commits the entry into the hub queue. Moving the local artifacts under a
  gitignored path must not break that migration or leave a second, separately drainable tmp copy
  behind (Story 5). "Ephemeral" describes where a member close *writes*, never where it *ends*.

## Out of Scope

- Changing what `--pr` mode writes or where (Phase 0.5 / Phase 7.6 of `/nxs.close`, or the PR-review
  publish step of `/nxs.analyze`) — only local-mode placement and distill's discovery/fallback change.
- Any change to the decision-record's own storage or its hash-verification contract.
- Deciding, at the epic level, whether the unrecoverable-local-entry case (Story 4's last AC) is a hard
  block or a degraded drain — that judgment belongs to `/nxs.decision-record`.

## Open Questions

None.

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #171 | none |
| #172 | #171 |
| #173 | #172 |
| #174 | #173 |
| #175 | #172 |
