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

## 2026-10-04 — Answer lines are read in the same comment pass as waivers
- **Choice:** `readPrWaivers` reads every comment once and returns both its waiver blocks and its answer lines (`answers`), with the same author, link, time and trust fields; `parseAnswerLines` skips any body carrying either verdict marker.
- **Why:** D3 forbids a second comment reader, and one `gh pr view --json comments` read keeps the trust boundary in one place.
- **Refuted alternative:** A separate `readPrAnswers` with its own `gh` call and its own trust check.

## 2026-10-04 — The ID step also applies the answers and prints the open counts
- **Choice:** `nexus verdict-items` numbers departures and findings, reads the answers, applies the newest trusted well-formed one per ID, writes the block, and prints `open` and `answers.{applied,unapplied}`.
- **Why:** Applying answers is deterministic, and the open counts must agree with the block the publish check reads.
- **Refuted alternative:** Let the stage read the comments and decide which answers apply.

## 2026-10-04 — Newest trusted well-formed answer wins; ill-formed ones are named, never revoke
- **Choice:** Validity (trust, known ID, verb fit, reason, waivable severity) is checked first; the newest valid answer per ID applies, and each invalid line is listed as unapplied even when a valid one applies.
- **Why:** G10/G11 require naming every answer that applies nothing; a malformed newer line should not silently undo an earlier valid answer.
- **Refuted alternative:** Take the newest trusted line per ID first and apply nothing if it is malformed.

## 2026-10-04 — The publish check requires counts equal to the open items
- **Choice:** `verdict-check` refuses (`counts-not-open`) any severity count that differs from the found, unanswered departures and findings, in either direction; every finding must therefore pass through the ID step.
- **Why:** G15 makes the counts open-only; an over-count would leave a waived item blocking, an under-count would hide one.
- **Refuted alternative:** Keep the under-count check only, which lets a total slip through as the count.

## 2026-10-04 — A waiver drops off a finding re-found as medium or low
- **Choice:** When a re-run finds a waived finding again at medium or low, it carries no answer.
- **Why:** G13 lets only a critical or high finding be waived; the parser refuses a waived medium/low finding.
- **Refuted alternative:** Carry the waiver forward and stop counting the finding.

## 2026-10-04 — The implement scripts detect a posted answer by comment link, not time
- **Choice:** `nexus pr-answers --urls` is read before and after each fix round; any link present only after stops the run. A failed read stops it too.
- **Why:** Comparing links avoids clock skew between the machine and the platform, and the read reuses the one reader.
- **Refuted alternative:** Filter comments by a `--since` timestamp taken on the local clock.

## 2026-10-04 — The answer-recording run's scope is a separate verb, handed back to the ID step
- **Choice:** `nexus verdict-scope` decides the mode and what to judge again and writes it to a file; `nexus verdict-items --scope <file>` carries the rest forward and applies the answers, refusing a scope whose verdict is no longer the newest (`scope-stale`).
- **Why:** The stage must know the mode before it reads any code, and the merge must use exactly the scope that was computed.
- **Refuted alternative:** One verb that decides and merges in a single call, which would need the re-judged draft before the stage knows what to judge.

## 2026-10-04 — A change in the epic-level state forces a full run
- **Choice:** The judgments block records the run's `epicLevel`; a `--resolve` run whose Phase 0.7 answer differs (or the earlier one is unrecorded) judges the whole pull request again.
- **Why:** A pull request that became the completing one must have its success metrics judged (G30), and carrying the earlier results forward would skip them.
- **Refuted alternative:** Treat only the story set as the trigger, as D8 lists, and let a sibling's merge go unjudged until the next full run.

## 2026-10-04 — A verdict with judgments but no results makes a `--resolve` run full, even on the same head
- **Choice:** A judgments block with no `results` list reads as `results-unrecorded`, and the run judges in full.
- **Why:** G24 needs every verdict to carry every result; one that recorded none cannot pass them on.
- **Refuted alternative:** Carry the empty result set forward on an unchanged head, publishing a verdict with no criterion results.

## 2026-10-04 — Own change is measured from the pull request's current base for both heads
- **Choice:** `compareOwnChange` diffs `<base>...<earlierHead>` against `<base>...<head>` with the base `nexus pr-worktree open` printed, normalized as the landed check does, leaving out every pipeline store.
- **Why:** The three-dot form resolves to each head's own fork point, so a trunk merge or rebase changes nothing by itself (G20), reusing #849 D4's patch normalization.
- **Refuted alternative:** Diff the two heads directly, which marks every file trunk changed after a merge.
