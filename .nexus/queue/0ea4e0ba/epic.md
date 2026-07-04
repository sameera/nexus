---
feature: "Terminal Integration"
feature_path: docs/features/terminal-integration
epic: "PTY Bridge"
slug: pty-bridge
created: 2026-07-03
type: enhancement
status: draft
complexity: M
complexity_drivers: [PTY lifecycle management, bidirectional WebSocket streaming over the existing server upgrade seam, process-teardown correctness (leak-free reaping)]
concepts: []
link: "#11"
---

# Epic: PTY Bridge

## Description

Prime runs Claude Code inside an in-browser terminal, but the browser cannot spawn a real
operating-system shell on its own. The PTY Bridge closes that gap: the server-side half of the
terminal that spawns a normal login shell inside a pseudo-terminal and streams the shell's input
and output over a WebSocket.

The bridge is **not** a standalone process. Prime now owns a custom Node server (the Server
Runtime Foundation epic, #15, delivered), whose underlying `http.Server` leaves the `upgrade`
event free precisely so this endpoint can mount on it. That seam already exists and is
regression-guarded by a stub upgrade handler (`attachStubUpgradeHandler` in
`apps/prime/server/http-server.ts`); this epic replaces the stub with the real PTY endpoint, on
the **same origin** as the Prime app, with no change to the server's request-handling path.

This epic delivers the endpoint as a **self-contained, independently verifiable unit**. It has no
UI and does not touch the Prime frontend; its correctness is proven with a WebSocket client
alone. That isolation is deliberate: the endpoint can be built, run, and tested against the
already-good server seam before any frontend wiring exists, so the harder concern (a correct,
leak-free shell lifecycle) is settled first and the later terminal mount (`terminal-mount`)
becomes a pure client-side wiring job against a known-good contract.

Scope is intentionally local and single-user, matching Prime's nature as a client-side developer
tool: the endpoint rides the Prime server's loopback origin, carries no auth, and runs one shell
per connection.

## Success Metrics

- A WebSocket client can connect to the running bridge endpoint and drive an interactive shell
  end-to-end (send input, receive the shell's output) with no frontend involved.
- Zero orphaned shell processes after repeated connect/disconnect cycles — the active-session
  count returns to zero.
- The endpoint is reachable as soon as the Prime server runs (`nx dev prime` / `nx preview
  prime`) — no separate process or port to start — and the spawned shell is configurable.

## Personas

Per `docs/product/context.md`. The direct consumer of the bridge is a **technical client** (a
WebSocket client, later the Prime frontend) and the **developer** who runs it locally; both map
to the canonical Engineer / Solo developer personas.

## User Stories

### Story 1: WS endpoint spawns a shell and streams it over WebSocket

- **story_type:** system
- **size:** M

**As a** terminal client, **I want** the bridge endpoint to spawn a login shell in a
pseudo-terminal and stream its I/O over a WebSocket, **so that** a browser terminal can drive a
real interactive shell.

#### Acceptance Criteria

- [ ] **Given** the Prime server is running, **when** a WebSocket client connects to the bridge
      endpoint (the real endpoint having replaced the stub upgrade handler on the server's
      `upgrade` seam), **then** a login shell is spawned inside a pseudo-terminal and the shell's
      initial prompt output is delivered to the client over the socket.
- [ ] **Given** a connected client, **when** the client sends input bytes over the socket, **then**
      those exact bytes are written to the PTY and the shell's resulting output is streamed back
      over the same socket, in order and without loss.
- [ ] **Given** a connected client, **when** the client sends a resize control message with new
      column and row counts, **then** the PTY dimensions are updated to those values (verifiable
      via the shell reporting the new size).
- [ ] **Given** a connected client, **when** the client writes a single line of input, **then** the
      shell's echo of that line is observed back on the socket within 100 ms under local
      conditions (measurable round-trip assertion).
- [ ] **Given** the endpoint is mounted, **when** normal (non-upgrade) HTTP requests hit the Prime
      server, **then** they are served unchanged — mounting the endpoint does not disturb the
      request-handling path.

#### Notes

The wire protocol (raw binary vs. framed control messages for input/output/resize) is a design
decision for `/nxs.hld`. This story fixes the *behavioral contract*, not the framing.

### Story 2: Shell configuration and same-origin connection guard

- **story_type:** system
- **size:** S

**As a** developer, **I want** to select which shell the endpoint spawns and have it reject
cross-site connections, **so that** I can point it at the shell I want while an untrusted page
cannot drive my shell.

#### Acceptance Criteria

- [ ] **Given** no override, **when** a client connects, **then** the endpoint spawns the user's
      default login shell (`$SHELL`).
- [ ] **Given** a shell path supplied via configuration/environment, **when** a client connects,
      **then** the process the endpoint spawns is the supplied shell (assert the launched shell
      matches the override).
- [ ] **Given** a WebSocket handshake whose `Origin` is not the Prime server's own origin, **when**
      the handshake reaches the endpoint, **then** it is rejected before any shell is spawned —
      loopback reach alone does not let an arbitrary local page open a shell.

#### Notes

Port, loopback bind, and fail-fast-on-bind-conflict are **not** in this epic: the Prime server
owns its listen address and port (delivered by #15). What remains here is which shell to spawn
and guarding the unauthenticated shell against cross-site WebSocket hijacking.

### Story 3: Session teardown on socket close

- **story_type:** system
- **size:** S

**As a** developer, **I want** the endpoint to terminate the shell and release resources whenever
a session ends, **so that** disconnects never leave orphaned shell processes behind.

#### Acceptance Criteria

- [ ] **Given** a connected session with a live shell, **when** the WebSocket closes (client
      disconnect), **then** the PTY child process is terminated and reaped — the spawned shell PID
      no longer exists after teardown.
- [ ] **Given** a live session, **when** the shell exits on its own (e.g. the user runs `exit`),
      **then** the endpoint closes the WebSocket and cleans up the pseudo-terminal.
- [ ] **Given** N repeated connect/disconnect cycles, **when** the cycles complete, **then** the
      number of orphaned shell processes is 0 and the endpoint's active-session count returns to 0
      (no leak).

## Assumptions

- **The bridge is a WebSocket endpoint on Prime's existing custom Node server**, mounted on the
  `upgrade` seam left free by the Server Runtime Foundation epic (#15, delivered). It is not a
  standalone sidecar and adds no new Nx project; it replaces the stub upgrade handler
  (`attachStubUpgradeHandler`) already proven on that seam. #15 is a satisfied precondition for
  this epic.
- **Local, single-user, no auth.** The endpoint shares the Prime server's origin, which binds
  loopback in dev (port 4200 via `nx dev prime`). It carries no authentication or TLS; the
  same-origin handshake guard — not a network boundary — protects the unauthenticated shell
  (`docs/system/stack.md` describes the server tier; the earlier "no backend" identity is
  retired).
- **One shell per WebSocket connection.** Each connection owns exactly one PTY session; multiple
  independent connections are allowed but not multiplexed over a single socket.

## Out of Scope

- The frontend terminal mount and `wterm` wiring — that is the separate `terminal-mount`
  stub/epic. The bridge is verified with a bare WebSocket client here.
- A standalone sidecar process, a second origin, or a new Nx project — the endpoint mounts on
  Prime's existing server (#15), not its own process.
- The server's listen address, port, and fail-fast-on-port-conflict behavior — owned by the Prime
  server (#15), not this epic.
- Authentication, multi-user access, remote/hosted exposure, and TLS.
- Persisting, recording, or replaying session history.
- Multiplexing several shells over a single WebSocket connection.

## Open Questions

<!-- none -->

## Implementation Sequence

| STORY | Issue | blocked_by |
|---|---|---|
| STORY-11.01 | #12 | none |
| STORY-11.02 | #13 | STORY-11.01 |
| STORY-11.03 | #14 | STORY-11.01 |
