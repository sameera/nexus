---
title: "Workbook Handoff"
aliases: ["handoff record", "paused workbook", "resume at the handed-off story", "outstanding handoff", "verified resolution", "manual override"]
touches: ["learner-folder", "workbook-store", "teaching-session", "handoff-prompt", "return-verification"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Workbook Handoff

Workbook Handoff is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

## How It Works

Nothing here asserts the concept any more. The teaching stage left Nexus as its own package,
and its knowledge left with it — one page, one decision log, one place it can be wrong. What
stayed is this stub, because two things still need the name. A reader who greps an old slug
gets an answer instead of silence. And the pages here that name this one keep a live edge: an
edge whose other end is gone is a dead edge, which reads as though the interaction lapsed when
in fact it only moved.

The bullets below are the interactions as they stood when the page left. They are a map to
follow, not a claim about today; the page in the teaching repository is what is current.

## Key Invariants

1. This entry asserts nothing about behaviour; the page in the teaching repository is the one that does.
2. The name keeps resolving here, so a reader who searches the old slug is told where it went.
3. Edges from pages that stayed keep resolving, so no page here carries an edge whose other end is gone.

## Integration Points

- [learner-folder](learner-folder.md) — where handoff records are kept, under the same one ignore rule and the same write guard.
- [workbook-store](workbook-store.md) — the workbook a session opens, whose pages the resumed story sits among.
- [teaching-session](teaching-session.md) — the chain that reads an outstanding pause on arrival and decides nothing else while one is open.
- [handoff-prompt](handoff-prompt.md) — the brief written beside a pause, recorded through this mechanism rather than a second one.
- [return-verification](return-verification.md) — the suite and fence checks that must both pass before a pause is marked verified.

## Decision Log

### 2026-09-07 — #405 — A handoff is an append-only record a session reads back

Each handoff is its own file and a resolution is appended to it, mirroring two conventions the repository already runs on, so the mechanism needs no new idiom and is safe when two sessions touch the workbook. Keeping the record as the contract lets this stop at recording a handoff and reading it back, which is where the story scopes it. A session rather than a page does the reading, which also keeps a second rendered output with a different lifetime out of the epic. Refuted alternative: a single mutable document holding the current position and the outstanding handoffs. It is one file and one parse with no scan, but it loses the history of what was handed off and when, and a mutable document invites an agent rewriting it rather than appending to it, which is how an outstanding handoff quietly becomes wrong.

### 2026-09-07 — #407 — A pause belongs to one workbook, and a resolution says how it was reached

A record names the workbook it paused in, and a session reads only that workbook's records. At most one handoff outstanding is a rule about one workbook, so a record naming no workbook belonged to any of them and one workbook could resume at another's pause. Resolving now appends how the resolution was reached, because one line for both made a resolution a check had verified indistinguishable from one a person asserted. This entry also records the reciprocal links to the session that reads a pause, the prompt written beside it, and the checks that verify it. Refuted alternative: keep the fallback that claimed a record naming no workbook. It is kinder to a record written before the field was carried, but that fallback is exactly what breaks the one-outstanding rule, and the path that writes these records has always written the workbook's name.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
