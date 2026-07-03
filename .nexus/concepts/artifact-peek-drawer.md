---
title: "Artifact Peek Drawer"
aliases: ["peek drawer", "drawer", "artifact drawer", "artifact peek"]
touches: [application-shell, overlay-coordination, pipeline-rail]
last_updated_by: sameera/prime#3
status: active
verification: verified
---

# Artifact Peek Drawer

The artifact peek drawer is a dismissible slide-over that renders an artifact file so the user can peek at what Claude wrote without leaving the terminal. It slides in from the right over a scrim while the terminal recedes behind it, and it can be opened from several triggers across the shell. It closes on an explicit close control, a scrim click, or the escape key.

## How It Works

The drawer slides in from the right, anchored to the shell root, over a scrim that dims the surface; the terminal recedes behind it through the shared overlay state. It can be opened from three triggers: the tools button in the top strip, a completed rail segment, or a gate peek action. Open, it shows a header carrying the artifact path, a read-only tag, and a close control, then the rendered artifact body, and a footer note. The artifact content is drawn from local file fixtures — there are no real file reads in this epic. The drawer closes when the user clicks the close control, clicks the scrim, or presses the escape key; on close the terminal returns to full fidelity, unless a gate tray is still open, in which case the shared recede keeps it dimmed.

## Key Invariants

1. The drawer is a right-anchored slide-over over a scrim; opening it recedes the terminal through the shared overlay state.
2. It can be opened from the tools button, a completed rail segment, or a gate peek action.
3. It renders read-only artifact content from local fixtures; no real file is read in this epic.
4. It closes on the close control, a scrim click, or the escape key.
5. On close the terminal returns to full fidelity only when no gate tray remains open.

## Integration Points

- [application-shell](application-shell.md) — the shell hosts the drawer as a slide-over anchored to its root.
- [overlay-coordination](overlay-coordination.md) — opening the drawer drives the shared recede state.
- [pipeline-rail](pipeline-rail.md) — a completed rail segment opens the drawer on that stage's artifact.

## Decision Log

### 2026-07-02 — sameera/prime#3 — Dismissible peek over navigating away

Artifacts are shown in a dismissible slide-over that overlays the terminal, so the user peeks at what Claude wrote and returns with the session untouched. Refuted alternative: navigating to a dedicated artifact view — more room to render and a familiar routing pattern — but it tears the user away from the live terminal for a glance, and the peek is by design a quick side-look that must not disturb the session, which an overlay preserves and a navigation does not.
