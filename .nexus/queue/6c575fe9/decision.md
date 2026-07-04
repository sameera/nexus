---
title: "Decision: Scratch capture of plans and in-flight decisions for close"
kind: decision
date: 2026-07-04
concepts: [committed-queue, distiller]
---

# Decision: Scratch capture of plans and in-flight decisions for close

## Question

Should Nexus capture engineers' plan-mode plans and the agent's in-flight implementation
decisions, and if so, how do they reach the knowledge store without breaking the gates the
2026-07-03 plan-capture decision defended?

## Decision

Yes — in that decision's own "salvageable weaker form," activated and extended:

- An **opt-in** hook writes plan-mode plans to a gitignored scratch directory,
  `.nexus/plans/<branch>/NN-plan.md`.
- A committed CLAUDE.md rule has the agent append a three-line **decision stub**
  (choice / why / refuted alternative) to `.nexus/plans/<branch>/decisions.md` at the
  moment a non-obvious implementation choice is made.
- `/nxs.close` consumes the branch's scratch as **hints** during its close-from-diff pass —
  the diff stays authority — and deletes the scratch directory after the close checkpoint.
- The distiller never reads `.nexus/plans/`. Only the close-gated record carries rationale
  into the queue.

## Rationale

- **Every objection to the parent proposal targeted the queue; scratch dodges all five.**
  The distiller's data model is intact (it never sees scratch); the curated queue is not
  contaminated (gitignored, close filters); provenance comes free from the branch key
  (same discovery scheme as the queue); sometimes-there coverage is acceptable for hints
  where it was fatal for a dependency; consent is preserved by per-engineer opt-in.
- **Decision stubs are the stronger half.** Plans are pre-implementation speculation and
  routinely diverge from what ships — they stay weak hints. Decisions made during
  implementation are made in contact with real code. 0011 R3 (accepted) already established
  that close-time reconstruction confabulates and capture belongs at the decision moment;
  R3 demanded it as human discipline on the queued decision record. This automates the
  agent-side portion — routed through scratch and the close gate, because hook-appends
  directly to a reviewed queue artifact would be ungated writes to a gated file.
- **Trigger-jump, stated plainly.** The parent decision's revisit trigger — a close-from-diff
  pass demonstrably failing to reconstruct rationale — has not fired. The one real close
  (ce2ac4e1) reconstructed decisions and deviations well, but it ran less than a day after
  implementation; confabulation risk grows with the close gap. We pre-empt rather than
  react because the failure is unobservable after the fact — by the time a close
  demonstrably confabulates, the true rationale is unrecoverable — and the cost is near
  zero (gitignored scratch, opt-in hook).

## Contract (what implementation must honor)

1. `.nexus/plans/` is gitignored; entries are keyed by branch.
2. The plan-capture hook fires on plan approval (PostToolUse on ExitPlanMode) and dumps the
   plan verbatim. The hook **script** is committed under `.nexus/config/`; its
   **registration** lives only in per-engineer `settings.local.json`. Never a committed
   repo-wide hook.
3. The decision-stub rule lives in committed CLAUDE.md — stubs land in the gitignored
   scratch, so capture is harmless without promotion; `/nxs.close` is the promotion gate.
4. `/nxs.close` globs only its own branch's scratch, uses it as hints only, and deletes it
   after the checkpoint so a reused branch never inherits stale hints.
5. The distiller never reads `.nexus/plans/`.

## Refuted alternatives

- **Hook-append decisions directly to the queued decision record.** Automates R3 fully but
  makes ungated writes to an artifact whose value is that every line passed a human gate.
- **A repo-wide committed hook.** Zero-effort coverage of every engineer, but silently
  harvests planning sessions — the consent breach the parent decision named; unchanged.
- **Wait for the revisit trigger.** Costless today, but the trigger detects the failure
  only after the rationale it would have saved is already lost.
