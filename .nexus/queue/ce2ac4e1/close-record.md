---
title: "Close Record: Prime Server Runtime Foundation"
epic: #15
feature: "Server Platform"
date: 2026-07-03
---

# Close Record: Prime Server Runtime Foundation

## Key Decisions

- **Custom Node server owns `http.Server`; RR8 request handler mounted behind Express.** Shipped exactly as the decision record's load-bearing choice: `server/http-server.ts` wraps the Express app in a plain `node:http` server and leaves the `upgrade` event unhandled and reachable, with a stub `WebSocketServer` (`noServer: true`) proving the seam end-to-end. This is the whole reason the managed `@react-router/serve` binary was rejected — it owns its server and never exposes `upgrade`, forcing the second-origin sidecar this epic exists to avoid. Issue #11 mounts its real endpoint here with zero change to the request path.
- **One entry point for dev and prod (`server.ts`), dev via Vite middleware mode.** The `DEVELOPMENT` branch runs Vite in `middlewareMode` and `ssrLoadModule("./server/app.ts")`; prod imports the built bundle. Both funnel through the same `createAppServer` + `attachStubUpgradeHandler`, so the WS-upgrade seam is exercised in the daily inner loop, not only in a rarely-run prod build. Refuted alternative — keeping the RR8 CLI dev server — would have let the seam rot untested between prod smoke-tests.
- **Explicit `nx:run-commands` targets, not an Nx plugin swap.** No first-party Nx plugin understands RR8 framework mode, so build/dev/preview are hand-authored run-commands; the Vitest config was split into its own `vitest.config.mts` so `@nx/vitest` test-target inference survives the Vite-plugin swap. Refuted alternative — authoring a custom Nx inference plugin — is real long-term value but far more than an M story and premature for one app.
- **SSR boundary held: chrome SSRs, terminal is client-only, theme is SSR-safe-by-construction.** `theme.tsx` renders `DEFAULT_THEME` on the server and first client render, then reconciles `localStorage`/`matchMedia` in a post-mount `useEffect` (one-frame flash accepted; no cookie no-flash mechanism built). The terminal region keeps no module-scope browser access — the same defer-to-effect pattern already proven by `peek-drawer.tsx`. Refuted alternative — client-only rendering everything with an empty hydration div — was lowest-effort but forfeits the SSR metric and pushes a mandatory terminal-boundary fix into #11, coupling two epics that must stay independent.

## Deviation Rationale

- **No `serve` Nx target — shipped set is `build`/`dev`/`preview`/`typecheck`.** The decision record (invariant #7) and Story 1 named `build/serve/dev/preview`. In implementation the `serve` role split cleanly into `dev` (custom server, Vite middleware — the inner loop) and `preview` (the built prod bundle through the same server), which together match the epic's stated success metric ("dev, build, preview all functional"). A separate `serve` target would have been a redundant third serving mode. A `typecheck` target was added to run `react-router typegen` + `tsc`, needed because RR8 generates route types. The decision record's `serve` naming was superseded, not skipped.

## Deferred Scope

Deferred items appended to: `docs/features/server-platform/backlog.md`

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-07-03-front-load-the-nx-target-risk.md`
