---
title: "Decision: No engineer plan-mode capture into the queue"
kind: decision
date: 2026-07-03
concepts: [distiller, committed-queue]
---

# Decision: No engineer plan-mode capture into the queue

## Question

Should Nexus ship a checked-in Claude settings/hook that saves engineers' plan-mode plans
into the committed queue, so the distiller can use them to derive technical detail for
concepts and anchors?

## Decision

No. Engineer plans do not enter the committed queue, and the distiller never consumes them.

## Rationale

- **Breaks the distiller's data model.** The distiller's invariant is that *what changed*
  comes from the recomputed merged diff and *why* comes from human-gated records. A plan is
  neither: it is pre-implementation speculation that routinely diverges from what ships.
  Distilling from plans risks recording rationale for code that never landed; the diff is
  ground truth, and `/nxs.close` already reconciles plan-vs-actual deviation.
- **Contaminates a curated queue.** Every queue artifact passes a human gate (epic approval
  digest, decision-record review, close checkpoint). Hook-dumped plans are unreviewed and
  unbounded — one epic yields many sessions, replans, and throwaway plans, plus plans for
  work unrelated to any epic. This is the speculative-over-generation failure mode Nexus
  exists to guard against.
- **No provenance.** A capture hook has no epic context; plans land unattributed. Manual
  tagging would erase the zero-effort advantage.
- **Accidental coverage.** Only engineers using Claude Code plan mode are captured; other
  tools and hand-planning produce nothing. The distiller cannot depend on a sometimes-there
  input.
- **Boundary and consent.** Nexus stops at implementation. A repo-wide settings file that
  silently harvests engineers' planning sessions into committed artifacts crosses that line,
  and plans often contain half-ideas never meant as record.

## Refuted alternative — salvageable weaker form (deferred)

An opt-in, per-engineer hook (`settings.local.json`) that writes plans to a gitignored
`.nexus/plans/` scratch directory. `/nxs.close` may consult them as hints during its
close-from-diff pass — never as authority; the diff still wins and the close record stays
the human-gated artifact. The distiller itself never sees plans, so no invariant moves.

**Revisit trigger:** a close-from-diff pass demonstrably failing to reconstruct
implementation rationale from the diff and records alone. Until then this is speculative
machinery for a single-entry queue, per the 0012 capability-ladder logic.

## Meta-decision

Out-of-band decisions like this one (idea → analysis → rejection, no code diff) get a route
into the concept store via a **decision-only queue entry**: a single reviewed `decision.md`
memo (this file is the first), drained by the distiller as a diff-less entry into the
relevant concepts' decision logs through the normal distillation-PR. A separate ADR
directory was rejected — it creates a second decision surface competing with the
per-concept decision logs, and the split-brain re-asks the very questions it was meant to
settle. Bar for a memo: it must refute an alternative someone would plausibly re-propose.
Formalizing capture as a `/nxs.decide` skill is deferred until hand-written memos become
frequent enough to annoy.
