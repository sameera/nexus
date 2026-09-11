## 2026-09-11 — The assumed-concept field is named `assumes`
- **Choice:** A stub's new field is `assumes`, a plain identifier list beside the shipped `concepts`.
- **Why:** It reads as the complement of the shipped field's "introduced here" meaning without renaming `concepts`, which record #469 fixed.
- **Refuted alternative:** `assumed_concepts`, matching the plan's snake_case compound keys — longer, and nothing else in a slice qualifies `concepts` with its role.

## 2026-09-11 — The draft is `plan-draft.yml` beside `roadmap.json`, replaced by rename
- **Choice:** The draft materializes at `.nexus/tmp/roadmap-<name>/plan-draft.yml`, validated whole and landed by write-then-rename.
- **Why:** The roadmap's own derived directory is already gitignored and keyed on the roadmap name, and a rename is the one-step replacement invariant 23 asks for.
- **Refuted alternative:** A `plan.yml` under the workbook folder with a draft flag — it would sit in the committed tree, which decision 1 refused.

## 2026-09-11 — A merge names every identifier, singletons included
- **Choice:** The merge file lists every proposed identifier in exactly one group, kept identifier first; an identifier in no group is refused.
- **Why:** Decision 4 refuses an unmapped identifier, and an explicit singleton shows the session looked at it rather than skipped it.
- **Refuted alternative:** List only the groups that combine names and map every other identifier to itself — shorter, but a missed synonym and a deliberate singleton would read the same.

## 2026-09-11 — The extraction subagent is its own agent component, with Bash only
- **Choice:** `components/agents/nxs-concept-extractor.md`, tools `Bash`, reads its story through `nexus workbook extract --story` and hands back that verb's checked output.
- **Why:** A declared agent holds its inputs and tools to what invariants 2, 4 and 27 allow, where a general-purpose subagent could read the roadmap file whole or load any reference.
- **Refuted alternative:** A general-purpose subagent prompted from the command body — no new component, but nothing in it bounds what the subagent reads.

## 2026-09-11 — A merged concept both introduced and assumed by one story stays introduced
- **Choice:** After the merge maps two proposals onto one identifier, a story introducing either keeps it in `concepts` and drops it from `assumes`.
- **Why:** The story teaches it, and a stub listing one concept in both is refused by the contract.
- **Refuted alternative:** Refuse the merge — it would reject a correct synonym merge over a contradiction the merge itself created.

## 2026-09-11 — Verdict reasons go to a `focus-verdicts` learner record, not the checked list
- **Choice:** A list's `serves` stays in the derived checked list; its `reason` is filed per roadmap under a new `focus-verdicts` learner-folder kind.
- **Why:** Invariant 16 makes a saved reason a personal record, and the derived `.nexus/tmp` store is ignored but not the guarded learner write.
- **Refuted alternative:** Discard the reason after the check — simplest, but the #458 reviewer would lose the one line saying why a slice was handed off.

## 2026-09-11 — A verdict on a whole-roadmap list is refused, not ignored
- **Choice:** When the interview puts the whole roadmap in focus, a list carrying `serves` or `reason` fails the check.
- **Why:** Invariant 12 says no verdict is requested, and a strict shape keeps story text from smuggling a mark into the list.
- **Refuted alternative:** Accept and drop the verdict — more forgiving of a subagent, but a field the check tolerates is a field story text can reach.

## 2026-09-11 — A handoff stub omits the concept keys rather than writing empty lists
- **Choice:** The draft renders a handoff slice as `story` and `builds` only; in memory its `concepts` and `assumes` are empty, and a handoff offered any concept is refused.
- **Why:** Invariant 19 says the stub carries its story and mark only, and an empty `concepts: []` on the page reads as "teaches nothing yet" instead of "teaches nothing".
- **Refuted alternative:** Write `concepts: []` and `assumes: []` on every stub for one uniform shape — simpler for a reader, but the handoff stub would carry fields the record says it has none of.
