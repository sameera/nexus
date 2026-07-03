---
title: "Decision Record: PTY Bridge"
epic: #11
feature: "Terminal Integration"
rating: M
concepts: []
date: 2026-07-03
---

# Decision Record: PTY Bridge

## Summary

The PTY Bridge is a small local Node sidecar — the first server-side process in what
has been a client-only Nx workspace — that spawns a login shell inside a pseudo-terminal
and streams its I/O to a WebSocket client, one shell per connection. The chosen shape
leans on WebSocket's own text/binary frame distinction to avoid inventing a custom wire
protocol, uses the established `node-pty` + `ws` pairing, and is registered as a
hand-authored Nx run target rather than pulling in a new Nx Node plugin. It binds to
loopback only, checks the handshake `Origin`, and carries no auth — matching Prime's
local single-user nature.

## Chosen Approach

A single long-lived Node process runs a WebSocket server bound to `127.0.0.1`. Each
incoming connection owns exactly one PTY session: on connect the bridge spawns the
configured login shell in a pseudo-terminal and pipes bytes bidirectionally between that
PTY and the socket. Shell output travels as WebSocket **binary** frames (raw, unmodified
bytes); the only structured client-to-bridge message — terminal resize — travels as a
WebSocket **text** frame carrying a tiny JSON payload. Session lifecycle is symmetric and
single-owned: socket close tears down the PTY, and PTY exit closes the socket, so both
termination paths converge on one cleanup routine and an active-session counter that must
return to zero.

## Key Decisions

### Wire protocol: exploit WebSocket text/binary opcodes instead of a custom frame format

- **Decision:** Carry raw shell I/O as WebSocket binary messages and the resize control
  message as a WebSocket text (JSON) message; do not layer a custom framing/discriminator
  on top. This resolves the framing question Story 1 explicitly deferred to `/nxs.hld`,
  while preserving Story 1's behavioral contract (exact-byte, in-order, lossless I/O plus
  a structured resize).
- **Why:** WebSocket already frames and type-tags every message, so the binary/text opcode
  is a free, unambiguous discriminator between "shell bytes" and "control." Raw binary
  preserves full terminal fidelity with zero payload bloat on the hot output path.
- **Refuted alternative:** A uniform JSON envelope for every message (input, output, resize)
  with base64-encoded shell bytes. A competent engineer might pick it for one code path and
  easy extensibility, but it roughly inflates high-volume shell output via base64 and adds
  JSON parse/serialize cost on the latency-critical path — losing against the 100 ms
  round-trip criterion and the terminal-fidelity principle.

### PTY implementation: `node-pty`

- **Decision:** Use `node-pty` to spawn and drive the pseudo-terminal.
- **Why:** It is the de facto standard for real PTY control in Node — it handles the
  platform pty syscalls, resize, and child reaping, which are exactly Stories 1 and 3.
  Reimplementing pty handling is out of proportion to an M epic.
- **Refuted alternative:** A prebuilt-binary fork of `node-pty`. It is a genuine option
  that sidesteps the native `node-gyp` build; it loses the default slot only because the
  mainline package is the better-supported baseline, but the fork is the standing fallback
  if the native build proves painful across dev machines.

### Transport library: `ws`

- **Decision:** Use the `ws` library for the WebSocket server.
- **Why:** Node ships no built-in WebSocket *server*, and the eventual consumer is a
  browser terminal, which mandates WebSocket rather than a raw socket. `ws` is the standard,
  dependency-light choice. No viable alternative — the browser client constrains the transport.

### Nx registration: hand-authored run target via `run-commands`, no new Nx plugin

- **Decision:** Register the bridge as a new Nx project with an explicit `project.json`
  whose run target launches the sidecar through the already-present `tsx` runner — mirroring
  how the existing non-app project is registered with an explicit target block rather than
  inferred targets. This satisfies Story 2's "single documented run target."
- **Why:** The workspace's inferred targets do not cover a standalone Node process. A
  hand-authored `run-commands` target reuses an existing dependency and adds no plugin
  surface, keeping the first server-side project minimal and legible.
- **Refuted alternative:** Add the `@nx/node` plugin and generate an application. It gives a
  conventional Node build/serve/bundle pipeline and would pay off if the sidecar grew into a
  real deployable service, but for a loopback dev sidecar it introduces a new build
  toolchain and plugin-inference surface disproportionate to the scope — and this epic is
  explicitly a self-contained local unit, not a hosted service.

### Session lifecycle: one PTY per connection, single convergent teardown

- **Decision:** Model each connection as a session that exclusively owns one PTY child, with
  both termination triggers (socket close, shell self-exit) routed through one cleanup path
  that kills-and-reaps the child and decrements a live-session count. Covers Story 3 in full.
- **Why:** A single owner and a single cleanup path is the only reliable way to guarantee
  "zero orphaned processes after repeated cycles." Splitting cleanup across two independent
  handlers invites the exact leak the story forbids.
- **Refuted alternative:** Process-per-connection isolation (fork a child process per shell so
  OS teardown reaps everything). Viable and arguably more crash-isolated, but it multiplies
  process overhead and IPC for a single-user local tool and still requires the same explicit
  reaping discipline — it loses on complexity for no benefit at this scale.

### Port-in-use: fail fast, do not auto-select

- **Decision:** On a bind conflict the bridge exits non-zero with a clear error rather than
  retrying or incrementing to a free port. Covers Story 2's fail-fast criterion.
- **Why:** The client connects to a known, configured port; silently relocating to another
  port would leave the client unable to find the bridge and mask a real misconfiguration.
  Deterministic failure is the correct behavior for a tool whose contract is a fixed listen
  address.

### Handshake Origin allowlist: guard the unauthenticated shell without adding auth

- **Decision:** The bridge validates the WebSocket handshake `Origin` header against an
  allowlist and rejects any handshake whose origin is not permitted. This is a scope edit to
  **Story 2** (bridge run target and configuration): the allowlist ships as part of the
  bridge's configuration surface, defaulting to local origins. It is not authentication and
  does not identify a user.
- **Why:** Loopback bind alone does not stop cross-site WebSocket hijacking — WebSocket
  handshakes are exempt from same-origin/CORS, so any web page the developer visits while the
  bridge runs could otherwise open `ws://127.0.0.1:<port>` and drive a real shell (drive-by
  RCE). An `Origin` check closes that vector at near-zero cost while staying inside the epic's
  explicit "no auth" scope. Resolved at the Phase 2 gate.

## Constraints & Invariants

1. The bridge must bind exclusively to the loopback interface (`127.0.0.1`), never to
   `0.0.0.0` or a routable address — because it runs an unauthenticated shell, the loopback
   bind is a security boundary and widening it exposes remote arbitrary command execution.
2. The bridge must reject any WebSocket handshake whose `Origin` header is not on the
   configured allowlist, so a cross-site page cannot drive the loopback shell.
3. Each WebSocket connection owns exactly one PTY session; connections are never multiplexed
   over a single socket, and multiple concurrent connections each get an independent shell.
4. Shell I/O bytes must traverse the socket unaltered and in order (binary frames); no
   transformation, buffering reorder, or lossy encoding may sit on the output path.
5. Every session-termination path — client disconnect and shell self-exit alike — must
   converge on one cleanup that terminates and reaps the PTY child, such that after any
   connect/disconnect cycle the spawned shell PID no longer exists and the active-session
   count returns to zero.
6. With no configuration overrides the bridge must listen on a single documented default port
   and spawn the user's default login shell (`$SHELL`); a supplied port and shell path must
   override both exactly.
7. A port bind conflict must produce a clear error and a non-zero exit; the bridge must never
   continue in a degraded or relocated state.

## Risks (BLOCKER / ADDRESS only)

- **ADDRESS — Governance deviation: the system stack doc declares "no backend, database, or
  auth layer."** This epic introduces the first server-side process into a documented
  client-only workspace. The deviation is intended and scoped, but the system docs must be
  updated so future work does not treat "client-only / no server process" as a live
  invariant. Mitigation: update the system stack doc (and seed a standards note) to record the
  new local-sidecar surface as part of this epic's closeout.
- **ADDRESS — `node-pty` native build fragility.** `node-pty` compiles a native addon via
  `node-gyp`, which can fail on developer machines lacking a build toolchain — directly
  blocking Story 1's "bridge is running" precondition. Mitigation: if the mainline native
  build proves unreliable across target dev environments, fall back to the prebuilt-binary
  fork identified in Key Decisions; document the required build prerequisites in the run
  target's docs.

## Open Clarifications

<!-- none — resolved at the Phase 2 gate -->
