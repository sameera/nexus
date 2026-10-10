---
title: "Answer-Recording Run"
aliases: ["answer-recording run", "judge in full"]
touches: ["pr-verdict-answers"]
last_updated_by: "#896"
status: active
verification: verified
---

# Answer-Recording Run

An analyze run on a pull request that already has a verdict records the engineers' answers. It judges code again only where the change since the last verdict requires it.

## How It Works

The answer-recording run reads no code when the head, the record and the story set are unchanged. On a moved head it judges again only the answered departures and what the changed files affect. It compares each head's own change, so a trunk merge or a rebase changes nothing by itself. A revised record, a changed story set, a changed epic-level state, or an earlier verdict with no results makes it judge in full and say why.

## Key Invariants

1. With the head, the record and the story set unchanged, the run reads no code.
2. A trunk merge or a rebase alone never makes the run judge again.
3. A revised record, a changed story set, a changed epic-level state, or an earlier verdict with no results makes it judge in full, and it says why.
4. An unattended implement run never posts an answer, and it stops when a fix round adds or changes one.

## Integration Points

- [pr-verdict-answers](pr-verdict-answers.md) — the item IDs and answer lines this run reads and records.

## Decision Log

### 2026-10-09 — #896 — Split from pr-verdict-answers
The verdict-answers page passed its own-content cap when a concept invariant became a way to identify a departure. How a later run records answers is separate from how items are numbered and answered, so each half loads on its own. The text moved without change, and the numbering and answer rules stay on the original. Refuted alternative: drop the unattended-run rule to fit, which would lose the rule that a fix round never answers its own departure.
