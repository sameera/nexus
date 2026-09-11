---
title: "Close Record: Concepts are extracted per story, and every slice is marked learner or handoff"
epic: "#456"
feature: "Roadmap-Driven Learning"
date: 2026-09-11
nexus_version: 0.31.0
analyze: ran 2026-09-11 @ 1abd4d95fdc7847307d9c5c798b337ee3fea716f
record: "#550"
record_hash: 8220f3a4a63509037c603b4c9a0f8186b56bdcfb5df522fb174bf8241cba1c43
range:
  - repo: github.com/sameera/nexus
    base: c85845f0e40a0c511c1ea95553a77c760a6c256d
    head: d01de2be8dc234aef8fe3d5924a5b588d5468760
---

# Close Record: Concepts are extracted per story, and every slice is marked learner or handoff

## Key Decisions

- **The assumed-concept field is named `assumes`, beside the shipped `concepts`.** It reads as the
  complement of the shipped field's "introduced here" meaning without renaming `concepts`, which
  record #469 fixed. Refuted alternative: `assumed_concepts`, matching the plan's snake_case compound
  keys — longer, and nothing else in a slice qualifies `concepts` with its role.

- **The draft materializes as `plan-draft.yml` beside the resolved roadmap, replaced by rename.**
  The roadmap's own derived directory is already gitignored and keyed on the roadmap name, and a
  write-then-rename is the one-step whole replacement invariant 23 asks for. Refuted alternative: a
  `plan.yml` under the workbook folder carrying a draft flag — it would sit in the committed tree,
  which the record's decision 1 refused.

- **The extraction subagent is its own declared agent component, granted Bash only.**
  `components/agents/nxs-concept-extractor.md` reads its story through `nexus workbook extract
  --story` and hands back that verb's checked output. A declared agent holds its inputs to what
  invariants 2, 4 and 27 allow. Refuted alternative: a general-purpose subagent prompted from the
  command body — no new component, but nothing in it bounds what the subagent reads.

- **The merge file names every proposed identifier in exactly one group, singletons included.**
  Decision 4 refuses an unmapped identifier, and an explicit singleton shows the planning session
  looked at an identifier rather than skipped it. Refuted alternative: list only the groups that
  combine names and map every other identifier to itself — shorter, but a missed synonym and a
  deliberate singleton would read the same.

- **A concept a merge leaves both introduced and assumed by one story stays introduced.** The story
  teaches it, and a stub listing one concept in both is refused by the contract. Refuted
  alternative: refuse the merge — it would reject a correct synonym merge over a contradiction the
  merge itself created.

- **Verdict reasons are filed under a new `focus-verdicts` learner-record kind, not kept in the
  checked list.** Invariant 16 makes a saved reason a personal record, and the derived `.nexus/tmp`
  store is gitignored but is not the guarded learner write. Refuted alternative: discard the reason
  after the check — simplest, but the #458 reviewer would lose the one line saying why a slice was
  handed off.

- **A verdict offered on a whole-roadmap list is refused, not ignored.** Invariant 12 says no verdict
  is requested, and a strict shape keeps story text from smuggling a mark into the list. Refuted
  alternative: accept and drop the verdict — more forgiving of a subagent, but a field the check
  tolerates is a field story text can reach.

- **A handoff stub omits the concept keys rather than writing empty lists.** Invariant 19 says the
  stub carries its story and mark only, and an empty `concepts: []` on the page reads as "teaches
  nothing yet" instead of "teaches nothing". Refuted alternative: write `concepts: []` and
  `assumes: []` on every stub for one uniform shape — simpler for a reader, but the handoff stub
  would carry fields the record says it has none of.

## Deviation Rationale

- **Invariant 9 holds through an alias map, not by rewriting the checked lists (record #550,
  invariant 9 — supersedes it):** the invariant says a concept carries one identifier in every list
  that names it. `applyMerge` maps identifiers onto stubs only; each story's checked list keeps the
  name its own subagent proposed, and the draft's `vocabulary[].aliases` leads from a proposed name
  to the merged one. Rewriting a checked list would invalidate the story-text digest each list is
  kept against (decision 8), forcing a re-extraction on every merge. The alias joins a handed-off
  story's list to the merged identifier without touching that cache. Analyze flagged the
  alias-less form high at `4baf8db`; the fix at `1abd4d9` added aliases rather than rewriting lists.

- **Invariants 2 and 4 are held by the extractor's prompt, not by its tool grant (record #550,
  invariants 2 and 4):** the agent declares `tools: Bash`, which bounds nothing it reads; only its
  body keeps it to one story. No tool grant expresses "one story of one roadmap", and a declared
  agent with a narrow prompt was judged tighter than the general-purpose subagent the record's
  decision 3 refuted for the same reason.

- **The extract verb deletes the subagent's proposal file once it has been read (record #550,
  invariant 16):** the record's six-step approach names no proposal file and no removal. The
  proposal carries the verdict reason, which invariant 16 makes a personal record, so deleting it
  leaves the guarded learner-folder write as the only place a reason is kept. Removal is scoped to
  files under the roadmap's `extractions/` directory; any other path is the caller's file and is
  left alone.

- **The record's sequence-mismatch risk was resolved by build order, not in the issue graph (record
  #550, third ADDRESS risk):** the risk required adding #546 to #547's `blocked_by`, or holding
  #547's second criterion. The graph still reads `#547 | #545`; the commits built #546 before #547
  instead. One pull request carried all four stories in dependency order, so the graph edge would
  have constrained nothing the commit order did not already.

## Waived Stories

none

## Deferred Scope

none — every item in the epic's Out of Scope section is already a filed, planned issue: #457
(ordering, splitting, scaffolds, coverage), #458 (the approval gate and home page) and #459
(pinning a stub's sources).

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-09-11-an-invariant-satisfiable-two-ways.md`
