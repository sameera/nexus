---
title: "Decision Record: Prime Server Runtime Foundation"
epic: "#15"
feature: "Server Platform"
rating: L
concepts: []
date: 2026-07-03
---

# Decision Record: Prime Server Runtime Foundation

## Summary

This epic converts Prime from a client-only Vite SPA into a React Router 8 framework-mode app fronted by a custom Node server, so the PTY Bridge (issue #11) can later mount a WebSocket endpoint on the same origin. App chrome SSRs; the terminal region stays client-only. The riskiest part is not the SSR itself but replacing Nx's inferred Vite build/serve targets with explicit run-commands, since no Nx plugin understands RR8 framework mode.

## Chosen Approach

Stand up a custom Node HTTP server that wraps React Router's request handler, and run that same server in both dev (via Vite middleware mode) and production. Drive it through explicit `nx:run-commands` targets for build/serve/dev/preview, and split the Vitest config out of the Vite config so Nx test inference survives the plugin swap. Migrate the existing ~1800 LOC component tree onto the route structure with SSR enabled for chrome and an SSR-safe boundary at two known browser-coupled points: the theme store (a hard SSR crash today) and the terminal region (deferred to a client-only placeholder). Bump and pin the Node floor. Finally, correct the stack doc to describe the real server.

## Key Decisions

### Custom Node server, not the managed serve binary

- **Decision:** Host RR8 through a custom Node process that owns the underlying HTTP server, using React Router's request handler behind it.
- **Why:** The whole point of this epic is to give issue #11 a free WebSocket upgrade path on Prime's own origin. The managed serve binary owns the HTTP server and does not expose the upgrade event, so a sidecar would be forced — exactly the duplicated infrastructure this epic exists to avoid. Owning the server is the load-bearing decision; SSR is almost a side effect of it.
- **Refuted alternative:** The managed serve binary plus a standalone WS sidecar on a second port. Viable and less code up front, but it permanently splits the origin, complicates same-origin auth/proxying later, and defeats the stated success metric (a stub upgrade handler attaching with zero changes to the request path). Rejected on architecture, not effort.

### One server for dev and prod, via Vite middleware mode

- **Decision:** Local dev runs through the same custom server using Vite in middleware mode, not the RR8 CLI dev server.
- **Why:** The WS-upgrade seam is the single most important thing this epic delivers, and it must be exercised daily — not only in a production build path that nobody runs locally. A divergent dev server would let the upgrade seam rot undetected between rare prod smoke-tests. Unifying the paths keeps dev and prod behavior honest at the exact boundary that matters.
- **Refuted alternative:** Keep the RR8 CLI dev server for dev-only ergonomics (HMR out of the box, less custom wiring). Viable and simpler, but it leaves the upgrade seam untested in the inner loop — the one place a regression would actually be caught.

### Replace Nx inferred targets with explicit run-commands

- **Decision:** Define build/serve/dev/preview as explicit `project.json` run-commands targets, retiring the Vite-inferred targets and the current Vite React-plugin chain.
- **Why:** No first-party Nx plugin understands RR8 framework mode, so there is no plugin-option swap available — this is a target replacement, not a reconfiguration. This is the epic's riskiest, most undersizeable work.
- **Refuted alternative:** Author a custom Nx inference plugin/executor to keep targets inferred. Real long-term value but far more than an M story, and premature for a single app. Explicit targets are the boring, reversible choice.

### Split the Vitest config out of the Vite config

- **Decision:** Move the Vitest config block into its own file, decoupled from the RR8-owned Vite config.
- **Why:** The RR8 Vite-plugin swap changes the Vite config that Nx currently reads to infer the test target; leaving the two coupled risks breaking test inference. Separation keeps the test target stable across the migration and is the mechanism behind the "tests pass unmodified in intent" metric.

### SSR boundary: chrome renders on the server, terminal is client-only

- **Decision:** App shell (top strip, gate tray, advance bar, peek drawer, theme toggle) SSRs. The terminal region emits only a placeholder shell during SSR and defers all client logic to a post-mount effect, mirroring the proven peek-drawer pattern already in the codebase. The theme store's synchronous browser-storage read is replaced with an SSR-safe default plus client rehydration.
- **Why:** Chrome has no reason not to SSR and benefits from it; the terminal genuinely cannot SSR once a real terminal library lands, so making it SSR-safe-by-construction now avoids a rewrite in #11. The theme read is a hard SSR crash today, not a cosmetic mismatch — it must be fixed for any chrome to render at all, which is why that story is correctly medium-sized, not small.
- **Refuted alternative:** Client-side-only rendering of everything with an empty hydration div, skipping the theme fix. Viable and lowest-effort, but it forfeits the SSR success metric and postpones a mandatory terminal-boundary fix into the PTY Bridge epic, coupling two epics that should stay independent.

### Theme uses a safe SSR default with a one-frame flash

- **Decision:** SSR renders a default theme; the client reconciles from local storage in a post-mount effect, accepting a brief first-load flash. No cookie-based no-flash mechanism is built.
- **Why:** A cookie round-trip to eliminate the flash adds server-read complexity and a new persistence surface for a purely cosmetic gain on a local, single-user app. Not worth it in this epic.
- **Refuted alternative:** Cookie-persisted theme read server-side for zero flash. Legitimate on a public multi-user app; here the cost/benefit doesn't clear.

### Bump and pin the Node floor

- **Decision:** Raise the workspace Node version to RR8's floor (up from the current below-floor version) and pin it so both local and CI environments track it explicitly.
- **Why:** RR8 will silently misbehave or fail below its Node floor; pinning stops local/CI from regressing under it. React and Vite already clear their own floors, so Node is the only mover. Cheap insurance on a foundational migration.

### Correct the stack doc to describe the server

- **Decision:** Remove the "no backend, database, or auth layer" statement from the stack doc and document the Node server host and its WS-mountable origin. Persistence and graphics are out of scope for this epic and must not be mentioned.
- **Why:** A stale "no backend" line actively misleads contributors into designing against an assumption this epic just invalidated. The doc update lands last, after the server and SSR stories, so it describes what actually shipped rather than what was planned.

## Constraints & Invariants

1. The custom server must own the underlying HTTP server and leave the upgrade event unhandled and reachable — a stub WebSocket handshake must complete with zero changes to the request-handling path.
2. Dev and production share the same custom server entry; the dev path runs Vite in middleware mode, not the RR8 CLI dev server.
3. No module-scope access to browser globals (window, document, local storage, media queries) on any code reachable during the SSR pass; browser-coupled logic defers to a post-mount effect.
4. The terminal region emits only its placeholder shell during SSR and executes no client-only code on the server pass.
5. The full existing component test suite (app, theme, gate tray, peek drawer, pipeline rail, advance bar, terminal region) must pass unmodified in intent — behavior parity is the migration's acceptance bar.
6. Direct root-route requests with JS disabled must return server-rendered chrome markup, not an empty hydration div.
7. Nx build/serve/dev/preview targets are explicit run-commands targets; the Vitest config lives in its own file so test-target inference survives the Vite-plugin swap.
8. Workspace Node is pinned at RR8's floor via both the package manifest and a version-manager file; the pin must not silently regress.
9. The theme's SSR default must be deterministic and hydration-stable — a one-frame client reconciliation flash is acceptable; a hydration-mismatch error is not.
10. The stack doc must not claim "no backend" post-epic, and must not reference persistence or graphics (both out of scope for this epic).

## Risks (BLOCKER / ADDRESS only)

- **ADDRESS — Nx target replacement is the epic's real sizing risk:** no Nx plugin understands RR8 framework mode, so build/serve/dev/preview and test inference are hand-rewritten with no reference implementation. The epic's own utilization note already flags zero slack at this size. Treat the foundation story as the critical path, prototype the run-commands targets and the Vitest split first, and cut scope elsewhere before letting this story compress. If explicit targets fight Nx caching/affected-detection, accept degraded caching for Prime rather than blocking the migration.
- **ADDRESS — no home for cross-cutting NFR budgets:** `docs/system/standards/` does not exist, so any workspace-wide budget (SSR latency, hydration-error policy, Node-version policy) has nowhere durable to live and will scatter into story acceptance criteria or rot. This epic should not invent a standards doc's content, but a decision is needed on whether to create `docs/system/standards/` as a follow-up or explicitly accept per-story duplication for now.
- **ADDRESS — the WebSocket seam proof is a stub, not the real PTY Bridge load:** the success metric is a stub upgrade handshake; #11's real traffic pattern is unknown here. The seam can pass the stub test yet still need rework under real terminal traffic. Keep the stub handshake test in CI as a regression guard on the upgrade path; any further rework is #11's scope, not this epic's.

## Open Clarifications

None. The two questions raised during drafting — the React Router major version, and whether dev should share the production server — were both resolved with the human before this record was written: React Router 8 is confirmed (not 7), and dev runs the same custom server via Vite middleware mode. The persistence and graphics stories originally in scope were cut by the human during drafting, which also removed their associated open clarifications entirely.
