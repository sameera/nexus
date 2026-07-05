---
title: "Application Shell"
aliases: ["app shell", "shell", "shell frame"]
touches: [theme-tokens, overlay-coordination, gate-tray, artifact-peek-drawer, pipeline-rail, prime-server-runtime, command-input]
last_updated_by: "#25"
status: active
verification: verified
---

# Application Shell

The application shell is the persistent full-height frame that wraps the Claude Code session in Nexus Prime: a fixed-height top strip over a dominant terminal region, with ephemeral surfaces overlaid on top. It is the structural skeleton every region mounts into, and establishes the codebase's logical-region folder convention.

## How It Works

The shell is a single full-height flex column. A slim persistent top strip holds the epic identity, the pipeline stage rail, and a tools cluster; below it the terminal region flex-fills the remaining space and dominates the surface. Three ephemeral surfaces overlay this frame — the gate tray, the advance bar, and the peek drawer sliding in from the right. The active theme mode is applied once at the shell root, and a single shell-owned state records which overlay surfaces are open, so theming and the terminal recede both resolve in one place rather than per region. The terminal interior is a labelled placeholder for the Claude Code emulation, preserving the integration seam for a downstream epic.

## Key Invariants

1. The shell is a full-height flex column: a fixed-height top strip over a flex-filling terminal region, the surface's dominant region.
2. The terminal interior is a labelled placeholder only — no terminal emulation ships — preserving the seam for the downstream terminal epic.
3. The active theme mode applies only at the shell root; regions never branch on theme.
4. Which ephemeral surfaces are open is held once in shell-owned state; no region tracks the terminal recede on its own.
5. Application source is grouped by logical region, never by file type; no by-type folders exist under the app feature tree.
6. Regions are wired to local mock state, not a real pipeline or Claude Code session.

## Integration Points

- [theme-tokens](theme-tokens.md) — the shell root applies the active theme mode every region inherits.
- [overlay-coordination](overlay-coordination.md) — the shell owns the shared open-surface state driving the terminal recede.
- [gate-tray](gate-tray.md) — the shell hosts the gate tray as an ephemeral surface over the terminal.
- [artifact-peek-drawer](artifact-peek-drawer.md) — the shell hosts the peek drawer as a slide-over anchored to its root.
- [pipeline-rail](pipeline-rail.md) — the top strip hosts the pipeline stage rail.
- [prime-server-runtime](prime-server-runtime.md) — the runtime server-renders the shell chrome on the server pass; the terminal region stays client-only.
- [command-input](command-input.md) — the terminal region hosts the command input as its live input line.

## Decision Log

### 2026-07-02 — sameera/prime#3 — Logical-region shell frame over a by-type layout

The shell is grouped by logical region — layout, header, terminal, gate, drawer, advance — rather than by file type, establishing the codebase's first structural convention while the cost of setting the pattern is lowest. Refuted alternative: the conventional by-type grouping into shared component and hook buckets, which a competent engineer reaches for by default; it loses because it scatters each region's markup, state, and styling across type buckets, obscuring the region boundaries the shell is organised around.

### 2026-07-04 — #15 — Reciprocal link from prime-server-runtime

Recorded the interaction with [prime-server-runtime](prime-server-runtime.md): the runtime server-renders the shell chrome on the server pass while the terminal region it hosts stays client-only. Mechanical reciprocity for the link the runtime page declared.

### 2026-07-05 — #25 — Reciprocal link from command-input

Recorded the interaction with [command-input](command-input.md): the shell's terminal region now hosts a real command input as its live input line, in place of the earlier static prompt placeholder. Mechanical reciprocity for the link the command-input page declared.
