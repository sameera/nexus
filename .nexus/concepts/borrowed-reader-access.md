---
title: "Borrowed Reader Access"
aliases: ["reader's own access", "access equivalence", "read the store as the reader", "discovered visibility", "no access rule of its own"]
touches: ["cookie-carried-session", "non-disclosing-refusal", "issue-asset-store"]
last_updated_by: "#614"
status: active
verification: verified
---

# Borrowed Reader Access

The renderer answers no question about who may see a mockup. It fetches the file under the reader's own credential, so what a reader can open in the store is exactly what they can open rendered. Nobody is ever granted access to a mockup, because they were already granted it when they were granted the repository.

## How It Works

The renderer holds no statement of which stores are private. It attempts the fetch first every time: without a credential when the reader has no session, and under the reader's own credential when they have one. The store host's refusal of an uncredentialed request is the only signal that this reader needs to sign in. A public store therefore never starts a sign-in, and a store made private later needs no reconfiguration. One request begins at most one sign-in, so a request that already carried a session and is still refused is refused finally and no loop between the renderer and the host is possible.

The configured list of stores the renderer will serve stays, and it is checked before every fetch, credentialed ones included. It bounds which stores the renderer acts on and answers nothing about any reader. Without it, a renderer holding a reader's credential would be a general way to read any private repository that reader can reach, at an address the team trusts.

## Key Invariants

1. Every decision about whether a reader may see a mockup comes from the store's host, for that reader on that request.
2. No access answer is recorded or cached, and the renderer holds no configured statement of any store's visibility.
3. One request performs at most one sign-in redirect; a request that already carried a session and is still refused is refused finally.
4. The configured store list is checked before every fetch; it bounds stores, never readers.
5. A response produced on a request that carried a usable session is marked as not to be stored, even when the store turns out to be public.
6. A reader's credential is spent only against the one configured store the request names.
7. A credential is never written into a response body, a redirect address, a query value, a refusal page or a log line.

## Integration Points

- [cookie-carried-session](cookie-carried-session.md) — where the borrowed credential lives between requests, and the only place it lives.
- [non-disclosing-refusal](non-disclosing-refusal.md) — the answer given when the borrow fails, which must not say whether the file exists.
- [issue-asset-store](issue-asset-store.md) — the store being read; its references ignore visibility on purpose, and visibility is answered here instead, per reader and per request.

## Decision Log

### 2026-09-18 — #614 — The renderer reads the store as the reader rather than holding access of its own

A rule of the renderer's own about who may see a mockup would be a second answer to a question the store's host already owns, and the two would disagree the moment someone's access changed. Borrowing the reader's access also removes per-reader administration entirely: there is one-time setup per store, and after that nobody is ever administered. Visibility is discovered from the host's refusal rather than configured, which keeps a public store servable without a sign-in by construction. Caching is cut at "a credential was involved" rather than at "the store is private", because the renderer deliberately does not know which stores are private; a shared cache keys on the address and not on the reader, so the wrong line would serve one reader's content to the next without the renderer ever being asked. Refuted alternative: name each store's visibility in the renderer's configuration. It answers a genuinely missing file in a public store at once, where discovery sends that reader through a sign-in first, but that cost is paid once by someone who followed a broken link and corrects itself, while a stale visibility value fails silently for every reader of a repository that changed.
