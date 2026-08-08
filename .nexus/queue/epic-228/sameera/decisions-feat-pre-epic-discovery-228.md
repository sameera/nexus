## 2026-08-08 — Discovery store filenames and the unique key's shape

- **Choice:** The discovery doc is `discovery.md`; a ticket is `ticket-<nn>-<ticket-slug>.md`; the folder key is 8 lowercase hex characters.
- **Why:** `discovery.md` is a name no stage scans for, the numbered ticket prefix gives a stable listing order without encoding dependency order, and 8 hex matches the key shape the existing queue entries already use.
- **Refuted alternative:** Name the doc after the slug (`<slug>.md`) so the folder reads self-describing — rejected because every session would have to derive the doc's name from the folder's name before it could read it.

## 2026-08-08 — Staleness threshold for a ticket claim is 24 hours

- **Choice:** A claim on an unresolved ticket may be taken over once it is older than 24 hours.
- **Why:** A claim has to outlive one working session so a parallel same-machine session cannot steal an in-flight ticket, and has to expire fast enough that a claim arriving in someone else's pull does not park the ticket for a week.
- **Refuted alternative:** No fixed threshold, deciding staleness by asking the user each time — rejected because the takeover is the one path a session must be able to take unattended.

## 2026-08-08 — The direct-plan path also gets the marked gist comment

- **Choice:** When a discovery right-sizes to M or smaller and is planned as one epic, `/nxs.epic` posts the same marked gist comment on the epic issue that the stub path posts on each stub.
- **Why:** The record's invariant 5 requires anything outliving a discovery to be copied in full into a durable artifact, and on this path there is no stub body to carry it — the folder is removed and the reasoning would be lost outright.
- **Refuted alternative:** Read the acceptance criterion literally and write gists only onto stubs — rejected because it silently drops every decision of a small discovery on the floor.

## 2026-08-08 — The component fingerprint pin rides the last commit that touches `.claude/`

- **Choice:** `libs/portable-tools/bundle-fingerprint.json` is re-pinned once, in the final story commit that changes `.claude/commands/`, rather than once per story commit.
- **Why:** The pin is a derived hash of the whole component tree, so a per-commit re-pin would rewrite the same line five times and conflict on every replay, while buying nothing — only the branch tip is ever vendored.
- **Refuted alternative:** Re-pin in each story commit so every commit passes the parity test on its own — rejected as churn on a single derived line that no consumer reads at an intermediate commit.
