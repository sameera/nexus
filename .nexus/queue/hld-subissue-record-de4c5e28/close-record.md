---
title: "Close Record: The Decision Record Becomes an Approvable Sub-Issue"
epic: #139
feature: "Multi-Repo Workspaces"
date: 2026-07-26
analyze: ran 2026-07-26 @ 240c940fd3036a5cc755b5ee2c714dbe7e2221bb
range:
  - repo: github.com/sameera/nexus
    base: 2ee8213586b8db1f4ec62ab9b23caf952d34cef2
    head: 1e0c90b776f0bd12a70388cb4643cd2bd7831766
---

# Close Record: The Decision Record Becomes an Approvable Sub-Issue

> This epic predates the mechanism it built: its own decision record was written before records had
> a durable home, so it lived only in the gitignored scratch path and was never filed as a sub-issue
> or committed. The epic therefore closes with no `record` / `record_hash` stamp — the last epic
> that legitimately can. The deviation pass ran downgraded, against the epic's stated approach and
> acceptance criteria.

## Key Decisions

- **The record's durable home is the body of a sub-issue of the epic issue, and approval is the
  native act of closing that sub-issue.** One copy, born durable, addressable by the issue-reference
  provenance form the knowledge store already uses; the timeline supplies the approving account and
  time, so Nexus writes no approval field anywhere. A sub-issue closed as not-planned is *not* an
  approval — it blocks exactly as an open record does. Refuted alternative: keep authoring the
  record as a file and mirror it onto an issue — durable, but it re-creates the two-copy drift
  issue-sourced planning was built to remove and leaves "which copy is hashed" unanswerable.
- **The record body is pure human prose, and exactly one digest implementation exists
  (`@nexus/record-digest`, invoked via the `nxs-record-digest` skill).** Canonicalisation is stated,
  not incidental: line endings normalised, per-line trailing whitespace stripped, trailing blank
  lines stripped — and nothing else; full lowercase-hex SHA-256, never truncated, always computed
  over the body as fetched back from GitHub (so platform storage normalisation cannot make a
  fresh record stale). Refuted alternatives: per-stage shell one-liners (canonicalisation drifts at
  the first divergence and reports false staleness), and a broader rule collapsing internal blank
  lines / applying Unicode normalisation (forgives editor churn but also hides genuine edits).
- **Classification is record-positive, through the one shared publishing resolver.** The record
  sub-issue is identified by the configured record label or issue type; everything else stays a
  story, which is what keeps a hand-filed epic working and the no-record case byte-identical.
  Refuted alternative: a title-prefix or body-marker heuristic — zero config, but it would disagree
  with what the filing side actually applied the moment a repository switches classification mode.
- **The `needs-design` label is the declarative gate, applied at filing for an M-or-larger
  complexity rollup and revocable by the design stage's no-design-needed outcome.** Downstream
  stages answer "should this epic have a record?" from the issue graph alone — no remembered state —
  which is what makes hand-filed epics work for free. Refuted alternative: derive the need from the
  epic's machine metadata block — absent on hand-filed epics and not editable in the GitHub UI.
- **A closed record's body is frozen; revision is reopen → dated comment → body update → re-close,
  and the revision comment embeds the superseded body verbatim plus its hash.** The freeze is what
  makes the hash mean anything; the body is embedded (not described) because GitHub's edit history
  is not reliably retrievable by tooling. Refuted alternatives: an append-only history inside the
  body (the current body must be exactly the approved record for the hash to be meaningful), and a
  fresh record sub-issue per revision (breaks the stable issue reference already stamped on
  receipts and close records).
- **Record staleness and code staleness are two independent axes, each named separately and each
  taking the same explicit waiver; the drain alone has no waiver.** Conformance blocks on an
  unapproved record and emits nothing (a missing receipt keeps its single meaning); close
  hard-blocks on any open sub-issue regardless of kind; the drain hard-errors on a hash mismatch
  because it writes permanently into the knowledge store — the remedy is upstream. Refuted
  alternative: give the drain the same waiver close has, for symmetry — it puts the softest control
  on the most durable write.
- **In-flight decision — design-stage Phases 4/4.5 are filing steps, never entry points** (from PR
  #148 review, blocking item 1). The `--revise` token and the existing-record re-run select *which
  filing path* Phase 4 takes; the record body always comes from the analysis phases 1–3, and the
  filing step stops rather than file a stale scratch body. Skipping the whole of Phase 0.2 on
  `--revise` was additionally found to skip repo-argument resolution, so the split is: run 0.2's
  resolution, skip only its gate.
- **In-flight decision — the `github:` config block reads through one key map
  (`_GITHUB_KEY_TO_NORMALIZED`), and the four new record/design-gate keys resolve through
  `resolve_setting` with hub fall-through** (from review items 4+5, one defect: keys readable but
  never populated, and a raw merge that let an empty repo-level key mask a hub value). The map is
  now the single schema for the block, so read-but-unpopulated cannot recur for the next key.
  Refuted alternative: drop the dead reads and document built-ins-only — fixes the silent ignore
  but leaves a declared key doing nothing.
- **In-flight decision — the `in-progress` label asserts the record's existence, not its approval**
  (from review item 6). Reworded rather than moved: leaving the epic on `needs-design` while a
  record awaits review would conflate "no design yet" with "design awaiting approval" — the
  distinction this epic exists to create. Approval lives in exactly one place: the record
  sub-issue's closed state.
- **In-flight decision — the drain's no-waiver hard-error gets a named upstream recovery: the
  re-stamp procedure in `/nxs.close`** (from review item 7). A record revised after close is
  recovered by re-approving the record, judging blast radius (wording-only vs. the design moved —
  the latter re-runs the decision-mining and deviation passes over the affected sections), and
  re-stamping `record_hash`; it is a re-stamp, not a re-close, and it never reopens the epic issue.
- **Coexistence is per-entry baseline precedence, no migration:** record sub-issue, else a committed
  `decision-record.md`, else the close record alone. In-flight old-contract entries clear on their
  own. Refuted alternative: migrate committed records onto sub-issues in one pass — a single code
  path afterwards, but it rewrites closed history against a small affected population.

## Deviation Rationale

Downgraded pass — no decision record existed for this epic (see the note above), so deviations are
recorded against the epic's stated approach and acceptance criteria.

- **XS complexity exempted from `needs-design` alongside S** (AC 3.2 names only S): the epic's
  stated threshold is "M or larger warrants a record"; XS sits below S, so exempting it implements
  the threshold rather than relaxing the criterion.
- **`read_delivery_config` refactored from an enumerated key list to the `_GITHUB_KEY_TO_NORMALIZED`
  map** (no story asked for it): the four new record/design-gate keys were readable but never
  populated — a declared value silently ignored (PR #148 review items 4+5). Making the map the
  single schema for the `github:` block fixes the defect and prevents the class recurring.
- **Record-label classification case-folds both sides** (beyond the AC's "configured record label"
  text): GitHub label names are case-insensitively unique, and `gh label create --force` updates an
  existing `Decision-Record` label without renaming it — an exact match would silently classify the
  record as a story, the precise corruption STORY-139.01 exists to prevent (review item 3).
- **`multiple-record-subissues` fail-closed abort in the resolver** (no AC called for it): "at most
  one record per epic" is an identity every downstream stage depends on; a silent choice between
  two candidate records would corrupt the baseline for conformance, close, and the drain.
- **`/nxs.close` gained a named recovery section — re-stamp a closed entry whose record was revised
  after close** (no story AC): the drain's deliberate no-waiver posture otherwise leaves a
  revise-after-close entry permanently blocked with no documented remedy (review item 7). The
  recovery is a re-stamp reachable from where the wall is hit, not a second close mechanism.

## Deferred Scope

None new. Every out-of-scope item already carries a stub in
`docs/features/multi-repo-workspaces/backlog.md` (`pipeline-gh-cli`, `github-publishing-config`,
`hub-close-multi-pr`, `story-analyze-hub`); nothing was appended by this close.

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-07-26-hld-subissue-record.md`
