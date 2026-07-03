---
title: "Application Shell"
aliases: ["app shell", "shell", "shell frame"]
touches: [theme-tokens, overlay-coordination, gate-tray, artifact-peek-drawer, pipeline-rail]
last_updated_by: sameera/prime#3
status: active
verification: verified
---

# Application Shell

The application shell is the persistent full-height frame that wraps the Claude Code session in Nexus Prime: a fixed-height top strip over a dominant terminal region, with ephemeral surfaces overlaid on top. It is the structural skeleton every region mounts into, and it establishes the codebase's logical-region folder convention.

## How It Works

The shell is a single full-height flex column. A slim persistent top strip holds the epic identity, the pipeline stage rail, and a tools cluster; below it the terminal region flex-fills all remaining vertical space and is the dominant region of the surface. Three ephemeral surfaces overlay this frame — the gate tray rising from the terminal, the advance bar, and the peek drawer sliding in from the right. The active theme mode is applied once at the shell root, and a single shell-owned state records which overlay surfaces are open, so both theming and the terminal recede resolve in one place rather than per region. The terminal interior is a labelled placeholder standing in for the Claude Code emulation, preserving the integration seam for a downstream epic.

## Key Invariants

1. The shell is a full-height flex column: a fixed-height top strip over a flex-filling terminal region that is the dominant region of the surface.
2. The terminal interior is a labelled placeholder only — no terminal emulation ships — preserving the integration seam for the downstream terminal epic.
3. The active theme mode is applied only at the shell root; regions never branch on theme.
4. Which ephemeral surfaces are open is held once in shell-owned state; no region tracks the terminal recede on its own.
5. Application source is grouped by logical region, never by file type; there are no by-type folders under the app feature tree.
6. Regions are wired to local mock state, not a real pipeline or Claude Code session.

## Integration Points

- [theme-tokens](theme-tokens.md) — the shell root applies the active theme mode that every region inherits.
- [overlay-coordination](overlay-coordination.md) — the shell owns the shared open-surface state that drives the terminal recede.
- [gate-tray](gate-tray.md) — the shell hosts the gate tray as an ephemeral surface over the terminal.
- [artifact-peek-drawer](artifact-peek-drawer.md) — the shell hosts the peek drawer as a slide-over anchored to its root.
- [pipeline-rail](pipeline-rail.md) — the top strip hosts the pipeline stage rail.

## Decision Log

### 2026-07-02 — sameera/prime#3 — Logical-region shell frame over a by-type layout

The shell is grouped by logical region — layout, header, terminal, gate, drawer, advance — rather than by file type, establishing the codebase's first structural convention while the cost of setting the pattern is lowest. Refuted alternative: the conventional by-type grouping into shared component and hook buckets, which a competent engineer reaches for by default; it loses because it scatters each region's markup, state, and styling across type buckets, obscuring the region boundaries the shell is organised around.
