---
title: "Same-Origin Shell Guard"
aliases: ["origin guard", "cross-site websocket hijacking guard", "unauthenticated shell boundary", "origin handshake check"]
touches: ["pty-bridge"]
last_updated_by: "#11"
status: active
verification: verified
---

# Same-Origin Shell Guard

The same-origin shell guard is the sole security boundary of the PTY bridge's unauthenticated shell: it rejects any WebSocket handshake whose stated origin does not match the host the request itself was addressed to, before any shell is spawned. A handshake that states no origin at all is allowed.

## How It Works

The guard derives the allowed origin from each request's own host rather than from configuration, so it is self-adapting across every listen address the server takes — the production default, the dev port, or an ephemeral test port. A browser page always states its origin, so a cross-site page presents a mismatch and is refused at the raw socket before the handshake completes — exactly the cross-site WebSocket-hijacking threat in scope — and mismatch-by-construction also defeats DNS rebinding. A non-browser client states no origin; it cannot be a cross-site vector and already holds local shell access, so rejecting it would only break the bridge's own verification path. The guard, together with the server's loopback binding, is the entire protection: there is no authentication and no transport encryption, an explicitly accepted boundary matching Prime's local single-user nature.

## Key Invariants

1. A present, mismatched origin is refused before the handshake completes and before any shell is spawned.
2. An absent origin is permitted — non-browser clients are not cross-site vectors.
3. The allowed origin is derived per request from the request's own host, never hardcoded or configured.
4. The guard plus loopback binding is the entire security boundary: no authentication, no transport encryption.
5. A malformed origin value is refused, not ignored.

## Integration Points

- [pty-bridge](pty-bridge.md) — the bridge runs this guard as the second of its handshake gates, ahead of any shell spawn.

## Decision Log

### 2026-07-04 — #11 — Allowed origin derived from the request's own host

The listen address varies across prod, dev, and ephemeral test ports, so deriving the allowed origin from the incoming request keeps the guard correct everywhere with zero configuration; allowing an absent origin keeps non-browser clients — the bridge's own verification path — working. Refuted alternative: a configured allow-list of origins — reasonable in a multi-environment deployment, but it duplicates a port the server already owns and gets the ephemeral test-port case wrong.
