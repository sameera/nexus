---
title: "Overlay Coordination"
aliases: ["recede", "terminal dim", "overlay state", "shared overlay"]
touches: [application-shell, gate-tray, artifact-peek-drawer]
last_updated_by: sameera/prime#3
status: active
verification: verified
---

# Overlay Coordination

Overlay coordination is the single shell-owned state that tracks which ephemeral surfaces are open and derives the terminal's recede from it. When any overlay surface is open the terminal recedes and dims behind it; it returns to full fidelity only when no surface remains open. The same state also gates the stage-advance affordance, which is offered only when no overlay surface is up.

## How It Works

One shared state at the shell level records which ephemeral surfaces are currently open — the gate tray and the peek drawer. The terminal recede is a derived read of that state: an open surface means a receded terminal. Because the state lives in one place, closing one surface while the other stays open keeps the terminal dimmed — the mutual guard has a single home and no region reaches into another to check it. The stage-advance affordance shares the same source: it is offered only while no overlay surface is open, because that condition is exactly no gate pending. Running the next stage is a presentational hand-off — it hides the affordance and marks the mock command as running in the terminal placeholder; no real command executes.

## Key Invariants

1. Which ephemeral surfaces are open is held once in shell-owned state; no region tracks the terminal recede independently.
2. The terminal recedes while any overlay surface is open and returns to full fidelity only when none remains open.
3. Closing one surface while another stays open keeps the terminal receded — the mutual guard lives in the shared state, not in the regions.
4. The stage-advance affordance is offered only when no overlay surface is open, deriving its shown state from the same source.
5. Advancing a stage is a presentational hand-off; no real pipeline command executes.

## Integration Points

- [application-shell](application-shell.md) — the shell owns and applies this shared open-surface state.
- [gate-tray](gate-tray.md) — the gate tray opening drives the terminal recede.
- [artifact-peek-drawer](artifact-peek-drawer.md) — the peek drawer opening drives the terminal recede.

## Decision Log

### 2026-07-02 — sameera/prime#3 — One shared overlay state with a mutual guard, absorbing stage-advance

Recede and dim are modelled as one shell-owned state — which surfaces are open drives the terminal recede — and the stage-advance shown-or-hidden rule is folded into the same source, since offer-when-no-gate-pending is exactly no-surface-open. Refuted alternative: per-region recede, where each surface and the advance bar track their own dim; it is superficially simpler and keeps regions self-contained, but it cannot express the unless-the-other-is-open rule without regions reaching into each other, re-introducing the coupling as hidden order-dependent logic.
