---
title: "Intake Lane"
aliases: ["landed-change lane", "landed-change intake", "intake entry", "sixth entry point", "recording a landed change"]
touches: ["fix-lane", "fix-razor", "ephemeral-handoff-entry", "distiller", "provenance-reference", "pr-worktree", "decision-record", "conformance-gate", "backlog-stub", "distillation-pr"]
last_updated_by: "#483"
status: active
verification: verified
---

# Intake Lane

The intake lane records a design change that already landed as a merged pull request whose reasoning a decision record never approved. It takes one pull request reference, reads why from its body, review threads and commit messages, and asks the lead only what those leave unexplained. One approval gate follows; approval writes a drainable entry and files its follow-ups as epic stubs. Unlike the fix lane, its entries may create a page, change what one asserts, or retire an invariant.

## How It Works

The fix razor blocks a change that would create a page or alter what one asserts, correctly sending it to epic planning — but planning for a change that already shipped only manufactures acceptance criteria from a diff nobody is choosing. This lane is the other side of that fork: the pull request itself already carries the problem, the alternatives it closed off, and the invariants it relies on, so the lane reads that reasoning instead of re-deriving it. It buys the reach with one review instead of an epic's two: an epic's why is approved once at its decision record and again at the distillation pull request; an intake entry's why is approved only once, at the distillation pull request, because the code has already shipped. A fingerprint of the pull request's body pins the entry to what it read, catching an edited body before the store inherits stale reasoning.

## Key Invariants

1. The lane accepts only a merged pull request; an open or unmerged one is a hard block, nothing written.
2. What changed is always derived from the diff, never described by the lead. A decision no source explains is asked once; a dropped one is recorded nowhere.
3. Every drafted decision is attributed to its source — body, review thread, commit message, or the lead — so third-party reasoning is approved knowingly.
4. Nothing is written to GitHub or disk before the one approval gate; declining writes nothing at all.
5. Filing kept follow-ups as epic stubs is the lane's only irreversible act, done only after approval.
6. The drain re-fetches and re-hashes the pull request body; a mismatch or an unfetchable body refuses the entry, with no waiver and no local substitute.
7. The entry carries no decision-record issue, no conformance receipt, no process lesson, and no comment on the pull request or the epic issue.

## Integration Points

- [fix-lane](fix-lane.md) — the sibling lane for work that has already landed; both resolve references, ranges and refusals through one shared skill, so a rule fixed in one holds in the other.
- [fix-razor](fix-razor.md) — the bound this lane is exempt from: a landed change that would alter what a page asserts takes this lane instead of the fix lane's dead end.
- [ephemeral-handoff-entry](ephemeral-handoff-entry.md) — the version-ignored area the lane writes its two files into, on the same terms a fix entry does.
- [distiller](distiller.md) — drains the entry with the full epic vocabulary, verifying the pull-request fingerprint before reading its why.
- [provenance-reference](provenance-reference.md) — the reference grammar the lane's one input is read in, shared with the fix lane.
- [pr-worktree](pr-worktree.md) — supplies the merge-safe commit range through the same worktree-free read the fix lane uses.
- [decision-record](decision-record.md) — what an epic entry approves instead; this lane never files one, reading its why from the pull request directly.
- [conformance-gate](conformance-gate.md) — refuses to run against this lane's entries, which carry none of the three things it checks.
- [backlog-stub](backlog-stub.md) — where the pull request's kept follow-ups land, filed through the same batch path a close already uses.
- [distillation-pr](distillation-pr.md) — flags this lane's writes distinctly in its body, since their why was reviewed only there.

## Decision Log

### 2026-09-08 — #483 — A third entry kind, bought with one review instead of two

The fix razor's own bound left a gap: a change that needs to create a page or alter what one asserts is refused, correctly, and the only route left was a retroactive epic that manufactures acceptance criteria from a diff — for a change that has already shipped, invented planning ceremony over code nobody is choosing anymore. This lane closes that gap by reading the pull request as the reasoning source it already is, rather than asking the lead to reconstruct it. The reference, range, and refusal rules it shares with the fix lane were extracted into one skill precisely so the two lanes cannot silently diverge; each keeps its own entry template, so a re-recorded fix entry stays byte-identical to before. Refuted alternative: require a reason for every decision the diff shows, mirroring the fix lane's one required question — rejected because on a large pull request it turns the lane into an interview, and the lane stops being cheaper than the epic it replaces.
