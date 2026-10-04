## 2026-10-04 — The judgments block is JSON in a fence longer than any backtick run
- **Choice:** Carry departures as JSON under a `<!-- nexus:analyze-judgments -->` marker after the verdict block, with a fence longer than any backtick run in its content.
- **Why:** The deployed readers parse only the first fence after the verdict marker as flat keys, so a separate JSON block cannot overwrite a verdict key, and JSON escapes every value #862's copied answer text could carry.
- **Refuted alternative:** A nested YAML block, which needs a second parser and lets copied text break the structure.

## 2026-10-04 — The toolkit numbers departures, not the model
- **Choice:** `nexus verdict-items` reads the newest trusted verdict as the registry and assigns DV IDs and severity from a model-written draft; a match is the same cited element plus a shared file, best file overlap first, lowest number on a tie.
- **Why:** G6 needs the same ID on a re-run, and a model asked to number the same way twice will not.
- **Refuted alternative:** Have the model reuse IDs it reads from the last verdict, which makes ID stability depend on prose.

## 2026-10-04 — Every number ever issued stays in the registry
- **Choice:** A departure not found again stays listed with `found: false` whether or not it was answered, and gets its ID back if found later.
- **Why:** Keeping the full list is what makes "next unused number" never reuse one (G7) without a separate high-water key.
- **Refuted alternative:** Keep only answered ones (G8's minimum) plus a counter key, which adds a second fact that can disagree with the list.

## 2026-10-04 — The publish check requires the judgments block on every verdict
- **Choice:** `verdict-check` refuses a body with no judgments block, a misplaced or unreadable one, or severity counts lower than its unanswered departures.
- **Why:** A verdict published without the block would reset the registry and let an ID name two items; the count check makes G14's blocking deterministic at the one publish boundary.
- **Refuted alternative:** Accept a missing block as "no departures", which silently restarts numbering.
