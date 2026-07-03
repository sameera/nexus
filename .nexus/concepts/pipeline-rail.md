---
title: "Pipeline Rail"
aliases: ["stage rail", "pipeline stages", "stage read-out", "rail"]
touches: [application-shell, gate-tray, artifact-peek-drawer]
last_updated_by: sameera/prime#3
status: active
verification: verified
---

# Pipeline Rail

The pipeline rail is a passive segmented read-out of the pipeline stages shown in the top strip, so the user sees at a glance where the current run stands without the rail acting like a wizard. Each segment reflects its status — done, active, gate, or upcoming — with the matching glyph and colour. Segments preview artifacts and surface pending gates, but they never navigate the pipeline.

## How It Works

The rail renders the ordered stage segments with arrow separators, centred in the top strip. Each segment reflects its status: done, active, gate with an attention pulse, or upcoming, each carrying the matching glyph and colour. A done segment presents as an artifact-preview affordance — hovering or clicking it previews that stage's artifact in the drawer, and it never advances or rewinds the run. A gate segment, when chosen, surfaces the pending gate by re-opening the gate tray. The rail is driven by local mock stage state, not a real pipeline; its job is to read out where the run stands, so no interaction on it changes the pipeline position.

## Key Invariants

1. The rail is a passive read-out of stage state; no interaction on it navigates or advances the pipeline.
2. Each segment reflects exactly one status — done, active, gate, or upcoming — with the matching glyph and colour.
3. A done segment previews that stage's artifact; it never moves the run.
4. A gate segment surfaces the pending gate by re-opening the gate tray.
5. The rail is driven by local mock stage state, not real pipeline state.

## Integration Points

- [application-shell](application-shell.md) — the top strip hosts the rail.
- [gate-tray](gate-tray.md) — a gate segment re-opens the gate tray on the pending gate.
- [artifact-peek-drawer](artifact-peek-drawer.md) — a done segment previews that stage's artifact in the drawer.

## Decision Log

### 2026-07-02 — sameera/prime#3 — Passive read-out over an interactive wizard

The rail is a passive read-out: segments preview artifacts and surface gates but never navigate the pipeline, so it shows where the run stands without steering it. Refuted alternative: an interactive stepper that advances or rewinds the run on click — the familiar wizard pattern a competent engineer reaches for — but it turns a status indicator into a controller, inviting the user to drive the pipeline from the rail when stage progression is owned by the gates and the commands, not the read-out.
