## 2026-09-01 — Receipt is a fixed plain-text shape, not JSON

- **Choice:** The translator prints a fixed five-field plain-text receipt (`translated:`, `sections changed:`, `sentences rewritten:`, `findings:`, then one line per finding).
- **Why:** The receipt is read by the invoking model, not parsed by a program, and a flat line shape is the cheapest thing to return on the leg the split exists to keep small.
- **Refuted alternative:** A JSON receipt object — machine-checkable, but it is not machine-read anywhere, and its punctuation costs tokens on every run.

## 2026-09-01 — The agent body names the two content rules it does not hold

- **Choice:** The agent body states the concreteness and add-nothing rules by name, and says they are not its own.
- **Why:** A small model told only "apply these six" will silently extend them; naming the two it must not execute is what makes the density-report behaviour follow.
- **Refuted alternative:** Omit them entirely, keeping the body minimal — cheaper, but it leaves the reporting duty in #416 unmotivated from the agent's side.
