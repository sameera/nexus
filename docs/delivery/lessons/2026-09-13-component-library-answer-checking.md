---
date: 2026-09-13
epic: "The rest of the shared component library, and the answer-checking it needs"
source: "#480"
---

# Lesson: an ADDRESS risk's required edit needs its own step, not a downstream gate

The estimate held. Three stories at complexity M, one introducing the answer-checking mechanism and
two consuming it unchanged, landed in three commits on one branch with no deviation from the
decision record. The sequencing the epic declared — #518 and #519 both blocked on #517 — was the
only edge that mattered, and it was enough.

The decision record carried two ADDRESS risks, and they resolved very differently. The first named
a design choice that changed what an acceptance criterion said: the chosen trace-stepper behaviour
moves the mark to the line the next step names, not on by one line as #519's AC2 read, and the
record said the lead edits the issue before implementation starts. That edit did not happen. The
story shipped conformant code against a stale issue, and the mismatch surfaced only when
`/nxs.analyze` read the two against each other and reported a high finding — after the code was
written, not before. The fix was a one-line issue comment, but the record's own remedy — edit the
issue first — never ran, and nothing before analyze would have caught its absence.

The second ADDRESS risk asked for a manual real-browser check, "recorded at analyze," covering
restore behaviour jsdom cannot reproduce. That one was done as written: a Playwright-driven Chromium
session exercised reload and back/forward-cache restore, and the result landed in the queue's
per-user notes before analyze ran, exactly where the close-from-diff pass could find it. The
difference between the two risks is not the risk's content — both named a concrete, checkable
action — but that one had a natural place to be recorded (a scratch file, at the moment the check
was run) and the other had no place to be *done* except a memory of reading the record months
earlier, on an issue nobody was looking at again.

The next epic that carries an ADDRESS risk requiring an issue edit should give that edit a forcing
function the same way the epic's own Implementation Sequence table forces sequencing: name the
issue and the exact text to change in the record itself, so `/nxs.decision-record`'s approval or the
first commit against that story has something concrete to check off, rather than trusting the risk
gets read again before code is written against it.
