---
title: "Close Record: A lightweight lane for small fixes to reach the concept store"
epic: "#263"
feature: "Lightweight Fix Lane"
date: 2026-09-05
nexus_version: 0.3.0
analyze: "waived — ran 2026-09-05 @ ffe0ed09cfc98d4c12397a7744794463005f18e0 (local receipt, current on both axes: head equals the PR head, record_hash equals #271's current digest); no analyze machine block was published on PR #440, so the --pr source was missing; the single high finding was the then-open story issues, satisfied by the merge; waived 2026-09-05"
record: "#271"
record_hash: fa4edf73571596ef6ca352e34b8e8e1c4204b54328bbc6b22ccd363ddccbc7cb
range:
  - repo: github.com/sameera/nexus
    base: 1df8eac4f7a198df81976d361e166c025154098d
    head: 7d54f4e86ebfe53daa9b98e99c3fe47b12b2ef03
---

# Close Record: A lightweight lane for small fixes to reach the concept store

## Key Decisions

- **The range read runs in the checkout, not a throwaway worktree.** `readRange` resolves the role,
  looks the pull request up, fetches `pull/<N>/head` into the shared object store, and runs the
  existing `deriveRange` with the checkout itself as the derivation directory. The derivation reads
  only the object store, so a checkout and a worktree are interchangeable for it, and the lane has
  no use for a working tree it would immediately discard. *Refuted alternative:* create a throwaway
  worktree so the close path's directory shape is reused verbatim — rejected because building and
  tearing down a checkout for one JSON object is precisely the cost this read exists to remove.

- **The range read got its own module rather than living in the CLI dispatcher.**
  `libs/pr-worktree/src/range-read.ts` holds `readRange` and the extracted `fetchPrHead`; both the
  new `range` subcommand and the existing `open --mode close` path call into it. The dispatcher is
  not reachable from a spec with an injected runner, so logic left there could not be tested against
  real git topologies. *Refuted alternative:* inline the three calls in `runPrWorktree` — rejected
  because the squash-versus-rebase file-set criterion would then have no test exercising it through
  the new entry point.

- **The razor's status map is built from the index and the working tree together.** `gitStatusMap`
  merges untracked paths (as added), the base-versus-working-tree diff, and the base-versus-index
  diff, with the index winning. A page the drain wrote but has not staged is invisible to `git diff`
  entirely, and a rename is only ever reported as a rename once both of its halves are staged;
  either gap alone would let a forbidden status pass as unchanged. *Refuted alternative:* read only
  the staged diff, since the drain stages before validating — rejected because the mode is then a
  silent no-op for anyone running it by hand against an unstaged tree.

- **The `/nxs.fix` command body is held to its stated rules by a body-reading spec.**
  `fix-lane.spec.ts` reads the authored command body and asserts the refusals, the helper
  invocations and the entry shape it states. The lane's mechanism *is* a command definition, so the
  body is the artifact under test; without this the stories' acceptance criteria had no failing test
  to write first. *Refuted alternative:* extract the resolution rules into TypeScript so they could
  be unit-tested directly — rejected because the epic's assumptions fix the only new code at the
  validator mode and the helper subcommand, and a third implementation would be a second place for
  the lane's rules to live.

- **The fix entry was folded into the existing drain phases rather than given a parallel path.**
  Each phase of `/nxs.distill` gained a fix-entry clause in place, keyed on `entry_kind:`, instead
  of a separate fix-entry walk-through. Record #271 ratifies reusing the epic lane's file names
  precisely so discovery changes one line and every downstream phase stays single-path; a parallel
  narrative would let the two descriptions drift even while the code did not. *Refuted alternative:*
  a dedicated "Draining a fix entry" section collecting every difference in one place — rejected
  because a reader following the ordinary phases would then miss the constraint applying to the
  phase they are actually in.

- **Invariant 13's mode probe reads the toolkit's declared help surface.** Before draining a fix
  entry the drain greps `nexus --help` for `--append-only-log`, and a miss refuses the entry naming
  an outdated install as the cause. Record #271 deliberately left invariant 13 silent on how the
  mode is established; the help text is the toolkit's own declaration of its surface, so the check
  reads the same source the flag was added to and needs no new capability. *Refuted alternative:*
  compare `nexus version` against the release that introduced the mode — rejected because it
  hard-codes a version constant that a maintainer running from a checkout has no meaningful value
  for.

## Deviation Rationale

- **`fetchPrHead` was extracted from the close path and that path rewired to call it** (deviates
  from #271's "expose the existing derivation through a new read-only read", and from story #264's
  acceptance criterion that existing subcommands are unchanged): the CLI dispatcher is not reachable
  from a spec with an injected runner, so the fetch left inline there could not be tested against
  real git topologies, and the two copies of the best-effort fetch would have had to stay in step by
  hand. The call sequence through `open --mode close` is identical before and after, so the
  subcommand's behavior is unchanged; what moved is where the code lives. #271's decision that "no
  second range derivation is written" is satisfied more strictly by the extraction than by
  duplication.

- **`gitStatusMap` reads untracked paths and the working-tree diff as well as the index diff, rather
  than the staged diff alone** (deviates from story #265's literal wording; #271's invariant 9 names
  no diff source): a page the drain has written but not staged is invisible to `git diff`, and a
  rename is only reported as a rename once both halves are staged. Reading the staged diff alone
  would make the razor a silent no-op against an unstaged tree — the one failure mode a total check
  must not have. The broader read is what makes invariant 9 hold when the mode is run by hand.

## Deferred Scope

none.

The epic's Out of Scope list is deliberate non-goals with stated reasons, not unplanned work: member
repositories drain their fix entries from the hub by design, the lane commits nothing so it needs no
`--pr` flow, `/nxs.distill` already batches, and the lane starts empty by choice. The strike-through
loosening of the razor is deferred by #271 on principle — loosening a razor before there is evidence
it binds too tightly is how razors die — and stays available if that evidence arrives; pre-filing it
would pre-commit the decision the record declined to make. The one item of real pending work,
correcting the `--require-epic` guard in the epic resolver, is named in the epic as the lane's first
customer and is to be done through the lane itself, so it is fix-lane work rather than an epic.

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-09-05-lightweight-fix-lane.md`
