---
title: "Decision Record: Terminal Mount: Live Interactive Shell"
epic: #30
feature: "Terminal Integration"
rating: M
concepts: []
date: 2026-07-07
---

# Decision Record: Terminal Mount: Live Interactive Shell

## Summary

This epic replaces Prime's placeholder terminal interior with a real in-browser terminal
(`@wterm/react`) mounted client-only and wired to the already-delivered same-origin PTY bridge at
`/pty`, giving the user a genuine interactive login shell inside the region. The chosen shape keeps a
single long-lived terminal instance whose lifetime is deliberately decoupled from the WebSocket
session, so the socket can drop and reconnect underneath a stable, scrollback-preserving grid.
Connection status is surfaced as a layer over a still-visible terminal rather than by freezing or
unmounting it.

## Chosen Approach

Mount the terminal inside the existing terminal region, gated so it renders only after the component
is mounted on the client — the terminal library never executes during SSR. A connection controller,
separate from the visual terminal, owns the WebSocket: it derives a same-origin URL from the current
page origin, demultiplexes frames by WS frame type (binary = raw PTY bytes written to the grid; text
= JSON control, currently only `exit` inbound), forwards keystrokes as binary frames and resize
events as JSON control frames, and drives a small connection state machine (connecting → open →
disconnected/error → reconnecting, plus a terminal `exited` state). The region's existing chrome —
gate tray, advance bar, and the overlay-driven recede/dim — wraps the terminal unchanged; only the
mock scrollback, mock command echo, and the standalone editor input line are retired.

## Key Decisions

### Client-only mount via a post-mount render gate

- **Decision:** Render the terminal only after the component has mounted on the client; the server
  and first hydration pass render an inert terminal frame, and the real terminal appears in a
  post-mount effect. (Covers Story 1.)
- **Why:** The terminal library touches the DOM/canvas and must never run during SSR, but the app is
  fully SSR for chrome. This reuses the exact pattern the theme provider already uses (server renders
  a default, an effect reconciles once mounted), so there is one established idiom rather than a new
  one.
- **Refuted alternative:** A route- or config-level SSR opt-out for the terminal. React Router 8
  framework mode drives SSR at the route boundary, and the chrome in the same route must keep
  server-rendering for fidelity and first paint; carving the terminal out at the framework level
  would fight the framework and split the route. The component-local mount gate is narrower and
  already proven here.

### Terminal instance lifetime is decoupled from the socket lifetime

- **Decision:** Keep one long-lived terminal instance for the region's lifetime; the connection
  controller attaches and detaches the socket underneath it, rebinding I/O on each successful
  (re)connect. A reconnect never destroys and recreates the terminal. (Covers Stories 2 and 3.)
- **Why:** Remounting on reconnect would flash, drop on-screen scrollback, and couple two independent
  lifecycles. Decoupling is what lets Story 3's auto-reconnect restore an interactive session without
  a page reload and without visible churn.
- **Refuted alternative:** Remount the terminal on every connection attempt. Simpler wiring, but it
  loses on-screen history on every blip — a poor fit for the fidelity principle.

### Frame-type demultiplexing, not an envelope

- **Decision:** Mirror the delivered bridge's discrimination exactly — write binary payloads straight
  to the grid, parse text payloads as control JSON, send keystrokes as binary and resize as JSON
  text — and set the socket's binary receive type so binary payloads arrive as raw bytes. No client
  re-wrapping or per-message tagging is added. (Covers Story 2.)
- **Why:** The wire contract is fixed and owned by the server (changing it is out of scope), so the
  client only consumes it.
- *No viable alternative — the wire contract is delivered and this epic only consumes it.*

### `exit` is a terminal state; a socket drop is a reconnect trigger

- **Decision:** An `exit` control frame means the shell process chose to end — show "session ended"
  with a start-new-session control and do **not** auto-reconnect; starting a new session is an
  explicit user action that opens a fresh socket. An unexpected socket close or error means the
  transport failed — show disconnected/error and auto-reconnect with backoff. (Covers Story 3.)
- **Why:** If the two are not distinguished, the client either reconnect-storms after a normal shell
  exit or silently strands the user after a network blip.
- **Refuted alternative:** Treat every close uniformly and always auto-reconnect. It collapses two
  different user intents and would relaunch a shell the user (or a command like `exit`) deliberately
  closed.

### Reconnect with capped exponential backoff plus jitter, short-circuited by manual retry

- **Decision:** Automatic reconnection uses exponential backoff with a ceiling and jitter, reset on a
  successful open. The manual retry control cancels any pending backoff timer and attempts
  immediately. (Covers Story 3.)
- **Why:** The bridge may be unreachable (server restart); retries must not be a tight loop, but the
  user should never be forced to wait out the schedule.
- **Refuted alternative:** Fixed-interval retry. A short interval hammers an unreachable bridge and a
  long one makes recovery feel dead; backoff plus manual retry covers both ends.

### Connection status is a layer over a live terminal, driven by an explicit state machine

- **Decision:** Model connecting/disconnected/error/exited as explicit states and render them as an
  overlay/status affordance on top of the still-visible grid, keeping prior output legible; retry and
  new-session controls sit above it. The terminal is never blanked or disabled to show status.
  (Covers Story 3.)
- **Why:** The criteria require these states to be visible and to never look like a frozen terminal;
  keeping the grid visible preserves fidelity and context.
- **Refuted alternative:** Swap the terminal out for a full-panel status screen per state. Cleaner to
  build, but it hides prior output and reads as a harder failure than it is.

### Resize detection via a debounced observer on the terminal container

- **Decision:** Observe the container's size, refit the grid to compute cols/rows, and send the
  `resize` control frame debounced; also send the current size once on each successful connect so a
  reconnected shell gets the right dimensions. (Covers Story 2.)
- **Why:** The shell's line-wrapping must track the rendered grid, but drag-resizing fires
  continuously and would flood the control channel.
- **Refuted alternative:** Send resize on every layout tick without debounce. Floods the control
  channel during a drag for no benefit.

### Retire the orphaned mock command plumbing as part of Story 1

- **Decision:** Removing the mock scrollback, the mock `running` echo, and the standalone editor
  input line leaves the overlay provider's command-echo state (the mock `running` value and its
  write path) with no consumer. Story 1's scope includes neutralizing that dead plumbing: the advance
  bar keeps its shown/hidden recede coordination and its "run" affordance, but its hand-off no longer
  writes a mock echo into the terminal. This is an **edit to Story 1's scope**, not a new task.
  (Covers Story 1; rewiring "run next" to inject into the live shell stays a downstream epic per Out
  of Scope.)
- **Why:** Leaving the echo state behind the new terminal is unreachable code asserting a behavior
  the epic just deleted, and it rots against the retired input surface.
- **Refuted alternative:** Leave the mock echo state in place. It would be dead code contradicting the
  epic's own scope.

### Adopt `@wterm/react` as the terminal package and reconcile the stack doc

- **Decision:** Mount the published `@wterm/react` React component (v0.3.0) as a client-only
  dependency, and correct `docs/system/stack.md`, whose bare `wterm` name is a documentation error.
  (Resolved at the Phase 2 gate; covers Story 1's dependency addition.)
- **Why:** npm verification: `@wterm/react` is the real React binding of the vercel-labs wterm project
  (scope `@wterm/*`, current at v0.3.0 alongside `@wterm/core`/`@wterm/dom`); bare `wterm` on npm is an
  unrelated 2024 TEST package. The epic's `@wterm/react` is the authoritative name.
- **Refuted alternative:** Consume `@wterm/core` and wrap it in a thin in-repo client-only React
  mount. More control but more code, when a maintained React binding already exists.

## Constraints & Invariants

1. **Client-only boundary:** the terminal library and any of its DOM/canvas access must never execute
   during SSR or first hydration; the server renders only an inert frame (Story 1).
2. **Same-origin transport:** the WebSocket URL is derived from the current page origin (ws/wss by
   page protocol) with the fixed `/pty` path — no configurable host/port, preserving the bridge's
   same-origin security boundary (Story 2).
3. **Wire contract is fixed and consumed, not redefined:** binary frames carry raw PTY bytes both
   directions; text frames carry JSON control (`resize` outbound, `exit` inbound); no server-side
   change is in scope (Stories 2, 3).
4. **Region chrome is preserved:** the gate tray and advance bar remain inside the region and behave
   as before, and the terminal still recedes/dims from the shared overlay state exactly as the
   placeholder did (Story 1).
5. **Single input surface:** the terminal owns all live keystroke input, including single-keystroke
   control (`ctrl-C`); no separate mock input line remains (Stories 1, 2).
6. **Terminal instance survives reconnects:** reconnection rebinds a socket to the existing terminal
   instance and does not remount or clear it (Story 3).
7. **No tight reconnect loop:** automatic reconnection always uses backoff; only a user-initiated
   retry may attempt immediately (Story 3).
8. **`exit` never auto-reconnects:** an `exit` control frame ends the session and requires an explicit
   user action to start a new one; only unexpected drops/errors trigger automatic reconnection
   (Story 3).
9. **Terminal never presents as frozen:** every non-open connection state surfaces a visible status
   over a still-legible grid (Story 3).

## Risks (BLOCKER / ADDRESS only)

- **ADDRESS — `@wterm/react` is not yet in the dependency tree.** The package identity is resolved
  (Key Decision above), but the dependency must be added as client-only and `docs/system/stack.md`
  reconciled to the `@wterm/*` scope. *Detection:* dependency resolution/typecheck fails or the mount
  API doesn't match the component's shape. *Fallback:* consume `@wterm/core` behind the client-only
  mount gate.

## Open Clarifications

<!-- none — the terminal-package question was resolved at the Phase 2 gate (see the `@wterm/react` Key Decision). -->
