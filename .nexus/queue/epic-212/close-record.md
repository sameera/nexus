---
title: "Close Record: One Epic Receipt, Aggregated From the Story Verdicts"
epic: "#212"
feature: "Multi-Repo Workspaces"
date: 2026-09-10
nexus_version: 0.30.0
analyze: stale — ran 2026-09-08 @ 36679d7 (local receipt; PR #521 carries no machine block), 3 commit(s) unanalyzed; record axis current; waived 2026-09-10
record: "#505"
record_hash: d7b673f5e2d3add2d2d692efab5fc3eb8b743acd4c7f1166f56620031f8bc478
range:
  - repo: github.com/sameera/nexus
    base: 2da35932df3ffd38a3ab71f7c81fe1f75e139b15
    head: 24149aa6fcb1600e3992dd8aeb7b893b8e8a4286
---

# Close Record: One Epic Receipt, Aggregated From the Story Verdicts

## Key Decisions

- **The branch forked from epic #211's unmerged branch, not from main.** Record #505 assumes #211's
  per-story `--pr` analyze machinery already exists, and #212's own Out of Scope names #211 as the
  thing that produces the per-story verdicts this epic aggregates. Building against main would have
  meant re-deriving that machinery a second time, which record #505 explicitly warns against.
  Refuted alternative: reimplement a local copy of the per-pull-request verdict and trust
  primitives inside this epic's own library. That copy is the failure the digest helper and the
  range helper were both created to avoid.

- **`resolveStoryVerdict` returns every surviving candidate, not only the newest one.** Invariant 3
  of record #505 requires the combined change set to be the union of every open-or-merged trusted
  verdict, including one superseded by a later verdict for the same story after its code already
  shipped. The one-verdict-per-story set the receipt uses is the wrong input for that union, because
  it discards a merged pull request's diff the moment a newer verdict supersedes it. The
  implementation therefore returns `survivors` alongside the chosen `verdict`, and
  `resolveEpicVerdicts` keeps `changeSetVerdicts` separate from `verdicts`. Story #496's own third
  acceptance criterion is about the receipt, not the combined set, so `verdicts` keeps that
  behaviour unchanged. Refuted alternative: have `combinedChangeSet` re-derive the survivors itself
  by re-querying GitHub. That second query path would duplicate the trust and recency rules records
  #495 and #505 centralized in one place.

- **The close gate's aggregate reader shipped inside this epic rather than in #213.** Record #505's
  chosen approach places the reader in the close gate, and release 0.18.0 landed it here. The epic's
  own risk section had assumed the receipt would land with no reader until #213.

## Deviation Rationale

- **The epic receipt omits the record reference, the record digest and the writer stamp (deviates
  from record #505).** Record #505's key decision on the receipt shape says the receipt keeps the
  record reference, the full digest and the writer stamp. The shipped `writeEpicReceipt` renders
  `epic`, `date`, `mode`, `findings`, `stories`, `prs` and `excluded`, and the command line never
  passes `nexusVersion`. The record reference and the digest were dropped deliberately. The same
  record decided that record currency is judged per story, comparing each verdict's stamped digest
  to the record's current digest, so a receipt-level record field would be a second and redundant
  source for a fact the currency check already reads from the verdicts. The writer stamp was missed
  rather than dropped, and it is filed as deferred scope.

- **The combined change set reads every pull request from one checkout (deviates from record
  #505, invariant 9).** Invariant 9 requires every git operation to run against the checkout of the
  repository the pull request lives in, and requires pull-request heads to be fetched into that
  repository's own object store. `combinedChangeSet` takes a single `cwd` and uses it for
  `fetchPrHead` and for `git diff` on every verdict. `StoryPrCandidate` carries a per-candidate
  `cwd`, but `StoryVerdict` drops it, and the command line passes the invoking root for all of them.
  This relaxation is latent. No workspace epic ships story by story yet, so the single-checkout path
  is correct for every case that exists today. The multi-repository wiring is filed as deferred
  scope.

- **The lead-supplied explicit candidate list is unreachable from the command line (deviates from
  record #505).** The ladder decision names three rungs and calls the lead-supplied list the remedy
  for the discovery risk it flags. `discoverCandidatePrs` accepts an `explicit` argument, but
  `epic-verdicts` parses only `--epic`, `--root` and `--record`, so the third rung can never be
  exercised. Both automatic rungs resolved every story in practice, so the manual remedy was left
  unwired until a real discovery miss justifies the flag. The flag is filed as deferred scope.

- **Neither mitigation the two ADDRESS risks named was carried out (deviates from record #505).**
  The discovery risk's mitigation is to state the issue-numbered branch-name requirement for member
  repositories in the same release. No document in the landed range states it, and the branch rung
  exists only as code. That requirement is still owed and is filed as deferred scope. The
  no-reader-on-landing risk's mitigation is a changelog note telling an adopter that a receipt
  nothing reads is not a broken feature. Release 0.18.0 shipped the close gate's aggregate reader
  inside this same epic, so the receipt does have a reader and the note would have been false.

## Waived Stories

none

## Deferred Scope

Deferred items filed as epic stub issues:

- #529 — Aggregate the epic receipt across a multi-repo workspace
- #530 — Stamp the writer version on the aggregated epic receipt

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-09-10-aggregate-before-consumer.md`
