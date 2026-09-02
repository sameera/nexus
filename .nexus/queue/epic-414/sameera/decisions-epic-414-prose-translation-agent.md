## 2026-09-01 — Receipt is a fixed plain-text shape, not JSON

- **Choice:** The translator prints a fixed five-field plain-text receipt (`translated:`, `sections changed:`, `sentences rewritten:`, `findings:`, then one line per finding).
- **Why:** The receipt is read by the invoking model, not parsed by a program, and a flat line shape is the cheapest thing to return on the leg the split exists to keep small.
- **Refuted alternative:** A JSON receipt object — machine-checkable, but it is not machine-read anywhere, and its punctuation costs tokens on every run.

## 2026-09-01 — The agent body names the two content rules it does not hold

- **Choice:** The agent body states the concreteness and add-nothing rules by name, and says they are not its own.
- **Why:** A small model told only "apply these six" will silently extend them; naming the two it must not execute is what makes the density-report behaviour follow.
- **Refuted alternative:** Omit them entirely, keeping the body minimal — cheaper, but it leaves the reporting duty in #416 unmotivated from the agent's side.

## 2026-09-01 — Density findings share the receipt's count field rather than adding a second list

- **Choice:** The receipt's fourth field is `density: <count>`, and the finding lines follow it directly; there is no separate general-findings list.
- **Why:** Density is the only finding kind the translator raises, so a second list would always be empty and would still cost a line on every run.
- **Refuted alternative:** Keep a generic `findings:` field with a typed prefix per line, which would extend to future finding kinds — but no other kind is in scope, and the epic's out-of-scope section rules out the one that might have been.
