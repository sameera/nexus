---
feature: "Queue Scratch Capture"
feature_path: docs/features/queue-scratch-capture
epic: "Committed Queue Scratch Capture"
slug: queue-scratch-capture
created: 2026-07-17
type: enhancement
complexity: M
complexity_drivers: [cross-command contract consistency, trust-boundary semantics, retired hook + migration]
concepts: [scratch-capture]
link: "#67"
---

# Epic: Committed Queue Scratch Capture

## Description

Decision scratch — the in-flight stubs and working notes an engineer's agent produces while
implementing a story — used to live in a gitignored, per-branch directory (`.nexus/plans/<branch>/`).
That location made the rationale machine-local and physically invisible to the lead: it never
reached the PR head, so `/nxs.analyze` at review time could not see it, and `/nxs.close` had to
delete it after mining. It also depended on a per-engineer opt-in hook that could not resolve which
epic a decision belonged to.

This epic moves scratch into committed per-user subdirectories inside the epic's queue entry:
`.nexus/queue/<epic>/<username>/{decisions,notes}-<branch>.md`. Because it is committed, the
rationale rides ordinary commits onto the PR head — visible to the lead at analyze and close time —
and is drained by the distiller together with the queue entry when the distillation-PR merges. No
separate cleanup, no branch→epic mapping at close. Branch-keyed filenames make concurrent writes
conflict-free by construction. The trust boundary is unchanged: scratch stays a pre-checkpoint hint,
verified against the diff, never load-bearing, and never read by the distiller.

The value is fidelity without new risk: the highest-quality "why" (captured at the moment of
choosing) becomes reviewable where decisions are actually reviewed, while the gates stay diff-anchored
and the concept store stays free of raw scratch.

> **Note (retroactive capture):** this epic documents a change that is already largely implemented
> (`CLAUDE.md` and several `.claude/commands/*.md` files already carry the new contract). It exists so
> the shipped change has a planning record the pipeline can close and distill.

## Success Metrics

- A non-obvious implementation decision made during a story is retrievable from the committed queue
  entry at both analyze and close time — it appears on the PR head, not only on the author's machine.
- Zero engineer-scratch content reaches the concept store after a distillation run (scratch is never
  mapped to a concept delta).
- Close deletes no scratch: after a close completes, the per-user scratch still exists in the
  committed queue entry and is removed only when the distillation-PR merges.
- No repo-wide opt-in is required to capture a decision stub — the standing agent rule is the sole
  mechanism; the plan-capture hook is gone.

## Personas

Per `docs/product/context.md`. This epic's actors are the **implementing engineer's agent** (writes
scratch) and the **lead** running the lead-side stages (analyze, close, distill) — both already
canonical pipeline roles.

## User Stories

### Story 1: Committed per-user scratch layout and authoring rule

- **story_type:** user
- **size:** M

**As an** implementing engineer's agent, **I want** to append decision stubs and working notes to a
committed per-user subdirectory inside the epic's queue entry, **so that** the rationale I capture at
the moment of choosing survives onto the PR head instead of a gitignored local directory.

#### Acceptance Criteria

- [ ] **Given** a non-obvious implementation choice on a story branch, **when** the agent records a
  decision stub, **then** it is appended to `.nexus/queue/<epic>/<username>/decisions-<branch>.md`
  (username = `gh api user --jq .login`, falling back to a slug of `git config user.name`; `<branch>`
  with `/`→`-`), and working notes go to `notes-<branch>.md` in the same directory.
- [ ] **Given** the branch name or the open PR's closed issue, **when** the agent resolves `<epic>`,
  **then** it maps the story's parent epic issue to the queue entry whose `epic.md` `link` equals it,
  falling back to matching the branch slug against entry directory names.
- [ ] **Given** the epic cannot be resolved, **when** the agent would write a stub, **then** it writes
  nothing (a wrong-folder stub is worse than none).
- [ ] **Given** the retired `.nexus/plans/` convention, **when** `.gitignore` is inspected, **then**
  the `.nexus/plans/` line is retained (marked retired) and no ignore is added for `.nexus/queue/**`.
- [ ] **Given** the `CLAUDE.md` "In-Flight Decision Stubs" section, **when** read, **then** it
  documents the committed path, the silent epic-resolution steps, and the branch-keyed append-only
  filenames — with no reference to the old gitignored path or to close deleting the scratch.

#### Notes

Branch-keyed filenames make writes conflict-free regardless of how many engineers or branches touch
the epic. No developer HLD is placed here or anywhere in the repo tree (that is a separate work item,
`/nxs.hld --from`, out of scope).

### Story 2: Close mines committed scratch and stops deleting

- **story_type:** user
- **size:** M

**As a** lead running `/nxs.close`, **I want** the close stage to read the committed per-user scratch
as hints and to leave it in place, **so that** the highest-fidelity "why" informs the close record
without the close having to own any cleanup.

#### Acceptance Criteria

- [ ] **Given** a queue entry with per-user subdirs, **when** close gathers rationale, **then** it
  globs `${QDIR}/*/decisions-*.md` (no branch→epic mapping) and treats each stub as a hint verified
  against the shipped diff — a stub the code contradicts is dropped or recorded as a deviation.
- [ ] **Given** committed engineer notes, **when** close runs its close-from-diff pass, **then** it
  consults `${QDIR}/*/notes-*.md` only as weak hints to notice divergence, never as a source of record.
- [ ] **Given** a completed close, **when** the working tree is inspected, **then** no scratch has been
  deleted — the old `.nexus/plans/<branch>/` deletion block and its follow-on paragraphs are gone from
  `nxs.close.md`, and the scratch remains inside the committed entry.
- [ ] **Given** the close report and constraints, **when** read, **then** they describe the scratch as
  mined-and-retained (drained later by the distiller with the entry), with the distiller documented as
  ignoring the per-user dirs.

### Story 3: Analyze reads PR-head scratch as soft context

- **story_type:** user
- **size:** S

**As a** lead running `/nxs.analyze`, **I want** to optionally read the committed engineer scratch now
visible on the PR head, **so that** I can explain a divergence at review time without letting it change
a conformance verdict.

#### Acceptance Criteria

- [ ] **Given** a PR head whose queue entry carries `${QDIR}/*/decisions-*.md` or `notes-*.md`, **when**
  analyze runs, **then** it reads them as context only — to explain scope drift and, in downgraded mode,
  to reconstruct likely invariants a missing decision record would have carried.
- [ ] **Given** any engineer scratch, **when** analyze reaches a verdict, **then** the scratch never
  changes a met/partial/unmet/contradicted verdict (the diff and ACs decide) and a missing scratch dir
  changes nothing; the analyze-receipt schema is unchanged.

### Story 4: Distiller explicitly ignores per-user scratch

- **story_type:** system
- **size:** S

**As a** lead running `/nxs.distill`, **I want** the distiller to never read the per-user scratch that
now lives inside committed queue entries, **so that** raw scratch cannot leak into the concept store.

#### Acceptance Criteria

- [ ] **Given** a queue entry containing `<entry>/<username>/**` scratch, **when** distill computes the
  entry diff, **then** the `.nexus/queue/**` exclusion keeps that scratch out of the *what* (no change
  needed to the diff step).
- [ ] **Given** the synthesize step, **when** distill derives per-concept deltas, **then** no
  `ConceptDelta` is produced from any `<entry>/<username>/**` path — the *why* comes only from
  `decision-record.md` and `close-record.md`, and `nxs.distill.md` states this explicitly in Phase 3
  and its constraints.
- [ ] **Given** a merged distillation-PR, **when** the entry is removed, **then** the existing
  `git rm -r <entry-dir>` deletes the per-user scratch atomically with the entry (no new cleanup step).

### Story 5: Setup retires the plan-capture hook and retargets its seeds

- **story_type:** user
- **size:** S

**As a** user running `/nxs.setup`, **I want** bootstrap to stop seeding the plan-capture hook and to
seed the committed-scratch convention instead, **so that** a freshly set-up repo starts on the new
model with no dead hook.

#### Acceptance Criteria

- [ ] **Given** `/nxs.setup`, **when** it runs, **then** it no longer seeds `capture-plan.sh` nor
  registers the `settings.local.json` plan-capture opt-in, and neither appears in its completion
  summary's Created list.
- [ ] **Given** setup's gitignore step, **when** it runs, **then** it does not add a committed-path
  ignore for `.nexus/queue/**` and keeps any pre-existing `.nexus/plans/` line as retired.
- [ ] **Given** setup's `CLAUDE.md` decision-stub seed, **when** written, **then** it matches the
  committed-path + epic-resolution + silent-skip rule (no "gitignored scratch / close deletes it" text).

## Assumptions

- In-flight epics at cutover: an engineer who wrote to the old `.nexus/plans/<branch>/` before cutover
  loses that scratch to the new close (which globs `${QDIR}/*/`). Accepted as a minor, soft loss — the
  close-from-diff and PR-thread floor holds; no dual-read transitional path is built.
- Username source is the GitHub login primary, `git config user.name` slug fallback.
- `/nxs.hld` needs no body change: hld normally runs before implementation, so no engineer scratch
  exists yet. It is documented only as a *permitted* consumer for a future mid-flight re-run.

## Out of Scope

- `/nxs.hld --from <url|path>` team-HLD ingest — a separate work item. This epic fixes only the
  placement rule for a developer HLD (it lives in the team's doc space, never in the committed tree or
  queue scratch).
- Rewriting `.nexus/concepts/scratch-capture.md` — that page is distill-owned and is corrected by the
  distillation of *this* epic when it drains, not hand-edited here.
- Wiring `/nxs.hld` to actually read scratch on a mid-flight amendment — flagged, deferred until a
  mid-flight-amendment flow is built.

## Open Questions


## Implementation Sequence

| STORY | Issue | blocked_by |
|---|---|---|
| STORY-67.01 | #68 | none |
| STORY-67.02 | #69 | STORY-67.01 |
| STORY-67.03 | #70 | STORY-67.01 |
| STORY-67.04 | #71 | STORY-67.01 |
| STORY-67.05 | #72 | STORY-67.01 |
