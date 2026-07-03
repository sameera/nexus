---
feature: "Server Platform"
feature_path: docs/features/server-platform
epic: "Prime Server Runtime Foundation"
slug: prime-server-runtime-foundation
created: 2026-07-03
type: enhancement
status: draft
complexity: L
complexity_drivers: ["SPA→SSR framework-mode migration replacing Nx's inferred Vite build/serve targets", "new Node server + 3 new integration surfaces (persistence, resource route, WS-mountable origin)", "zero-regression migration across the full existing 1793-LOC component tree", "6 stories with heavy blocked_by interlock on the foundational server story"]
concepts: []
link: "#15"
---

# Epic: Prime Server Runtime Foundation

> ⚠️ **Utilization risk:** assessed L (1–2 weeks). Fills the sprint with no slack for overruns. Watch for scope creep, especially in the Nx build-target replacement (Story 1).

## Description

Prime runs today as a client-only Vite SPA with no server, no persistence, and no route
structure beyond a single implicit screen. That was fine while Prime only orchestrated a
terminal session in the browser — but the next stage of the terminal toolchain (the PTY Bridge,
issue #11) needs a server process to host its WebSocket endpoint, and running that as an
isolated sidecar duplicates infrastructure Prime should own itself.

This epic converts Prime into a React Router 8 framework-mode application with a real Node
server runtime. It establishes four platform capabilities in one coherent migration: a server
host RR8 renders from, a persistence surface for saving prompts and artifacts through server
loaders/actions (filesystem-backed today, shaped so a database can replace it later without
call-site changes), a resource-route path for server-side graphics/chart generation, and a
server structured so the PTY Bridge (issue #11) can mount its WebSocket endpoint on the same
origin later. App
chrome and content SSR; the terminal region — which cannot SSR once a real terminal library is
wired in — stays client-rendered. The existing ~1800 LOC of AppShell, gates, drawers, and
terminal-region migrate onto the new route structure with no feature regression.

This epic precedes and blocks the PTY Bridge epic (#11), which will re-scope to mount its
WebSocket endpoint on this server instead of running as a standalone sidecar.

## Success Metrics

- Prime serves via RR8 framework mode (`dev`, `build`, `preview` all functional) with no
  `@vitejs/plugin-react`/inferred-Vite-target remnants.
- 100% of existing component tests (app, theme, gate-tray, peek-drawer, pipeline-rail,
  advance-bar, terminal-region) pass unmodified in intent after migration.
- A prompt or artifact saved via a server action is retrievable via a server loader after a full
  page reload.
- A stub WebSocket upgrade handler can attach to the running server process and complete a
  handshake, with zero changes to the server's request-handling path.

## Personas

Per `docs/product/context.md`.

## User Stories

### Story 1: RR8 framework-mode server foundation

- **story_type:** system
- **size:** M

**As a** platform maintainer, **I want** Prime running on a React Router 8 framework-mode server
instead of a plain Vite SPA build, **so that** every later capability (persistence, graphics
route, WS mount) has a real server process to attach to.

#### Acceptance Criteria

- [ ] **Given** `apps/prime`, **when** `react-router dev`/`build`/`preview` are run, **then** each
      completes successfully and serves the app — with no dependency on the removed
      `@vitejs/plugin-react` inferred Nx targets.
- [ ] **Given** the root route is requested directly (no JS), **when** the response is inspected,
      **then** it contains server-rendered HTML for the app shell (not an empty client-hydration
      div).
- [ ] **Given** the running server process, **when** a stub WebSocket upgrade handler is attached
      to its underlying HTTP server, **then** a WS handshake completes — proving the server is not
      the fully-managed `@react-router/serve` binary but a custom host with the upgrade path free.
- [ ] **Given** `apps/prime/project.json` now carries explicit build/serve/dev targets, **when**
      `nx run prime:test` (or equivalent) is run, **then** the existing Vitest suite still executes
      correctly (the Vitest config block is moved out of the replaced `vite.config.mts` into its
      own file so `@nx/vitest` inference is not broken by the RR8 Vite-plugin swap).
- [ ] **Given** the dev-vs-prod server strategy, **when** documented in this story's implementation,
      **then** it explicitly states whether local dev also runs through the custom server (Vite
      middleware mode) or keeps the RR8 CLI dev server for dev-only.
- [ ] **Given** RR8's dependency floor (Node 22.22.0+, React 19.2.7+, Vite 7.0.0+), **when** this
      story lands, **then** the workspace Node version is bumped to meet it (local/CI currently run
      22.17.0, below floor) and pinned via `engines`/`.nvmrc` so it doesn't silently regress.

#### Notes

Riskiest story in the epic — Nx has no first-party plugin aware of RR8 framework mode, so
inferred targets are replaced with explicit `nx:run-commands` targets, not a plugin-option swap.
Budget accordingly; do not undersize.

### Story 2: Chrome routes SSR migration

- **story_type:** user
- **size:** M

**As a** Prime user, **I want** the app shell (top strip, gate tray, advance bar, peek drawer,
theme toggle) to keep working exactly as it does today after the server migration, **so that** I
notice no regression from the platform change underneath it.

#### Acceptance Criteria

- [ ] **Given** the root route is requested directly (no JS), **when** the response HTML is
      inspected, **then** it contains server-rendered chrome markup (top strip, gate tray, advance
      bar, peek drawer shell) with no server-side crash.
- [ ] **Given** `theme.tsx`'s current synchronous `localStorage`/`window.matchMedia` read (which
      throws under Node SSR today), **when** migrated, **then** it uses an SSR-safe default with
      client-side rehydration in `useEffect` (a one-frame flash on first load is acceptable).
- [ ] **Given** the app loaded in a browser, **when** compared to pre-migration behavior, **then**
      theme toggle, gate tray, drawer peek, and advance bar all behave identically with the
      existing test suite passing unmodified in intent.

#### Notes

Depends on Story 1's server existing. The theme fix is the one non-trivial part — it's a hard SSR
crash today, not a cosmetic hydration mismatch — so this story is correctly M, not S.

### Story 3: Terminal stays client-only

- **story_type:** system
- **size:** S

**As a** platform maintainer, **I want** the terminal region to render safely during SSR without
executing any client-only logic, **so that** a future real terminal library (xterm/wterm, out of
scope here) can mount there without ever being asked to run on the server.

#### Acceptance Criteria

- [ ] **Given** the root route is server-rendered, **when** the response HTML is inspected,
      **then** the terminal region emits only its current placeholder shell with no client-only
      code executed during the SSR pass.
- [ ] **Given** the app hydrates in a browser, **when** the terminal region mounts, **then** its
      current placeholder behavior is unchanged from before the migration (existing
      `terminal-region.spec.tsx` passes unmodified in intent).

#### Notes

Depends on Story 1. Uses the same SSR-safe-by-construction pattern already proven by
`peek-drawer.tsx` in this codebase (defer to `useEffect`, no module-scope browser-global access).

### Story 4: Persistence surface for prompts and artifacts

- **story_type:** user
- **size:** M

**As a** Prime user, **I want** my prompts and artifacts saved across page reloads, **so that** I
don't lose session work when the browser refreshes.

#### Acceptance Criteria

- [ ] **Given** a save action is submitted for a prompt or artifact, **when** the page is
      reloaded, **then** a server loader returns the previously saved item.
- [ ] **Given** the persistence implementation, **when** inspected, **then** filesystem access is
      isolated behind a storage-interface abstraction — no direct `fs` calls at route call sites —
      so a later swap to a database changes only the interface's implementation, not its callers.

#### Notes

Depends on Story 1. Filesystem-backed now; "database-ready" is satisfied by the interface
boundary, not by building a database.

### Story 5: Server-side graphics/chart resource route

- **story_type:** system
- **size:** S

**As a** platform maintainer, **I want** a working resource route that generates graphics/chart
output on the server, **so that** later features needing server-rendered visuals have a proven
integration point to build on.

#### Acceptance Criteria

- [ ] **Given** a request to the resource route with valid input, **when** it is handled, **then**
      it returns rendered chart/graphic output (e.g. SVG or image) with a 200 response, for at
      least one representative case.
- [ ] **Given** a request with invalid input, **when** it is handled, **then** it returns a
      well-formed error response (not a server crash).

#### Notes

Depends on Story 1. Proves the resource-route capability with one representative case — not a
full charting feature (no chart library/UI selection is scoped here).

### Story 6: Retire "no backend" stack statement

- **story_type:** system
- **size:** S

**As a** contributor reading `docs/system/stack.md`, **I want** the stack doc to reflect Prime's
real architecture, **so that** I don't design against a stale "no backend" assumption.

#### Acceptance Criteria

- [ ] **Given** `docs/system/stack.md`, **when** read after this epic ships, **then** it no longer
      states "no backend, database, or auth layer" and instead documents the Node server host,
      the filesystem-backed persistence surface, and the graphics resource route.

#### Notes

Last story — depends on 1, 2, 4, 5 (the doc should describe what actually shipped).

## Assumptions

- RR8's floor (Node 22.22.0+, React 19.2.7+, Vite 7.0.0+) is met by bumping the workspace Node
  version (local/CI currently 22.17.0, below floor) and pinning it via `engines`/`.nvmrc`; React
  (resolves to exactly 19.2.7) and Vite (resolves to 8.1.3) already clear their floors.
- A custom Node server (Express or plain `http` + `@react-router/express`'s
  `createRequestHandler`) replaces the managed `@react-router/serve` binary specifically to leave
  the WS upgrade path free for epic #11.
- Nx's `@nx/vite`-inferred targets are replaced by explicit `apps/prime/project.json` targets for
  build/serve/dev/preview, since no first-party Nx plugin understands RR8 framework mode.
- Vitest config is split out of `vite.config.mts` into its own file so the RR8 Vite-plugin swap
  doesn't break Nx's test-target inference.
- Theme persistence keeps `localStorage` as the client-side store; SSR uses a safe default and
  reconciles client-side (a brief flash is acceptable — no cookie-based no-flash mechanism is
  built in this epic).

## Out of Scope

- Re-scoping the PTY Bridge epic (#11) itself — tracked separately; this epic only establishes
  the mountable server origin.
- Real xterm/wterm terminal integration — the terminal region remains a placeholder; epic #11
  wires the real terminal.
- Auth or multi-user support — Prime is local, single-user, browser-based (not Tauri).
- A production database — the persistence surface is filesystem-backed now; only the interface
  is designed to be swappable.
- A full charting/visualization feature — Story 5 proves the resource-route capability with a
  representative case, not a complete chart-authoring feature.

## Open Questions

None.

## Implementation Sequence

| STORY | Issue | blocked_by |
|---|---|---|
| STORY-15.01 | #16 | none |
| STORY-15.02 | #17 | STORY-15.01 |
| STORY-15.03 | #18 | STORY-15.01 |
| STORY-15.04 | #19 | STORY-15.01 |
| STORY-15.05 | #20 | STORY-15.01 |
| STORY-15.06 | #21 | STORY-15.01, STORY-15.02, STORY-15.04, STORY-15.05 |
