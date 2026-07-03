---
feature: "Terminal Integration"
feature_path: docs/features/terminal-integration
epic: "PTY Bridge"
slug: pty-bridge
created: 2026-07-03
type: enhancement
status: draft
complexity: M
complexity_drivers: [new local Node sidecar in a client-only monorepo, PTY lifecycle management, bidirectional WebSocket streaming, process-teardown correctness]
concepts: []
link: "#11"
---

# Epic: PTY Bridge

## Description

Prime runs Claude Code inside an in-browser terminal, but the browser cannot spawn a real
operating-system shell on its own. The PTY Bridge is the local piece that closes that gap: a
small sidecar process, running in the monorepo, that spawns a normal login shell inside a
pseudo-terminal and streams the shell's input and output over a WebSocket. It is the
server-side half of the terminal — the thing the frontend terminal later connects to.

This epic delivers the bridge as a **self-contained, independently verifiable unit**. It has no
UI and does not touch the Prime frontend; its correctness is proven with a WebSocket client
alone. That isolation is deliberate: the bridge can be built, run, and tested on its own before
any frontend wiring exists, so the harder concern (a correct, leak-free shell lifecycle) is
settled first and the later terminal mount (`terminal-mount`) becomes a pure client-side wiring
job against a known-good contract.

Scope is intentionally local and single-user, matching Prime's nature as a client-side developer
tool: the bridge binds to loopback, carries no auth, and runs one shell per connection.

## Success Metrics

- A WebSocket client can connect to the running bridge and drive an interactive shell end-to-end
  (send input, receive the shell's output) with no frontend involved.
- Zero orphaned shell processes after repeated connect/disconnect cycles — the active-session
  count returns to zero.
- The bridge starts from a single documented run command with a configurable port and shell.

## Personas

Per `docs/product/context.md`. The direct consumer of the bridge is a **technical client** (a
WebSocket client, later the Prime frontend) and the **developer** who runs it locally; both map
to the canonical Engineer / Solo developer personas.

## User Stories

### Story 1: Sidecar spawns a shell and streams it over WebSocket

- **story_type:** system
- **size:** M

**As a** terminal client, **I want** the bridge to spawn a login shell in a pseudo-terminal and
stream its I/O over a WebSocket, **so that** a browser terminal can drive a real interactive
shell.

#### Acceptance Criteria

- [ ] **Given** the bridge is running, **when** a WebSocket client connects, **then** a login
      shell is spawned inside a pseudo-terminal and the shell's initial prompt output is delivered
      to the client over the socket.
- [ ] **Given** a connected client, **when** the client sends input bytes over the socket, **then**
      those exact bytes are written to the PTY and the shell's resulting output is streamed back
      over the same socket, in order and without loss.
- [ ] **Given** a connected client, **when** the client sends a resize control message with new
      column and row counts, **then** the PTY dimensions are updated to those values (verifiable
      via the shell reporting the new size).
- [ ] **Given** a connected client, **when** the client writes a single line of input, **then** the
      shell's echo of that line is observed back on the socket within 100 ms under local
      conditions (measurable round-trip assertion).

#### Notes

The wire protocol (raw binary vs. framed control messages for input/output/resize) is a design
decision for `/nxs.hld`. This story fixes the *behavioral contract*, not the framing.

### Story 2: Bridge run target and configuration

- **story_type:** system
- **size:** S

**As a** developer, **I want** a single run target that launches the bridge with a configurable
port and shell, **so that** I can start it consistently and point it at the shell I want.

#### Acceptance Criteria

- [ ] **Given** the monorepo, **when** I invoke the bridge's run target, **then** the bridge
      process starts and listens for WebSocket connections on the configured port, binding to
      loopback only.
- [ ] **Given** no overrides, **when** the bridge starts, **then** it binds to a documented default
      port and spawns the user's default login shell (`$SHELL`).
- [ ] **Given** a port and a shell path supplied via configuration/environment, **when** the bridge
      starts, **then** it binds to the supplied port and the process it spawns is the supplied
      shell (assert the launched shell matches the override).
- [ ] **Given** the configured port is already in use, **when** the bridge starts, **then** it
      fails fast with a clear error and a non-zero exit rather than starting in a broken state.

### Story 3: Session teardown on socket close

- **story_type:** system
- **size:** S

**As a** developer, **I want** the bridge to terminate the shell and release resources whenever a
session ends, **so that** disconnects never leave orphaned shell processes behind.

#### Acceptance Criteria

- [ ] **Given** a connected session with a live shell, **when** the WebSocket closes (client
      disconnect), **then** the PTY child process is terminated and reaped — the spawned shell PID
      no longer exists after teardown.
- [ ] **Given** a live session, **when** the shell exits on its own (e.g. the user runs `exit`),
      **then** the bridge closes the WebSocket and cleans up the pseudo-terminal.
- [ ] **Given** N repeated connect/disconnect cycles, **when** the cycles complete, **then** the
      number of orphaned shell processes is 0 and the bridge's active-session count returns to 0
      (no leak).

## Assumptions

- The bridge runs as a **local Node sidecar in the monorepo** (per the stub goal), added as a new
  Nx-managed project — it is not the client-only Prime app and introduces the first server-side
  process in the workspace.
- **Local, single-user, no auth.** The bridge binds to loopback and carries no authentication or
  TLS — consistent with Prime being a client-side local developer tool with no backend/auth layer
  (`docs/system/stack.md`).
- **One shell per WebSocket connection.** Each connection owns exactly one PTY session; multiple
  independent connections are allowed but not multiplexed over a single socket.

## Out of Scope

- The frontend terminal mount and `@wterm/react` wiring — that is the separate `terminal-mount`
  stub/epic. The bridge is verified with a bare WebSocket client here.
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
