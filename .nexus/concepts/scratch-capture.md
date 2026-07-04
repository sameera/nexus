---
title: "Scratch Capture"
aliases: ["plan capture", "decision stubs", "plans scratch", "in-flight decision capture"]
touches: ["committed-queue", "distiller", "nexus-pipeline"]
last_updated_by: "manual"
status: active
verification: verified
---

# Scratch Capture

Scratch capture is the opt-in surface that saves what would otherwise evaporate — approved plan-mode plans and in-flight implementation decisions — into ungated, version-ignored, per-branch scratch, so the close stage can mine higher-fidelity rationale than memory reconstructs weeks later.

## How It Works

Two capture paths feed one scratch directory keyed by branch. A per-engineer hook saves each approved plan verbatim the moment it is accepted. A standing instruction has the coding agent append a three-line decision stub — the choice, the why, the refuted alternative — at the moment a non-obvious implementation choice is made, never reconstructed later. At close, the branch's scratch is read as hints only: a decision stub is the highest-fidelity why source but must be confirmed against the shipped diff, and a stub the code contradicts is dropped or surfaced as a deviation; plans are weaker still, useful only to notice where implementation diverged from intent. After the close checkpoint completes, the branch's scratch is deleted so a reused branch never inherits stale hints. Registration is per-engineer and never repo-wide — consent is load-bearing. Capture is sometimes-there by design: a close works without scratch and is merely better with it.

## Key Invariants

1. Scratch is ignored by version control and keyed by branch.
2. Capture is opt-in per engineer; no committed setting registers it repo-wide.
3. Scratch is hints, never authority — the diff remains ground truth, and nothing enters the close record unless the diff confirms it or a human ratifies it.
4. The close stage is the sole consumer, and it deletes the branch's scratch only after its checkpoint completes.
5. The distiller never reads scratch; only the close-gated record carries rationale onward.
6. A decision stub is written at the moment of choosing, never reconstructed later.

## Integration Points

- [committed-queue](committed-queue.md) — scratch is the ungated shadow of the gated queue; only close-gated prose crosses from one to the other.
- [distiller](distiller.md) — the distiller never reads scratch; its why comes only from gated records.
- [nexus-pipeline](nexus-pipeline.md) — the pipeline's close stage is the sole consumer, mining scratch as hints and deleting it.

## Decision Log

### 2026-07-04 — manual — Scratch capture activated in the weaker form

Rationale reconstructed at close confabulates — the genuinely considered alternative is exactly what memory rewrites — so plans and decisions are captured at the moment they happen, into version-ignored scratch that dodges every objection to queue capture: gate purity, provenance, consent, and coverage. Activated ahead of the original revisit trigger because the failure it prevents is unobservable after the fact, and the cost is near zero. Refuted alternative: hook-appending decisions directly to the queued decision record — full automation of the same fidelity goal, but ungated writes to an artifact whose value is that every line passed a human gate.
