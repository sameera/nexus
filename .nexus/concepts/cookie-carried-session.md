---
title: "Cookie-Carried Session"
aliases: ["sealed session", "no session store", "session lives in the browser", "reader session", "sealing key"]
touches: ["borrowed-reader-access", "navigation-marked-credential", "rebuilt-return-address"]
last_updated_by: "#614"
status: active
verification: verified
---

# Cookie-Carried Session

The reader's credential is sealed into a cookie in the reader's own browser and kept nowhere else. The renderer holds nothing between requests, so a fresh instance with no history answers a returning reader exactly as the instance that signed them in would. The accepted price is that no single session can be ended.

## How It Works

The session value is sealed with authenticated encryption under a key the environment hands the instance when it starts. An instance given no key, or one of the wrong size, refuses to start rather than sealing sessions under a weak one. An altered or foreign value simply opens as nothing, so it is not a session.

The browser enforces the cookie's own protections, because the cookie's name carries the prefix under which a browser accepts a cookie only when it is secure, path-wide and bound to the one host that set it. No build or environment setting can turn one of those off. The cookie is sent on a top-level navigation from another site, because a mockup link is clicked from an issue page and the stricter setting would sign the reader in again on every link. It is not sent on a background request from another site.

The credential carries its own end. The session's life is taken from the life the host gave the credential, so the renderer states no expiry of its own.

## Key Invariants

1. No session state is held anywhere but in the reader's own cookie.
2. A fresh instance with no history answers a returning reader identically.
3. The sealing key is required at start and has no built-in value; a missing or wrong-sized key refuses the start.
4. The cookie is not readable by script, travels only over a secure connection, and is bound to the host that set it.
5. The cookie arrives on a cross-site top-level navigation and not on a cross-site background request.
6. The session's life is never longer than the life the credential itself was given.
7. No single session can be ended; rotating the sealing key ends every session at once and is the only revocation there is.

## Integration Points

- [borrowed-reader-access](borrowed-reader-access.md) — the credential this session carries, and the fetch it is spent on.
- [navigation-marked-credential](navigation-marked-credential.md) — the condition under which the cookie is read at all; on any other request it is treated as absent.
- [rebuilt-return-address](rebuilt-return-address.md) — the second, short-lived cookie of the same shape, which carries a sign-in in progress.

## Decision Log

### 2026-09-18 — #614 — The session is a sealed cookie carrying the credential, with no store behind it

State that travels with the request is the only shape that leaves a fresh instance answering a returning reader identically, and the only shape that can be shown against a listener a developer starts while the deployment question is still open. Choosing a credential that expires on its own is what stands between "session expiry is out of scope" and "a credential is held forever", since the renderer states no end of its own. Refuted alternative: put an opaque reference in the cookie and keep the credential in a store outside the handler. It is better on both things that matter later, because the credential never sits in the browser and a session can be ended from the server side, which is exactly what the deferred session work will want. It loses because it is infrastructure, with provisioning, failure modes and a cost owner, in an epic whose deployment question is still open, and because none of it can be shown against an instance a developer starts. The price is recorded and accepted: a leaked cookie is a live credential until it expires by itself.

### 2026-09-19 — #667 — The renderer runs as a serverless function, and holding nothing made that a wrapper

The deployment question the entry above left open is answered: the renderer is hosted as a serverless function. Nothing about the session changed, because nothing is held between requests. One translation turns the host's event into the request the renderer already answers, and turns the answer back into what the host returns. A warm instance answers a reader exactly as a cold one does, which is invariant 2 read in the host's terms rather than a new claim.

The cookie is the one part that translation must handle itself. This host delivers a request's cookies in a field of their own rather than in the single header the renderer reads, so the translation puts them back into that header. It also takes what a response sets on the browser from a field of its own, so the header the response would otherwise carry them in is removed before the answer is returned. Leaving both in place would set every cookie twice.

What an instance takes from its environment is now assembled in one place, so the listener a developer starts and the deployed function are handed the same instance. The refusal to start without a sealing key is therefore the same refusal in both, rather than one written twice.
