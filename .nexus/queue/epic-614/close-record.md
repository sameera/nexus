---
title: "Close Record: The renderer reads a private store as the reader"
epic: "#614"
feature: "Issue Assets"
date: 2026-09-18
nexus_version: 0.57.0
analyze: ran 2026-09-18 @ 2aec67a7c4e2b851be0b625308725e1037a0dec8
record: "#660"
record_hash: ff2fc74504c2cb244470172466a29d6650eafa7270b5d4f5b296b769b2804118
range:
  - repo: github.com/sameera/nexus
    base: 2ab3bfd23d13a98ce3c0a147da1bdf6afddd7aba
    head: 6b8cc36db60b655ef5fabfcd4b619202f10ce330
---

# Close Record: The renderer reads a private store as the reader

## Key Decisions

- **Both cookies carry the `__Host-` prefix** (`__Host-nexus-session`, `__Host-nexus-flow`). The
  prefix makes the browser itself enforce secure, path-wide and domain-less, so record #660's
  invariant 3 cannot be turned off by an environment. Refuted alternative: plain names with the same
  attributes set by hand — identical when correct, but nothing stops a later edit from dropping one.

- **The callback redirects to a relative address.** The callback's `Location` is
  `/?url=<rebuilt pinned address>`, and the authorize request names no `redirect_uri`; GitHub uses
  the App's registered callback. This keeps record #653's invariant 9 true — the handler builds no
  absolute address of its own. Refuted alternative: read the host from the request and build an
  absolute address — works, but re-introduces a hostname the handler reads of its own.

- **A navigation is recognised by both fetch-metadata markers.** `sec-fetch-mode: navigate` and
  `sec-fetch-dest: document` must both be present, and their absence means "no session arrived"
  rather than a refusal. Refuted alternative: refuse when the markers are absent — turns a missing
  header into a broken renderer for readers who are not the threat.

- **A missing installation is recognised from GitHub's own message.** A credentialed 403 whose body
  says "not accessible by integration" is answered as a store that is not set up for rendering;
  everything else GitHub turns away is the one non-disclosing refusal. This is the only signal
  available on the fetch the renderer already makes. Refuted alternative: ask GitHub separately
  whether the app is installed — a second round trip on every refusal, on an endpoint a
  user-to-server token cannot reach.

- **A sealing key of the wrong size is the same failure as no key at all.** `authFromEnvironment`
  requires exactly 32 base64-encoded bytes and throws otherwise, so an instance given a truncated or
  mistyped key refuses to start rather than sealing sessions under a weak one. Record #660's
  invariant 13 states only that a missing key refuses to start; the size check is the same refusal
  extended to a key that is present but unusable.

- **The token's life is taken from GitHub, with a stated fallback.** `tokenExchange` uses GitHub's
  own `expires_in` and falls back to eight hours when GitHub states none, and the session cookie's
  `Max-Age` is set to that same value. The record requires the cookie's life to be no longer than the
  token's; deriving both from one number is what makes that true by construction rather than by
  review.

## Deviation Rationale

- **Invariant 9 is keyed on a usable session, not on a carried cookie** (deviates from record #660,
  invariant 9). The invariant reads "any request that carried a session cookie", but `handler.ts`
  marks the response `no-store` when `sessionOf` returned a session — so a request carrying an
  expired, tampered, or non-navigation cookie gets `immutable` instead. Keying on a usable session is
  the only form the invariant can take without the handler doing what it otherwise refuses to do:
  reading a cookie on a request the browser did not mark as a navigation is exactly what invariant 4's
  credential criterion forbids. The invariant's wording predates that resolution. The hazard it exists
  to close — one reader's content cached and served to another — needs a credential to have been
  spent, and none is spent on any path that gets `immutable`. The code is right and the record's
  wording is what lagged.

- **`not-found` was removed outright, not only for signed-in readers** (deviates from record #660,
  "One refusal covers missing and inaccessible alike", which scoped the non-disclosing refusal to a
  signed-in reader and said the renderer's own refusals are unchanged from epic #612). Shipped,
  `not-found` is deleted and every turned-away fetch that does not begin a sign-in answers
  `unreadable`, including the uncredentialed path against a public store. Story #657's second
  criterion has to hold for every path that reaches it, and keeping two refusals that differ only in
  wording is how they drift apart. Refuted alternative: keep `not-found` for the uncredentialed path —
  it would disclose existence to exactly the reader a leaked link reaches.

- **The sign-in redirect is gated on a marked navigation** (deviates from record #660, "If GitHub
  refuses a request that carried no credential, the renderer redirects the reader into GitHub's
  authorization flow"). Shipped, the condition is `session === null && isNavigation(request)`, so a
  client sending no fetch-metadata markers is refused at a private store rather than sent to sign in.
  `beginSignIn` is the start of a credential flow, so it inherits the credential criterion rather than
  sitting outside it: redirecting a non-navigation client into GitHub's authorize address would begin a
  flow whose callback that same client could never complete, since the callback requires the markers
  too. Refusing is the honest answer. The record's sentence describes the flow without restating a
  condition it had already established one decision earlier.

## Waived Stories

none

## Deferred Scope

none — this close deferred nothing new. The epic's deferred scope (session expiry, signing out and
invalidation) was already filed as stub #658 at planning, and the deployment question stays deferred
from epic #612.

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-09-18-invariants-written-before-the-decisions-settled.md`
