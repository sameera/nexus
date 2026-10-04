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

## 2026-10-04 — The completion check and the epic-number redirect are toolkit verbs
- **Choice:** `nexus epic-verdicts completion` decides whether a pull request completes its epic, checks each merged sibling's containment and lists its landed files; `nexus epic-verdicts pr-target` answers where an epic-number run goes. Both reuse close's claiming read, checkout lookup, derivation and trunk check unchanged.
- **Why:** D9 needs analyze and close to agree on what shipped, and a deterministic answer keeps a failed read from being read as "not last" (G34).
- **Refuted alternative:** Have the stage read each story's pull requests with `gh` and reason about completeness in prose.

## 2026-10-04 — A sibling the head cannot be checked against is "not run", never a stop
- **Choice:** A member with no checkout, a merge commit the platform does not report, or an unreadable git answer each becomes a not-run cause with its remedy, not a stopped run; a sibling whose range cannot be derived is still judged, with its files named as unreadable.
- **Why:** D10 names a blocking finding as the outcome when containment fails, and only the claiming read (D9) stops the run.
- **Refuted alternative:** Stop the run on a missing member checkout, as close's range derivation does.

## 2026-10-04 — With a story merged and no completing pull request open, the redirect names no target
- **Choice:** `pr-target` returns `redirect` with `target: null`, says which stories have not merged and lists the open pull requests, and analyze still combines nothing.
- **Why:** D11 runs the local check only when no story has merged; otherwise there is no pull request it may name as completing the epic yet.
- **Refuted alternative:** Fall back to the ordinary local check in that case.

## 2026-10-04 — The local run keeps its success-metric rule
- **Choice:** Met / not moved / unverifiable applies to the epic-level judgment on a pull request; a local run keeps its measurable/plausibly-moved rule with the medium finding.
- **Why:** D10 scopes the three outcomes to the completing pull request, and #863 reshapes the local run next.
- **Refuted alternative:** Apply the three outcomes to local runs too, which changes what the implement loop blocks on.

## 2026-10-04 — The ledger gate goes with the combined change set
- **Choice:** `ledgerCloseGate` and its types are removed from close-ledger.ts; only `sumLedgerFindings`, which the derivation close still calls, stays.
- **Why:** The combined change set was its last caller, and its own comment named #829 as the removal point.
- **Refuted alternative:** Keep it as unused code until #830.
