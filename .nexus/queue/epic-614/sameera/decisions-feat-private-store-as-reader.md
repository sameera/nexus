## 2026-09-18 — The cookies carry the `__Host-` prefix
- **Choice:** Both the session and the flow cookie are named `__Host-nexus-session` and `__Host-nexus-flow`.
- **Why:** The prefix makes the browser itself enforce secure, path-wide and domain-less, so invariant 3's host binding cannot be turned off by an environment.
- **Refuted alternative:** Plain names with the same attributes set by hand — identical when correct, but nothing stops a later edit from dropping one.

## 2026-09-18 — The callback redirects to a relative address
- **Choice:** The callback's `Location` is `/?url=<rebuilt pinned address>`, and the authorize request names no `redirect_uri`.
- **Why:** Invariant 9 of record #653 forbids the handler building an absolute address of its own; a relative Location keeps that true, and GitHub uses the App's registered callback.
- **Refuted alternative:** Read the host from the request and build an absolute address — works, but re-introduces a hostname the handler reads of its own.

## 2026-09-18 — A navigation is recognised by both fetch-metadata markers
- **Choice:** `sec-fetch-mode: navigate` **and** `sec-fetch-dest: document` must both be present; their absence means "no session arrived", not a refusal.
- **Why:** The record's invariant 4 answer, and the refuted-alternative note that absence is also what an older browser looks like.
- **Refuted alternative:** Refuse when the markers are absent — turns a missing header into a broken renderer for readers who are not the threat.
