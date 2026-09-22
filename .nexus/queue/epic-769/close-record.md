---
title: "Close Record: The Epic Issue Carries the Ledger of What Shipped"
epic: "#769"
feature: "Multi-Repo Workspaces"
date: 2026-09-22
nexus_version: 0.73.0
analyze: ran 2026-09-22 @ 8587f77fd250071d50c6811f9ec7450e2f8e8ee7
record: "#777"
record_hash: 295dfe6ef5b9d7d9931c10287e93302b5661a5a8b9842e2c05ead038e116a4cb
range:
  - repo: sameera/nexus
    pr: 778
    base: 67f72c23a5236309a890b7968fdd51a9a7ed6dd9
    head: 6c8f4e0d1347c4d1fda18d7e8b9f487587b4c361
---

# Close Record: The Epic Issue Carries the Ledger of What Shipped

## Key Decisions

- **A record's ordering key comes from the fetch the path had already made.** `mergedAt` is exposed
  on the pull-request info the repository-qualified read already returns, and the separate
  merged-at helper is deleted. That one query already asks for the timestamp and already names the
  repository, so the ordering key costs nothing and can never be empty on a merged pull request.
  *Refuted alternative:* keep the separate helper and give it a repository argument. It matches its
  siblings and satisfies the repository-identity invariant, but it leaves a second round trip and an
  empty-on-failure fallback that silently drops a record to the repository-and-number tiebreak the
  ledger states is not the order.

- **A close worktree opens with no pull requests at all.** `nexus pr-worktree open --mode close`
  accepts an absent `--pr`: it cuts the distillation branch, derives no range, verifies no head and
  prints an empty range list. Record #777 narrows trunk verification to the repository the branch is
  cut in, and the epic's headline shape is an epic issue in one repository while every story merged
  in another, so the no-pull-request case is the case the epic exists for. *Refuted alternative:*
  reword the close contract to always pass at least one pull request. It loses because in that shape
  there is no pull request to pass, so the close could never write its record at all.

- **The close contract stamps the ledger's range rather than re-deriving it.** Phase 4 of the close
  stage had kept an instruction to resolve every range entry through the range helper. That helper
  attributes every entry to the repository the close was started from and reads each pull request
  against that same local copy, which is exactly what story #773's second criterion forbids. The
  contract now stamps the list the close gate printed, verbatim, and names the helper as the thing
  not to use there.

- **The record subverb has no way to be handed a range.** The `--range-base` and `--range-head`
  overrides are removed rather than documented and tested. Invariant 4 says the range comes from the
  one merge-anchored derivation, and a caller-supplied range would disagree with the diff the
  distiller recomputes from it, one stage after the branch was cut. No contract passed them and no
  test covered them. *Refuted alternative:* keep them for a caller that already derived the range in
  the same run. No such caller exists, and the pair was an untested way to violate the invariant.

- **A retired check refuses on the command that names it.** The refusal for the retired merge-state
  and currency checks was first wired into the epic resolver rather than the dispatcher that owns
  those subverbs, so invoking one by name gave a usage error that reads as a typo. It now refuses
  from the command a lead actually types, naming what replaced it.

## Deviation Rationale

- **The story-to-pull-request resolver reads the platform's closing link, which story #775's first
  acceptance criterion reads as forbidden (deviates from #775 AC1 as worded; conforms to record
  #777).** That criterion says no same-repository link is consulted. The closing link is one, but
  record #777's decision on issue-graph resolution designs it in explicitly, and story #770's first
  criterion needs it: a story "closed by" a pull request is exactly what that edge expresses. The
  resolver reads the closing link and the cross-reference edge together, and every candidate still
  has to claim the story under the existing claim rule, so a wrong number can only be rejected. The
  record governs; the acceptance criterion's wording is what is imprecise. What #775 actually
  removed — the head-branch search and the per-repository enumeration behind it — is gone.

- **`nexus pr-worktree open --mode close` gained a no-pull-request path that no story asked for
  (extends record #777's decision on narrowed trunk verification).** No acceptance criterion named
  this call. It is required by story #773's headline shape, because the close cannot open its
  distillation worktree when no recorded pull request merged in the repository the branch is cut in.
  It implements the record's narrowing rather than contradicting it, and it is covered by three
  tests: the new path, and the two refusals it must keep.

## Deferred Scope

Deferred items filed as epic stub issues:

- #779 — a platform read that fails is told apart from a merge commit that moved
- #780 — the release acceptance harness stops enforcing the retired code-staleness axis

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-09-22-conformance-gate-mode-disagreement.md`
