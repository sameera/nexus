---
title: "Gate Tray"
aliases: ["gate", "decision gate", "validation gate", "gate surface"]
touches: [application-shell, overlay-coordination, pipeline-rail]
last_updated_by: sameera/prime#3
status: active
verification: verified
---

# Gate Tray

The gate tray is the ephemeral surface that rises from the bottom of the terminal region when a pipeline decision is required, letting the user act on a pending judgment without the terminal scrollback being replaced. It carries two variants: a judgment gate that presents a decision with its rationale and an inline decision slice, and a validation gate that presents a blocked, red-treated violation checklist. It is Prime's core judgment surface — the wedge over a raw terminal.

## How It Works

When a gate is pending the tray slides up from the bottom of the terminal while the scrollback above stays visible and the terminal recedes behind it. The judgment variant shows a header and badge, the why rationale, an inline decision slice (for example a story list with type badges and split markers), and the gate actions. The validation variant shows the blocked treatment, a checklist of passed and failed rows each with a fix affordance, and its own actions. Which gate is pending comes from the shared overlay state, surfaced when a gate rail segment is chosen; the tray resolves its content from local fixtures. Every action is presentational: the decision buttons resolve and collapse the gate, a peek action opens the artifact drawer, and a fix affordance marks itself in progress. Resolving the gate returns the terminal to full fidelity only when no other surface is still open.

## Key Invariants

1. The tray rises from the bottom of the terminal while the scrollback above stays visible; it never replaces the terminal view.
2. The tray carries exactly two variants — a judgment gate and a validation gate — each matching its mockup treatment.
3. Which gate is pending is read from the shared overlay state; the tray never tracks the terminal recede on its own.
4. All gate actions are presentational; no real gate decision is executed in this epic.
5. Resolving a gate returns the terminal to full fidelity only when no other overlay surface remains open.

## Integration Points

- [application-shell](application-shell.md) — the shell hosts the tray as an ephemeral surface over the terminal.
- [overlay-coordination](overlay-coordination.md) — opening the tray drives the shared recede state.
- [pipeline-rail](pipeline-rail.md) — a gate rail segment surfaces the pending gate in the tray.

## Decision Log

### 2026-07-02 — sameera/prime#3 — Ephemeral tray that preserves the terminal scrollback

The gate is surfaced as an ephemeral tray rising from the terminal with the scrollback left visible behind it, so the user acts on the pending judgment without losing session context. Refuted alternative: replacing the terminal view with a full-surface gate screen — simpler to lay out and a common modal pattern — but it evicts the scrollback the decision often depends on and forces a context round-trip every time a gate opens, defeating the point of an in-terminal judgment surface.
