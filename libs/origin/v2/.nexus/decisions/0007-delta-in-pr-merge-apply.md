# 0007 — Distiller applies via a reviewed distillation-PR

**Status:** Decided.
**Date:** 2026-06-21
**Builds on:** [`0001-refactor-direction.md`](./0001-refactor-direction.md) (two-store wall D1, code-is-truth-for-the-*what* D3),
[`0003-concept-schema.md`](./0003-concept-schema.md) (ConceptDelta shape §8.2, triggers §8.1),
[`0006-queue-distillation-handoff.md`](./0006-queue-distillation-handoff.md) (committed queue, drain mechanism, A-why/B-what split).
**Amends:** 0006 (the distiller's apply); 0003 §8.1 (locus of the authoritative write).
**Resolves:** 0006's one weak link — the authoritative knowledge write was an *unattended* LLM run on main, never reviewed.

---

## Decision

The distiller does **not** write `.nexus/concepts/` on main directly. On its post-merge drain
(0006 trigger unchanged), it constructs the deltas — the *what* from the merged diff, the *why*
from the queued human artifacts — and **opens a distillation-PR against the concept store**. That
PR is human-reviewed (naturally batching the epics drained in that window) and, on merge, updates
the concept pages. The consumed queue entries are deleted when the distillation-PR merges.

Everything else in 0006 **stands**: System A captures the *why* as human prose in the feature PR
(the close record, gated by feature review); A stays dumb, B stays smart; the *what* is
code-derived post-merge; the two-store wall holds. This is an amendment to *where B's output
lands*, not a relocation of synthesis.

---

## Why

0006 routed the *why* through review (the close record rides the feature PR) but left the
**authoritative write itself unreviewed** — an LLM run wrote the concept store on main with no
human in the loop. The concept store's payload is non-regenerable judgment (0001 D3); an
unsupervised write to it is the pipeline's weakest link.

Routing B's output through a PR fixes this with **mechanism the team already has** — the same
review gate every other change to a tracked store passes through — and adds **no new pre-merge
machinery**. The synthesis stays in B (0006's A-dumb/B-smart bet is preserved); only its
destination changes from "main" to "a reviewable branch." This is the literal expression of 0004
B0 ("candidates never write the concept store directly; apply is an explicit curated step"): the
distillation-PR *is* the curated apply.

## Considered alternative — delta authored in the feature PR (rejected)

The earlier draft of this record pulled delta *construction* pre-merge: `/nxs.pr` would build the
full delta, commit it to the feature branch, and have the author + reviewers verify it, with a
deterministic merge hook applying it. **Rejected on three real costs:**

- **Net-added machinery.** It made the human pre-author the code-derivable *what* (`touches`,
  invariants, How-It-Works), then re-validate it against the final merged code (block-on-drift) —
  two steps to re-derive what 0006 already produced from the final diff. Machinery added to solve
  a staleness problem the design itself created; against the refactor thesis (0001).
- **Concurrent-update hazard.** Two feature PRs authoring deltas to the same concept against
  different base states apply serially but not *correctly* — each delta is blind to the other.
  0006's single post-merge synthesizer sees the final state of all drained epics and reconciles
  once; the distillation-PR inherits that property. Strictly better.
- **Coupling + merge friction.** It welded the pipeline to a PR-shaped feature workflow and could
  stall a feature merge to regenerate a knowledge artifact.

Its **only** unique benefit was reviewing the knowledge write with fresh code context, by the
people who wrote the code. That did not justify the costs — and most of the *why* it would surface
is already reviewed at feature-PR time via the close record. The distillation-PR keeps the review,
loses the costs, at the price of decoupling knowledge review from code review (below).

## What 0007 keeps vs. changes (relative to 0006)

| Aspect | 0006 | 0007 |
|---|---|---|
| *Why* capture | human prose in feature PR (close record) | **unchanged** |
| Synthesis location | System B, post-merge | **unchanged** (A-dumb/B-smart stands) |
| Drain trigger | post-merge scan of `.nexus/queue/**` | **unchanged** |
| B's output destination | **direct write to `.nexus/concepts/` on main** | **a distillation-PR against the concept store** |
| Authoritative write | the distiller run | **the distillation-PR merge** |
| Queue-entry consume | deleted at distill | deleted **when the distillation-PR merges** (still recoverable via git history) |

## Consequences (honest)

- **Knowledge review is decoupled from feature review** — a different reviewer, less code context,
  later in time. Accepted: it is a deliberate *batched curation* surface (0004 B0), and the *why*
  was already reviewed at feature-PR time; the distillation-PR reviews the *what*-abstraction and
  the page-patch mapping — exactly the LLM-derived parts that most warrant a second look.
- **A review backlog can form** if distillation-PRs aren't drained promptly. 0004 C12 expiry
  governs undrained queue entries; the distillation-PR is the drain, so its cadence becomes an
  operational SLO.
- **A new role question** — who reviews the distillation-PR (a knowledge-store maintainer vs.
  round-robin). Out of scope here; B-phase.
- **Two-store wall:** A never writes concepts; B's write is now gated by PR review before it is
  authoritative. Cleaner than 0006, not weaker.

## Open / out of scope

- **Cadence** — per-merge distillation-PR vs. nightly/periodic batch.
- **Reviewer assignment** for the distillation-PR.
- **Optional refinement (not decided):** upgrade A's *why* capture from free prose to a structured
  Decision Log stub the human authors directly, so B carries it **verbatim** instead of re-mining
  prose→structure (removes one lossy LLM hop). This stays on the human surface and does **not**
  pull the *what* pre-merge, so it is compatible with this decision — pursue or drop in B-phase.

These are B-phase build details; this record fixes only **where B's authoritative write lands and
how it is gated** — the interface, per 0001 D5.
