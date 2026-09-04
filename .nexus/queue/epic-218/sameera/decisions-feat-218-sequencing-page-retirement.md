## 2026-09-04 — Rationale is moved only where the stub does not already carry it

- **Choice:** Of the eight still-open stubs the page carries rationale for, only #132, #215 and #216 received a new note. #209, #211, #212, #213 and #214 were verified to already carry the reasoning (or to express it as a `blocked_by` edge) and were left untouched.
- **Why:** The epic's second acceptance criterion forbids restating an edge as prose, and its notes direct verification rather than duplication where a stub already says the thing — a duplicated note would make the stub body the next surface needing reconciliation, which is the cost this epic exists to remove.
- **Refuted alternative:** Copy every wave-table row's rationale onto its stub verbatim, so the move is mechanical and needs no per-line judgement.

## 2026-09-04 — The line-by-line accounting lives in branch scratch, not a committed ledger

- **Choice:** The proof that no rationale line was lost is recorded in `notes-<branch>.md` beside this file, which the distiller deletes, rather than in a tracked document.
- **Why:** The epic puts "any replacement for the sequencing page, in any form" out of scope; a committed accounting file is that replacement under another name, while ephemeral scratch still gives the reviewer the audit at review time.
- **Refuted alternative:** A short `docs/delivery/` accounting note recording where each line went, kept permanently.
