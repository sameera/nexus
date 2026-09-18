---
title: "Navigation-Marked Credential"
aliases: ["credential criterion", "navigation marker", "top-level navigation check", "read the session only on a navigation"]
touches: ["cookie-carried-session", "rebuilt-return-address"]
last_updated_by: "#614"
status: active
verification: verified
---

# Navigation-Marked Credential

An endpoint of the renderer reads a reader's credential only when the browser's own markers say the request is a top-level document navigation. On any other request the renderer proceeds as though no credential arrived. The browser sets those markers and script cannot, which is what makes them a signal a caller from another origin cannot forge.

## How It Works

The ordinary way to require something a cross-origin caller cannot send is a header of the service's own choosing, and it is unavailable here: the content endpoint is reached by an ordinary navigation, and a navigation carries no such header. Both of the browser's navigation markers must be present, because either one alone is not a navigation.

Their absence is answered by ignoring the credential rather than by refusing the request. That fails closed on what matters, since the credential is never spent on a request the browser did not mark, while leaving public mockups servable by clients that send no markers at all. Refusing instead would turn a missing header into a broken renderer for readers who are not the threat.

Beginning a sign-in inherits the same condition, because a sign-in is the start of a credential flow. A client that could never complete the return trip is refused rather than sent on one. The endpoint the reader returns to requires the marking as well, plus a second factor a cross-origin caller cannot forge because it cannot read the cookie that holds it.

## Key Invariants

1. Exactly two endpoints handle a credential, and each reads one only on a marked navigation.
2. Both navigation markers must be present; one alone is not a navigation.
3. An unmarked request is answered as though no session arrived, not refused, wherever it can be served without one.
4. A sign-in is never begun for an unmarked request.
5. A credential is never spent on a request the browser did not mark as a navigation.
6. The refusal of a document presenting an opaque origin sits in front of both endpoints.

## Integration Points

- [cookie-carried-session](cookie-carried-session.md) — the cookie this condition gates; unmarked, it is treated as though it never arrived.
- [rebuilt-return-address](rebuilt-return-address.md) — the returning endpoint, which requires this marking and the matching random value together.

## Decision Log

### 2026-09-18 — #614 — The browser's own navigation markers carry the credential criterion

An endpoint that handles a credential is required to demand something a caller from another origin cannot send, and the usual answer is not available on an endpoint reached by a navigation. The browser's navigation markers are the exception that fits, because the browser sets them, script cannot, and they tell a navigation apart from a background request exactly. Ignoring the credential rather than refusing the request is the deliberate half of the decision: it keeps the renderer from quietly narrowing the audience it served before it held any credential at all. Refuted alternative: refuse outright when the markers are absent. It is better at bluntness, being one rule with no conditional path, but absence is also what an older browser looks like, so refusing turns a missing header into a broken renderer for readers who are not the threat.
