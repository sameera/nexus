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

The PTY Bridge replaces the stub upgrade handler on Prime's app-owned Node
`http.Server` with a real WebSocket endpoint that spawns one login shell in a
pseudo-terminal per connection and streams its I/O. It rides the Prime server's
own loopback origin — no new process, port, Nx project, or second origin — and
is provable end-to-end with a bare WebSocket client, no frontend. The
distinctive constraint shaping every decision: this is an unauthenticated shell
whose only guard is a same-origin handshake check, so the design's center of
gravity is a correct, leak-free process lifecycle rather than a network security
model.

## Chosen Approach

Keep the exact mount pattern the stub already proves — a no-server WebSocket
server plus a single `upgrade` listener on the app-owned HTTP server — and
thicken it with three ordered gates before the handshake completes: path match,
origin check, then shell spawn on connection. The wire protocol exploits
WebSocket's native frame typing instead of inventing a byte-level envelope:
**binary frames carry raw PTY bytes in both directions** (zero framing tax on the
hot path), and **text frames carry small JSON control messages** (client→server
`resize`, server→client shell-exit notice). Each connection owns exactly one PTY
child; a per-connection session object holds the socket and the PTY and disposes
both idempotently, driven from whichever side ends first. A live-session registry
makes the active count directly observable, so a test can assert it returns to
zero after repeated cycles.

## Key Decisions

### Frame type as the protocol discriminator (binary = PTY I/O, text = JSON control)

- **Decision:** Pass binary WebSocket frames through verbatim to and from the PTY
  with no parsing, and reserve text frames for small JSON control envelopes
  (`resize {cols, rows}` client→server; a shell-exit/close notice
  server→client). The frame type itself is the discriminator.
- **Why:** WebSocket already distinguishes binary from text on the wire, so the
  discriminator is free. This keeps the high-throughput shell-output path
  allocation- and copy-cheap and confines structure to the rare control path —
  satisfying both raw byte streaming and the `resize` channel over one socket
  (Story 1) without a bespoke framing format.
- **Refuted alternative:** A single uniform typed envelope for every message
  (every frame JSON, or a tagged binary header on every chunk). A competent
  engineer might pick it for one parser and one code path, but it taxes every
  output chunk — base64/array-encoding binary into JSON, or prepending and
  slicing a header on each PTY read — for a control channel that fires only on
  resize. The native frame-type split gives the same expressiveness with none of
  that overhead.

### `node-pty` as the spawn mechanism, externalized from the SSR bundle

- **Decision:** Add `node-pty` as a Prime dependency and use it to spawn the
  shell; mark it external in the prod SSR build so the bundler does not attempt
  to bundle the native addon, and resolve its prebuilt binary against the pinned
  Node floor.
- **Why:** A real interactive shell needs a controlling TTY — job control, line
  discipline, and `SIGWINCH` on resize. `node-pty` is the mature Node option that
  delivers a genuine pseudo-terminal with a `resize(cols, rows)` API and an exit
  signal, which map one-to-one onto Story 1's resize criterion and Story 3's
  self-exit criterion.
- **Refuted alternative:** `child_process.spawn` with pipes. It is dependency-free
  and already in Node core, but it gives no controlling terminal: no TTY
  semantics, no working resize, and shells detect the non-tty and drop
  interactive behavior. It cannot satisfy the resize or interactive-echo
  criteria, so it is not viable for this endpoint.

### Same-origin guard derived from the request's own `Host`, absent `Origin` allowed

- **Decision:** Reject a WebSocket handshake whose `Origin` host does not match
  the request's own `Host`, derived per request rather than hardcoded or
  configured. Allow an **absent** `Origin`.
- **Why:** The listen address varies (3000 prod default, 4200 dev, ephemeral in
  tests), so deriving the allowed origin from the incoming `Host` makes the guard
  self-adapting and correct everywhere. A browser page always sends `Origin`, so a
  cross-site page sends a mismatch and is rejected before any spawn — exactly the
  cross-site WebSocket-hijacking threat in scope, and it also defeats DNS
  rebinding (the attacker's `Origin` is present and mismatched). A non-browser
  client sends no `Origin`, cannot be a cross-site vector, and already has local
  shell access; rejecting it would break the epic's primary success metric (the
  bare `ws` verification client sends no `Origin`).
- **Refuted alternative:** A configured allow-list of origins. Reasonable for a
  multi-environment deployment, but here it adds config surface that must track
  the port the server already owns and gets the test/ephemeral-port case wrong.
  Deriving from `Host` is both simpler and more correct for a single-origin
  loopback tool.

### Reject invalid handshakes at the raw socket, before handshake and before spawn

- **Decision:** On a bad origin or a non-bridge path, write an HTTP error and
  destroy the raw socket in the `upgrade` listener; complete the handshake only
  for a valid bridge upgrade. No shell is spawned on a rejected upgrade.
- **Why:** This makes "rejected before any shell is spawned" (Story 2) a
  structural property of the control flow rather than a post-hoc check, and keeps
  `node-pty` unreachable until both gates pass.

### Idempotent, bidirectional session teardown driven from both edges

- **Decision:** A session is disposed by whichever side ends first: socket
  close/error kills and reaps the PTY child; PTY exit closes the socket and
  disposes the session. Dispose is idempotent (the second edge is a no-op) and
  removes all listeners so no closure retains the socket or child. Each session is
  registered on creation and removed on dispose.
- **Why:** Explicit kill-and-reap on socket close, plus socket-close on shell
  exit, is what makes "PID no longer exists after teardown" and the zero-leak,
  active-count-returns-to-zero criteria (Story 3) deterministic and observable.
- **Refuted alternative:** Rely on the OS to reap the child when the socket drops.
  Orphaned shells would linger until they notice closed stdio and exit on their
  own — nondeterministic, and a direct violation of the "PID no longer exists" and
  zero-leak criteria.

### Shell resolution: explicit `PRIME_SHELL` override → `$SHELL` → POSIX fallback, spawned as a login shell

- **Decision:** Spawn from an explicit `PRIME_SHELL` override when present, else
  `$SHELL`, else a POSIX fallback (`/bin/bash` or `sh`), launched as a login
  shell. POSIX (macOS/Linux) only; Windows is out of scope for this epic.
- **Why:** Story 2 requires both a zero-config default and an assertable override.
  `PRIME_SHELL` names the override mechanism the story left open (resolved at this
  gate), keeps the default config-free, and the login shell gives the expected
  interactive environment. Scoping to POSIX matches the `$SHELL` model and Prime's
  local single-user nature; Windows/ConPTY is a separate future concern, not a
  gate on this epic.

## Constraints & Invariants

1. The endpoint mounts only on the existing `upgrade` event of the app-owned HTTP
   server; it adds no new port, process, Nx project, or origin, and the
   request-handling path is untouched — non-upgrade HTTP is served exactly as
   before.
2. Exactly one PTY child exists per WebSocket connection; connections are
   independent and never multiplexed over a single socket.
3. No shell process is spawned until the handshake has passed both the
   bridge-path check and the same-origin `Origin` check; a mismatched `Origin` is
   rejected at the raw socket before handshake completion.
4. The security boundary is the same-origin handshake guard alone — no auth, no
   TLS, loopback only; an absent `Origin` is permitted (non-browser clients), a
   present mismatched `Origin` is refused.
5. Binary frames are raw PTY bytes passed byte-for-byte and in order in both
   directions; text frames are JSON control messages only. Input bytes reach the
   PTY unaltered; output bytes reach the client without loss or reordering.
6. Session teardown is idempotent and fires on both edges (socket close and shell
   self-exit); after teardown the child PID is gone and the endpoint's
   active-session count returns to zero — leak-free across arbitrary
   connect/disconnect cycles.
7. `node-pty` is externalized from the prod SSR bundle and its native binary
   resolves against the pinned Node floor; the dev (Vite middleware) path
   exercises the same mount as prod.
8. Shell selection is POSIX-only (`PRIME_SHELL` → `$SHELL` → `/bin/bash`/`sh`),
   spawned as a login shell; Windows is out of scope for this epic.

*Cross-cutting NFR routing:* the sub-100 ms local echo budget (Story 1) is a
latency SLA, not a property of one subsystem. `docs/system/standards/` does not
yet exist; this budget belongs there when that directory is created, rather than
restated per-epic — flagged as a documentation gap in Risks.

## Risks (BLOCKER / ADDRESS only)

- **ADDRESS — `node-pty` native-addon build in the prod bundle path:** A native
  addon can fail to install (no prebuilt binary for the pinned Node/OS/arch,
  forcing a source compile with toolchain deps) and the bundler will try to bundle
  it unless marked external, breaking the prod build. Mitigation: pin a `node-pty`
  version with prebuilds for the pinned Node floor (or a prebuilt-multiarch fork),
  mark it external in the SSR build input, and add a prod-mode smoke check that the
  built server actually spawns a PTY — not just the dev path.
- **ADDRESS — accepted unauthenticated-shell boundary:** The endpoint is
  remote-code-execution-by-design, guarded only by the same-origin check and
  loopback binding; the absent-`Origin` allowance means any local non-browser
  process can drive a shell. This is in scope and matches the tool's single-user
  local nature, but the human should explicitly accept it, and the design must
  ensure the endpoint is never reachable off-loopback (the listen address is owned
  by #15).
- **ADDRESS — 100 ms echo budget has no home:** `docs/system/standards/` does not
  exist yet, so Story 1's latency SLA cannot be routed to a cross-cutting standard.
  Record it there when the directory is created; until then it lives as a Story 1
  acceptance criterion only.

## Open Clarifications

None. Both design clarifications were resolved at the `/nxs.hld` gate and folded
into the record: the shell override is the `PRIME_SHELL` environment variable
(overriding `$SHELL`), spawned as a login shell (Key Decision 6, Invariant 8);
and the epic is POSIX-only, with Windows out of scope (Key Decision 6, Invariant
8).
