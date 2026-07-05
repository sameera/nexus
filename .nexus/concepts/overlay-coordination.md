---
title: "Overlay Coordination"
aliases: ["recede", "terminal dim", "overlay state", "shared overlay"]
touches: [application-shell, gate-tray, artifact-peek-drawer, command-input]
last_updated_by: "#25"
status: active
verification: verified
---

# Overlay Coordination

Overlay coordination is the single shell-owned state that tracks which ephemeral surfaces are open and derives the terminal's recede from it. When any overlay surface is open the terminal recedes and dims behind it; it returns to full fidelity only when no surface remains open. The same state also gates the stage-advance affordance, which is offered only when no overlay surface is up.

## How It Works

One shared state at the shell level records which ephemeral surfaces are currently open — the gate tray and the peek drawer. The terminal recede is a derived read of that state: an open surface means a receded terminal. Because the state lives in one place, closing one surface while the other stays open keeps the terminal dimmed — the mutual guard has a single home, and no region checks another's state. The stage-advance affordance shares the same source: it is offered only while no overlay surface is open — exactly the no-gate-pending condition. Running the next stage is a presentational hand-off — it hides the affordance and marks the mock command as running in the terminal placeholder; no real command executes. A user-submitted command reaches the terminal through the same slot via a dedicated submit action, replacing whatever was there — one slot, two writers, never two displays.

## Key Invariants

1. Which ephemeral surfaces are open is held once in shell-owned state; no region tracks the terminal recede independently.
2. The terminal recedes while any overlay surface is open and returns to full fidelity only when none remains open.
3. Closing one surface while another stays open keeps the terminal receded — the mutual guard lives in the shared state, not in the regions.
4. The stage-advance affordance is offered only when no overlay surface is open, deriving its shown state from the same source.
5. Advancing a stage is a presentational hand-off; no real pipeline command executes.
6. A user submission and the mock stage-advance write into the same surfaced-command slot; a new value always replaces the prior one, never accumulating per writer.

## Integration Points

- [application-shell](application-shell.md) — the shell owns and applies this shared open-surface state.
- [gate-tray](gate-tray.md) — the gate tray opening drives the terminal recede.
- [artifact-peek-drawer](artifact-peek-drawer.md) — the peek drawer opening drives the terminal recede.
- [command-input](command-input.md) — writes a user-submitted command into this shared slot, alongside the stage-advance writer.

## Decision Log

### 2026-07-02 — sameera/prime#3 — One shared overlay state with a mutual guard, absorbing stage-advance

Recede and dim are modelled as one shell-owned state — which surfaces are open drives the terminal recede — and the stage-advance shown-or-hidden rule is folded into the same source, since offer-when-no-gate-pending is exactly no-surface-open. Refuted alternative: per-region recede, where each surface and the advance bar track their own dim; it is superficially simpler and keeps regions self-contained, but it cannot express the unless-the-other-is-open rule without regions reaching into each other, re-introducing the coupling as hidden order-dependent logic.

### 2026-07-05 — #25 — Command submission reuses the shared surfaced-command slot instead of region-local state

Submitting a command calls a dedicated overlay action that writes into the same surfaced-command slot the stage-advance affordance already writes to, rather than tracking the submitted command in the terminal region's own local state. Why: overlay coordination is deliberately the single home for shared terminal-facing state, and the terminal's existing hand-off already owns "show a command in the terminal" — a second, region-local display path would duplicate that seam. Refuted alternative: keep the submitted command in the terminal region's own local state and render it there directly — simpler in isolation, but duplicates a seam overlay coordination already owns and risks the two display paths drifting apart.
