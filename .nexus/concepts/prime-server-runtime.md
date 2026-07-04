---
title: "Prime Server Runtime"
aliases: ["prime server", "custom node server", "ssr server host", "upgrade seam", "framework-mode runtime"]
touches: ["pty-bridge", "application-shell"]
last_updated_by: "#15"
status: active
verification: verified
---

# Prime Server Runtime

Prime runs as a server-rendered app fronted by a custom Node server that owns its underlying HTTP server outright, rather than a fully-managed serve binary. Owning the server is the load-bearing choice: it leaves the WebSocket-upgrade path free on Prime's own origin, which is the seam the PTY bridge mounts its endpoint on. App chrome renders on the server; the terminal region stays client-only.

## How It Works

Because the runtime owns the HTTP server, the upgrade event stays unhandled and reachable. A stub upgrade handler completes a real handshake end-to-end, proving the seam and guarding it against regression until the PTY bridge replaces the stub — and it does so without touching the normal request path. One server entry serves both development and production: development loads the app through a live-reload middleware path, production serves the built bundle, and both funnel through the same request path so the upgrade seam is exercised in the daily inner loop, not only in a rarely-run production build. Chrome server-renders so a direct request with no client script still returns real markup. The two browser-coupled points — the theme store and the terminal region — defer their browser access to a post-mount effect, so nothing browser-only executes during the server render pass and the terminal emits only its placeholder there.

## Key Invariants

1. The runtime owns the underlying HTTP server and leaves the upgrade event unhandled and reachable; a stub WebSocket handshake completes with zero change to the request-handling path.
2. Development and production run the same server entry; the upgrade seam is exercised in the daily inner loop, not only in a production build.
3. App chrome server-renders — a direct request with no client script returns rendered chrome markup, not an empty hydration container.
4. No code reachable during the server render pass accesses browser globals; browser-coupled logic defers to a post-mount effect.
5. The terminal region emits only its placeholder during the server pass and runs no client-only code there.
6. The server render default is deterministic and hydration-stable; a one-frame client reconciliation is acceptable, a hydration-mismatch error is not.

## Integration Points

- [pty-bridge](pty-bridge.md) — the runtime leaves the upgrade seam free; the bridge mounts its real endpoint there, replacing the stub.
- [application-shell](application-shell.md) — the runtime server-renders the shell chrome on the server pass, while the terminal region it hosts stays client-only.

## Decision Log

### 2026-07-04 — #15 — Own the HTTP server for a free upgrade seam

Prime hosts a custom Node server that owns its underlying HTTP server, so the WebSocket-upgrade path stays free on Prime's own origin — the whole reason the epic exists, letting the PTY bridge mount its endpoint with zero change to the request path. Refuted alternative: the fully-managed serve binary plus a standalone WebSocket sidecar on a second port. Viable and less code up front, but it permanently splits the origin, complicates same-origin handling later, and defeats the success metric of a stub upgrade handler attaching with no change to the request path. Rejected on architecture, not effort.
