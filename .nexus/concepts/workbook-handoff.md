---
title: "Workbook Handoff"
aliases: ["handoff record", "paused workbook", "resume at the handed-off story", "outstanding handoff", "verified resolution", "manual override"]
touches: ["learner-folder", "workbook-store", "teaching-session", "handoff-prompt", "return-verification"]
last_updated_by: "#407"
status: active
verification: verified
---

# Workbook Handoff

A workbook session that pauses at a handoff comes back to it. Each handoff is its own record naming the story that was handed off, kept under the learner folder with everything else personal. Resolving a handoff appends to its record instead of deleting it, so what was handed off and when stays readable.

## How It Works

Opening the workbook means starting a session, not opening a page in a browser, so no rendered page ever reads a handoff. Starting a session lists every outstanding handoff and offers the most recent one to resume at. A workbook with none outstanding resumes at the start. The record's name carries the recording order, so enumerating handoffs is a sorted directory read and needs no timestamp comparison to be deterministic. One file per handoff mirrors two conventions the repository already runs on, one file per discovery ticket and append-only decision scratch per branch. It therefore needs no new idiom, and it is safe when two sessions touch the workbook. A handoff that names no story is refused, because a record naming no story is not a handoff. Resolving a handoff twice changes nothing. What a handoff prompt says, and when a session decides to pause, belong to the session stage that writes them; this concept records the pause and reads it back. A record names the workbook it paused in, and a session reads only that workbook's records, since at most one handoff outstanding is a rule about one workbook. Resolving says how it was reached: verified after a green suite and an intact fence, or an override asserted by hand.

## Key Invariants

1. A handoff record names the story it handed off; a handoff naming no story is refused.
2. Handoff records live under the learner folder and are appended to, never rewritten in place.
3. ~~Resolving a handoff marks its record; nothing is deleted.~~ Resolving marks its record and says whether a check verified it or a person asserted it; nothing is deleted.
4. Outstanding handoffs are enumerable, and the order they are offered in on resumption is deterministic.
5. A session resumes at the most recent outstanding handoff, or at the start when none is outstanding.
6. No rendered page reads a handoff; a session does.
7. A record names the workbook it paused in, and a session reads only that workbook's records.

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
