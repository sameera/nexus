---
title: "Close Record: PR-Driven Post-Merge Flow for Analyze, Close, and Distill"
epic: "#101"
feature: "PR-Driven Delivery"
date: 2026-07-20
analyze: ran 2026-07-20 @ 717ec0f
range:
  - repo: github.com/sameera/nexus
    base: 0681e3d8c0b546c75e801dfc9119dd5c515f70c0
    head: 717ec0ffbc06be2f51d04cfc22c1a016bb112f1c
---

# Close Record: PR-Driven Post-Merge Flow for Analyze, Close, and Distill

## Key Decisions

The build matched the decision record; the load-bearing decisions carried through to the shipped
code unchanged. The durable ones:

- **Git/PR mechanics live in a tested helper, not inline spec prose.** The merged-state gate, the
  range derivation, and the worktree lifecycle went into `@nexus/pr-worktree` with a thin
  `nxs-pr-worktree` CLI shim; the three command specs call it. *Why:* these are the
  must-be-exactly-correct, deterministic parts, and the codebase already prefers tested helpers for
  git mechanics — so they became unit-testable. *Refuted:* describing the git commands inline in the
  specs (lighter, no new package) — rejected because worktree cleanup and range correctness would
  become unverified model discipline.
- **Support single-repo and hub; reject member repos up front.** *Why:* a member's close runs on its
  feature branch and migrates the entry to the hub — a pre-merge, cross-repo choreography
  incompatible with a post-merge worktree cut from the trunk; a hub drains its own queue much like
  single-repo. *Refuted:* full member support — rejected as colliding with the migration flow and
  warranting its own design pass (deferred to the backlog).
- **Anchor the stamped range on the merge commit, verified against the PR head; refuse rather than
  guess.** *Why:* the PR branch tip is garbage-collected after a squash + branch delete and the drain
  never fetches, so the range must anchor on trunk-permanent commits; a fixed first-parent rule
  silently under-captures a rebase merge, and verification against the PR head's changed-file set
  catches it. *Refuted:* use the PR's recorded base/head directly — rejected as fragile once the
  branch is squashed and deleted.
- **Publish conformance as a PR review carrying a machine-readable receipt block.** *Why:* the verdict
  belongs in the merge box, and a machine block lets close read the result back without a local file
  that would vanish with the ephemeral worktree. *Refuted:* a plain comment (no merge-box signal) or a
  local receipt file (dies with the worktree).
- **Commit and push the close artifacts on the distill branch; the epic-issue comment is the durable
  why.** *Why:* post-merge there is no feature PR for the close record to ride, so it travels on the
  distillation PR; pushing removes the single-machine risk, and the record is add-then-deleted within
  that branch. *Refuted:* a separate small closure PR (process weight for a few prose files) or
  leaving the artifacts uncommitted (lost if the worktree is discarded).
- **Make the single-repo drain range-first, with a single-entry continuation mode.** *Why:* on a
  close-prepared branch the introducing-commit diff is degenerate (its most recent add is the close
  commit) and batching across per-closure branches would strand entries; range-first also converges
  single-repo onto how the hub already derives. *Refuted:* keep whole-queue batching — rejected as
  stranding entries closed on other branches and reporting false drain-SLO breaches.
- **Add a supported `/nxs.hld --from <path>` bridge to import an out-of-pipeline design doc.** *Why:*
  work designed outside the pipeline has no rationale channel the drain reads; the import mode brings
  that rationale in as abstracted decisions-and-rationale prose, gating (not inventing) when a
  rationale is missing. *Refuted:* manual transcription only (unsupported, error-prone) or distilling
  the raw session/scratch (unreviewed; the drain reads only curated records).

## Deviation Rationale

No deviations. The close-from-diff pass compared the landed change (`0681e3d...717ec0f`, 31 files)
against the decision record's chosen approach, constraints, and all seven invariants and found a
matched implementation: `@nexus/pr-worktree` carries the helper mechanics, `identity.ts` rejects
member repos up front, `range.ts` anchors on the merge commit and refuses an unverifiable / empty /
non-ancestor range, and the vendored component fingerprint was re-stamped (invariant 6). The one
low-severity analyze note — that invariant 3's "local drain behaves exactly as before" is worded
more strongly than STORY 5's range-first reorder — is a planning-wording tension, not a code
deviation: the reorder is exactly the "make the drain range-first" decision plus STORY 5 AC1, and the
derived diff is identical for any normally-merged entry.

## Deferred Scope

Deferred items appended to: `docs/features/pr-driven-delivery/backlog.md`

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-07-20-pr-driven-flow.md`
