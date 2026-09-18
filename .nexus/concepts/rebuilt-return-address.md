---
title: "Rebuilt Return Address"
aliases: ["open redirect closure", "return address rebuilt from parsed parts", "flow cookie", "sign-in state matching", "no address taken from a request"]
touches: ["cookie-carried-session", "navigation-marked-credential"]
last_updated_by: "#614"
status: active
verification: verified
---

# Rebuilt Return Address

The renderer never redirects a reader to an address taken from a request. Before sending a reader to sign in it puts the address parts it has already parsed, plus a fresh random value, into a short-lived sealed cookie, and on return it builds the address itself from those parts. The set of addresses the renderer can send a reader to is therefore exactly its own content endpoint.

## How It Works

The attack this closes is an open redirect. If the return address travelled through the sign-in as a string and were then redirected to, someone could send a reader a sign-in link whose return address points at a look-alike site. The reader signs in against the real host, sees a real consent screen, and lands on the attacker's page already primed to trust it. An address built from parsed parts cannot point anywhere else, where a check against a list of permitted addresses is a filter that has to stay right forever.

The random value does a separate job. It goes into the flow cookie and into the value the host echoes back, and the two must match before a sign-in completes. That proves the return belongs to the browser that began the flow, which is what stops someone completing a sign-in into another reader's browser under their own account. No part of the address travels in the echoed value.

## Key Invariants

1. Every address the renderer redirects to is either the host's authorization address or one it built itself from already-parsed parts.
2. No value taken from a request is ever a redirect target.
3. The address the renderer builds for itself is relative, so it reads no hostname of its own.
4. A sign-in completes only when the echoed random value matches the one in the cookie set when that flow began.
5. The flow cookie is short-lived, and it is cleared on completion and on every refusal that ends the flow.
6. No part of the address travels in the value the host echoes back.

## Integration Points

- [cookie-carried-session](cookie-carried-session.md) — what a completed flow leaves behind; the flow cookie is sealed the same way and cleared as the session cookie is set.
- [navigation-marked-credential](navigation-marked-credential.md) — the returning endpoint requires the navigation marking as well, and the matching random value is its second factor.

## Decision Log

### 2026-09-18 — #614 — The return address is rebuilt from validated parts and never taken from a request

Rebuilding the address makes the set of addresses the renderer can emit exactly "its own content endpoint", so there is nothing to point elsewhere; the alternative is a filter on a supplied address, which can be wrong. Matching the random value is a separate job from the address, and it closes a different hole: it proves the return belongs to the browser that started the flow, which is what stops a sign-in being completed into someone else's browser under the attacker's own account. Refuted alternative: carry the return address in the echoed state alone and check it on return against a list of the renderer's own addresses. It is one cookie fewer, but it loses twice. The echoed value passes through the host and into referrer and log paths, so the address of a private file travels further than it needs to, and a check on a supplied address has to stay right forever where building one cannot be wrong.
