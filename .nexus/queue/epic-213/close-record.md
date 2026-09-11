---
title: "Close Record: Close an Epic Over Several Merged Pull Requests"
epic: "#213"
feature: "Multi-Repo Workspaces"
date: 2026-09-10
nexus_version: 0.30.0
analyze: "stale — ran 2026-09-08 @ d24edb7, 6 commit(s) unanalyzed; waived 2026-09-10"
record: "#509"
record_hash: 6055d87efa32a969bad5816b327af29a6f1ab91a70aff21273a69d4299ea3205
range:
  - repo: github.com/sameera/nexus
    base: 24149aa6fcb1600e3992dd8aeb7b893b8e8a4286
    head: 7d289348f146211fa1103d88ff64646e6aa66c92
---

# Close Record: Close an Epic Over Several Merged Pull Requests

## Key Decisions

- **Merge state is its own check, not a field on currency.** A new `checkEpicMergeGate`
  (`libs/epic-verdicts/src/merge-gate.ts`) reads each story pull request's merge state on its own and
  runs before `checkEpicCurrency`. Merge state is a hard block with no waiver; currency is a reported
  staleness the lead may waive. Folding them together would have forced a waiver path onto an unmerged
  pull request, which story #500's acceptance criteria forbid, or stripped currency of a waiver it is
  documented as offering. *Refuted alternative:* extend `StoryCurrency` with a `merged` field and report
  both through one call.

- **The multi-pull-request set is passed as a comma-separated `--pr` list, not repeated flags.** Both
  `nexus pr-worktree range` and `open --mode close` accept `--pr <N1,N2,...>`; a bare number keeps the
  existing singular JSON shape byte-identical for every caller that already exists. The one caller that
  needs the plural form always holds the whole list at once, so argv-order parsing buys nothing.
  *Refuted alternatives:* a repeatable `--pr` flag; a separate `range-list` subcommand splitting one
  read-only derivation across two entry points.

- **The storyless-story marker write is its own `waive-story` subcommand.** Every other `epic-verdicts`
  subcommand is read-only — collection, trust, currency, merge state. This is the single place in the
  helper that writes to GitHub, and it is gated on the lead's consent at the close checkpoint. A
  `--waive` flag on `derive` would make an otherwise-inspectable read command mutate GitHub depending
  on an argument, forcing every caller to reason about accidental writes. Keeping the boundary at the
  process level makes it checkable rather than merely stated. *Refuted alternative:* a `--waive <story>`
  flag on `derive` that writes the label and then re-derives.

- **The trunk resolution for the multi-pull-request open path is duplicated, not exported.** The CLI
  handler resolves the trunk itself (`git fetch origin main`, then `rev-parse --verify origin/main`
  falling back to `main`) before calling `verifyTrunkContainsHeads`, and `openCloseWorktree` then
  resolves the same trunk again internally. Record #509's order-inversion requirement is that every
  stamped head is verified *before* any worktree exists, and `openCloseWorktree` has no point in its
  contract where the trunk is resolved and handed back without also cutting something. Exporting a
  shared resolver would have meant changing that function's signature — churn on the single-pull-request
  call site, explicitly out of scope — or adding an export with exactly one caller. *Refuted alternative:*
  export `resolveTrunk(run, repoRoot, trunkRef)` from `worktree.ts` and call it from both sites.

- **The drain-side refusal ships in this epic rather than waiting for #214.** `nxs.distill.md` gained a
  named `range-list-unsupported` block that names the entry, marks it blocked and continues with the rest
  of the queue. Shipping a writer whose reader mis-reads its output, on the expectation that the next epic
  lands soon, is the failure record #495 already declined once. A blocked drain is recoverable; a plausible
  wrong distillation is not.

## Deviation Rationale

- **The `--pr` argument stayed mandatory; neither the epic-addressed close nor the typed-list override
  shipped (deviates from #509, key decisions 1 and 3).** #509 decided the flag's argument "becomes
  optional and plural", with an epic-addressed invocation taking the set from the epic receipt, and an
  explicitly typed pull-request list as the recorded override for when no receipt exists — the close
  record and durable comment saying the set was lead-supplied. Only the plural half shipped. The Usage
  block is unchanged and no lead-supplied-set language exists anywhere in the build. **Why:** none of the
  four stories' acceptance criteria required it. Those were record-level decisions with no story behind
  them, and implementation followed the acceptance criteria. **Consequence, observed during this close:**
  `nexus epic-verdicts merge-gate --epic 213` exits 1 with `receipt-missing` when no aggregate receipt is
  present, and with the typed-list override unbuilt there is no remaining route to a multi-pull-request
  close in that state.

- **Phase 3's deviation pass still reads one range while Phase 4 stamps a list (deviates from #509,
  invariants 9 and 17).** #509 fixed that the pass reads "the union of exactly the stamped entries" and
  that "the range stamped is by construction the range that was read". The shipped Phase 3 still takes
  `$BASE`/`$HEAD_SHA` from a singular `range.base`/`range.head` and directs the reader to use "this one
  diff" for both detection and the stamp, while Phase 4 now writes one entry per pull request. On a
  genuine multi-pull-request close the pass would read one pull request's range and stamp several.
  **Why:** deferred knowingly. No multi-pull-request close can complete end to end until #214 teaches the
  drain to read a multi-entry range, so the gap could not be exercised. It is latent, not active.

- **Phase 4 re-derives ranges Phase 0.5 already returned (deviates from #509's chosen approach).** Phase
  0.5's multi-pull-request `open` prints `ranges` and instructs the reader to keep those SHAs "for Phase 3
  and the Phase 4 stamp"; Phase 4 then directs a second `nexus pr-worktree range --pr <list>` call for the
  same facts. Two instructions that disagree, and a network round-trip for values already in hand. This is
  a redundancy rather than a second derivation — the same merge-anchored program is called twice, so
  invariant 6 holds. **Why:** #501 (the stamp) and #503 (the branch) were specified and implemented as
  independent slices, each naming its own way of obtaining the ranges, and the overlap between them was
  never reconciled.

## Waived Stories

none

## Deferred Scope

none — the epic's three out-of-scope items were already filed as #212, #214 and #215 at planning, and all
three have since shipped.

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-09-10-record-decisions-without-stories.md`
