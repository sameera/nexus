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

## 2026-09-01 — Regions pair by ordinal position within their own kind

- **Choice:** The comparison pairs the before copy's Nth fenced block with the after copy's Nth fenced block, and reports a surplus on either side as added or removed.
- **Why:** A single inserted region would otherwise shift every later pair and turn one edit into a run of findings naming the wrong lines.
- **Refuted alternative:** A longest-common-subsequence alignment over regions, which survives insertion better — but the extra machinery buys nothing for a check whose passing case is "nothing moved at all".

## 2026-09-01 — A criteria line is recognised by emphasis or by all three keywords

- **Choice:** A Given/When/Then line is a line carrying `**Given**`, `**When**` or `**Then**`, or one carrying all three keywords as standalone words.
- **Why:** The emphasised form is the template shape, and the all-three test catches a plainly written criterion without locking ordinary prose that merely says "given".
- **Refuted alternative:** Match any standalone `Given` — simpler, but it would freeze narrative sentences and make the translator unable to do its job on them.

## 2026-09-01 — The convention names a `translate <file>` marker the phases point at

- **Choice:** The resident block defines one marker, and each phase that needs a translation writes two lines naming the file and the moment.
- **Why:** It keeps the mechanics — the pre-copy, the agent, the check, the stop-on-failure rule — stated once, so a command with three translation points still spends about thirteen lines in total.
- **Refuted alternative:** State the full mechanics at each phase, which reads better in place but multiplies the resident cost by the number of translation points and would breach the fifteen-line cap on the epic command.
