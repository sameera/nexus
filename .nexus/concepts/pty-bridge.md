---
title: "PTY Bridge"
aliases: ["terminal bridge", "shell endpoint", "websocket shell", "pty endpoint"]
touches: ["same-origin-shell-guard", "prime-server-runtime"]
last_updated_by: "#15"
status: active
verification: verified
---

# PTY Bridge

The PTY bridge is the server-side half of Prime's in-browser terminal: a WebSocket endpoint on the Prime server's own origin that spawns one login shell in a pseudo-terminal per connection and streams its input and output. It is self-contained and provable with a bare WebSocket client.

## How It Works

The bridge mounts on the upgrade seam the Prime server leaves free, replacing the stub that guarded it; the request path is untouched. An incoming upgrade passes three ordered gates — endpoint-path match, the same-origin guard, then shell spawn — so a rejected handshake never reaches a shell. The wire protocol uses WebSocket's native frame typing as its discriminator: binary frames carry raw pseudo-terminal bytes verbatim both ways, while text frames carry small JSON control messages — a resize inbound, a shell-exit notice outbound. The shell runs in a genuine pseudo-terminal, giving real interactive semantics: job control, line discipline, live resize. Shell selection honors an explicit override, then the user's default shell, then a POSIX fallback, always launched as a login shell. Each connection owns a session binding socket to shell; whichever side ends first tears both down, and a live-session registry makes the active count observable.

## Key Invariants

1. Mounts only on the existing upgrade seam of the app-owned Prime server — no new process, port, project, or origin; non-upgrade HTTP is served exactly as before.
2. Exactly one pseudo-terminal child exists per WebSocket connection; connections are independent and never multiplexed over one socket.
3. No shell process is spawned until the handshake passes both the endpoint-path gate and the same-origin guard.
4. Binary frames are raw pseudo-terminal bytes, byte-for-byte and in order, in both directions; text frames are JSON control messages only.
5. Session teardown is idempotent and fires from either edge — socket close or shell self-exit; after teardown the shell process is gone and the active-session count returns to zero.
6. Shell selection is POSIX-only — explicit override, then the user's default shell, then a POSIX fallback — always spawned as a login shell.
7. The native pseudo-terminal dependency stays out of the built server bundle, and dev and prod exercise the same endpoint mount.

## Integration Points

- [same-origin-shell-guard](same-origin-shell-guard.md) — the guard is the handshake gate that must pass before the bridge spawns any shell.
- [prime-server-runtime](prime-server-runtime.md) — the runtime leaves free the upgrade seam the bridge mounts its endpoint on.

## Decision Log

### 2026-07-04 — #11 — Native frame typing as the wire-protocol discriminator

Binary frames pass through verbatim as pseudo-terminal bytes and text frames carry the rare JSON control messages, because WebSocket already distinguishes the two on the wire — the discriminator is free, keeping the high-throughput output path allocation- and copy-cheap. Refuted alternative: one uniform typed envelope for every message (all-JSON, or a tagged binary header per chunk) — one parser and one code path, but it taxes every output chunk to serve a control channel that fires only on resize.

### 2026-07-04 — #15 — Reciprocal link from prime-server-runtime

Recorded the interaction with [prime-server-runtime](prime-server-runtime.md): the runtime leaves the upgrade seam free that the bridge mounts its real endpoint on, replacing the stub the runtime installed to prove and guard the seam. Mechanical reciprocity for the link the runtime page declared.
