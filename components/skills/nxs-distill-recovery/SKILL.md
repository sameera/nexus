---
name: nxs-distill-recovery
description: The recovery-mode contract of /nxs.distill. Read it only when that stage has resolved its run mode as recovery, from a `--recover <epic-issue>` argument.
---

# nxs-distill-recovery

`/nxs.distill` resolves its run mode before it reads any mode-specific instruction. This file is
what it reads when that mode is **recovery**, and nothing else reads it. Every rule below is keyed
to the base stage's own phase numbering and overrides the base stage at that number; the phase order
is the base stage's, unchanged.

Nothing here writes to GitHub, the concept store, the queue or a branch. Branch creation, the
checkpoint stop and the pull-request opening stay in the base stage.

## Input Resolution 4 — rebuild the entry from durable GitHub state

`--recover <epic-issue>` rebuilds that one entry from durable GitHub state when the local copy is
gone (a different machine, a cleared `.nexus/tmp/`, a run days after the close). Recovery is an
**explicit per-entry path, never a discovery source** (record #176, invariant 14): the no-argument
scan never queries closed epic issues looking for undistilled closes. The lead knows which epic they
are recovering, so an explicit invocation is sufficient and bounded.

1. **Re-derive the epic through the resolver**:
   `nexus epic-resolve --epic <n>` → the
   materialized `epic.md` under `.nexus/tmp/epic-<n>/`. A resolver failure is that diagnostic,
   reported verbatim; stop.
2. **Take the *why* and the *what*-facts from the epic issue's close comment**. That comment is
   the durable close record in every mode, local and `--pr` alike (record #176, invariant 4/5).
   Fetch the epic issue's comments. Take the newest one containing the
   `<!-- nexus:close-record -->` marker that is authored by a maintainer (`authorAssociation`
   `OWNER`/`MEMBER`/`COLLABORATOR`, the same trust rule as the analyze block). Ignore untrusted
   bodies and bodies that merely quote one. From it take:
    - the **rationale**: the Key Decisions + Deviation Rationale prose, verbatim;
    - the **record reference and full approved-body hash**, the **conformance verdict**, and
      the **full-SHA landed `range:`**, parsed from the marker-anchored machine block, never
      recomputed (the stamped range is by contract the exact range the close diffed);
    - the **`issues_repo:`** field, when the block carries one. Carry it into the rebuilt
      entry unchanged, so the record-resolution step prefers this stamped value over
      re-resolving `epic-repo` from wherever recovery runs.

   Rebuild `close-record.md` from these at `.nexus/tmp/epic-<n>/close-record.md`, beside the
   re-derived `epic.md`. The rebuilt entry then flows through the ordinary pipeline unchanged:
   Phase 0 hash-verifies the record against the recovered stamp, Phase 1 derives the diff from
   the recovered range, Phase 5.6 re-aims the committed removal at the scratch dir.
3. **Where the epic has a linked PR**, the analyze verdict can also be recovered from the PR's
   published review (the existing `<!-- nexus:analyze-receipt -->` machine block, same trust
   rule) rather than treating conformance as unknown. The close comment's verdict and the
   review must agree. The review is the tie-breaker, because it is the surface
   `/nxs.close --pr` itself read.
4. **The genuinely unrecoverable cases are named per-entry hard blocks**. Report them precisely,
   naming the entry and why it cannot be processed. Never treat them silently as "not yet
   closed", and never process them with fabricated or empty rationale:
    - `no-close-comment`: the epic issue has no trusted close comment (or none carrying the
      machine block), so there is no durable rationale anywhere. Nothing is written.
    - `range-unresolvable` (invariant 11): the recovered range cannot be resolved locally and
      no PR resolves its head. Never a silent empty diff, never a partial one, never an
      invented range.
