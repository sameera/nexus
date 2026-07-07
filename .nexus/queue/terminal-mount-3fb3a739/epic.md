---
feature: "Terminal Integration"
feature_path: docs/features/terminal-integration
epic: "Terminal Mount: Live Interactive Shell"
slug: terminal-mount
created: 2026-07-06
type: enhancement
complexity: M
complexity_drivers:
  [
    "new client-only frontend dependency (@wterm/react)",
    "WebSocket session lifecycle + reconnection on the client",
    "wire-protocol integration with the delivered PTY bridge",
  ]
concepts: []
link: "#30"
---

# Epic: Terminal Mount: Live Interactive Shell

## Description

Prime's terminal region is still a placeholder: a static scrollback stand-in and a mock input line
that echoes text but runs nothing. The PTY Bridge (#11) is already delivered — a same-origin
WebSocket endpoint at `/pty` that spawns a login shell and streams its I/O. This epic closes the
loop: it mounts a real in-browser terminal (`@wterm/react`) in the region and wires it to the
bridge, so the user gets a genuine interactive shell inside Prime.

This is the capability Prime's #1 product principle depends on — experiential fidelity. A user
should feel they are in a real Claude Code session, not watching a summarized stand-in. The
terminal **owns live keystroke input**, so full-fidelity interactive programs work: Claude Code's
own TUI, `vim`, `ctrl-C`, tab completion. Typing goes straight to the shell.

Scope is deliberately the **working, connected terminal**: mount, live I/O, and connection
resilience. The richer input experience — a button-invoked, full-height compose panel for
long-form prompts that injects into the live shell — is a clean enhancement on top and is deferred
to a follow-on epic (backlog stub `terminal-compose-panel`). The region's existing chrome must
survive the swap: the gate tray and advance bar still live inside the region, and the terminal
still recedes (dims) when an overlay surface is open.

## Success Metrics

- A user can type a shell command directly in the terminal and see its real output rendered in the
  same region.
- Interactive, raw-mode programs run (a full-screen TUI redraws and responds to keystrokes,
  including `ctrl-C`), proving the terminal owns live input.
- The terminal reflects the actual shell state (prompt, output, exit) streamed from the bridge —
  no mock echo remains.
- A dropped or failed bridge connection surfaces a visible state and recovers without a manual
  page reload.

## Personas

Per `docs/product/context.md`. The primary persona (engineer adopting Nexus) is the user in every
story below; no epic-specific personas.

## User Stories

### Story 1: Mount the terminal as the live surface

- **story_type:** user
- **size:** S

**As a** developer using Prime, **I want** a real terminal rendered where the placeholder was,
**so that** the surface looks and behaves like a terminal instead of static stand-in text.

#### Acceptance Criteria

- [ ] **Given** the app is loaded, **when** the terminal region renders, **then** a real terminal
      (character grid with a cursor) occupies the region in place of the old placeholder scrollback
      text and the standalone mock input line.
- [ ] **Given** the terminal is mounted, **when** the region renders, **then** the gate tray and the
      advance bar are still present inside the region and behave as before.
- [ ] **Given** an overlay surface (peek drawer or gate) is open, **when** it opens, **then** the
      terminal still recedes/dims exactly as the placeholder did (the region's `receded` behavior is
      preserved).
- [ ] **Given** the app server-renders the chrome, **when** the page loads, **then** the terminal
      mounts client-only with no hydration or SSR error (the terminal library never runs on the
      server).

#### Notes

The mock scrollback placeholder, the mock `running`-echo, and the standalone `@nexus/editor` (#25)
input line are all retired here — the terminal becomes the single input surface (direct typing;
Story 2 wires it to the shell). The rich compose panel that will later replace the removed input
line is a separate follow-on epic. This story may render the terminal before it is connected; a
shell prompt is not required yet.

### Story 2: Connect the terminal to the bridge and stream I/O

- **story_type:** user
- **size:** M

**As a** developer using Prime, **I want** the terminal connected to a real shell, **so that** I
can type commands and see their real output.

#### Acceptance Criteria

- [ ] **Given** the terminal is mounted, **when** it initializes, **then** it opens a WebSocket to
      the same-origin bridge path (`/pty`) and, on connect, a live shell prompt appears in the
      terminal.
- [ ] **Given** an open session, **when** the shell produces output, **then** the bytes streamed
      from the bridge are rendered in the terminal faithfully (e.g. running `echo hello` shows
      `hello`).
- [ ] **Given** an open session, **when** the user types in the terminal, **then** the keystrokes
      are sent to the bridge and the shell responds (e.g. `whoami` returns the current user),
      including single-keystroke control input (a running command can be interrupted with `ctrl-C`).
- [ ] **Given** an open session, **when** the terminal's visible grid size changes, **then** a
      resize control message (`{ type: "resize", cols, rows }`) is sent so the shell's line-wrapping
      matches the rendered grid.

#### Notes

Wire contract is the delivered bridge: binary WS frames carry raw PTY bytes both directions; JSON
text frames carry control (`resize` out, `exit` in). No new server work — this is client-side
integration against the existing endpoint.

### Story 3: Connection states and reconnection

- **story_type:** user
- **size:** M

**As a** developer using Prime, **I want** the terminal to show its connection status and recover
from drops, **so that** a lost bridge connection doesn't silently strand my session.

#### Acceptance Criteria

- [ ] **Given** the terminal is establishing a connection, **when** the socket is not yet open,
      **then** a "connecting" state is visible and clears once the session is interactive.
- [ ] **Given** an open session, **when** the socket drops or errors, **then** a "disconnected" (or
      "error") state is shown instead of a frozen-looking terminal.
- [ ] **Given** a dropped connection, **when** the bridge is reachable again, **then** the client
      auto-reconnects (retrying with backoff rather than a tight loop) and restores an interactive
      session without a page reload.
- [ ] **Given** the shell process exits, **when** the bridge sends `{ type: "exit" }`, **then** a
      "session ended" state is shown with a way to start a new session.
- [ ] **Given** a disconnected state, **when** the user chooses to retry, **then** a manual retry
      control re-attempts the connection.

#### Notes

Backoff should avoid hammering an unreachable bridge; the exact schedule is an implementation
detail, but retries must not be a tight loop.

## Assumptions

- The terminal owns live keystroke input and is the sole input surface for this epic (direct
  typing). The mock placeholder text, the mock `running`-echo, and the standalone #25 input line
  are retired; the terminal is strictly more functional than the mock it replaces (it runs real
  commands).
- `@wterm/react` is the terminal library to mount (per `docs/system/stack.md`); it is added as a
  client-only frontend dependency in Story 1.
- The bridge runs on the same origin as the app (its endpoint is `/pty`), so the client derives
  the WebSocket URL from the current origin — no separate host/port config.

## Out of Scope

- The rich compose panel — a Compose button that splits the terminal to a full-height editor for
  long-form prompts (Enter = newline, Ctrl+Enter / Send submits) and injects the composed text into
  the live shell. Deferred to a follow-on epic (backlog stub `terminal-compose-panel`), blocked by
  this one.
- Rewiring the advance bar's stage command-surfacing (`runNext`) to drive the live PTY. The advance
  affordance keeps its current recede coordination; making it inject the next-stage command into the
  real shell is downstream pipeline-integration work.
- Any change to the PTY bridge server (shell resolution, origin guard, session teardown) — the
  bridge is delivered and this epic only consumes it.
- Multiple concurrent terminals / session tabs; scrollback persistence across reloads.

## Open Questions

<!-- none -->

## Implementation Sequence

| STORY | Issue | blocked_by |
|---|---|---|
| STORY-30.01 | #31 | none |
| STORY-30.02 | #32 | STORY-30.01 |
| STORY-30.03 | #33 | STORY-30.02 |
