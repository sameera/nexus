---
title: "Pull-Request Verdict Answers"
aliases: ["verdict item IDs", "departure ID", "item registry", "answer line", "accepted departure", "waived finding", "approved deferred scope", "answer-recording run", "open-item counts"]
touches: ["conformance-gate", "published-verdict-selection", "pr-driven-flow"]
last_updated_by: "#829"
status: active
verification: verified
---

# Pull-Request Verdict Answers

Every departure, finding and deferred-scope proposal a pull request's verdict lists carries an ID, and an engineer answers one with a single fixed line in a pull-request comment. The toolkit numbers the items and applies the answers; the model does neither. A later analyze run records the answers without judging unchanged code again.

## How It Works

The items sit in a second machine block on the verdict, which is also the ID registry. The next run on the same pull request reads it from the newest trusted verdict. A departure found again keeps its ID when it cites the same record element and shares a file. A new item takes the next unused number, because every number ever issued stays in the registry.

An answer line names the ID, a verb and a reason. A departure is accepted, a critical or high finding is waived, and a deferred-scope proposal is approved. Answers are read in the same comment pass as close's waivers, under the same trust rule. When several trusted, well-formed answers name one item, the newest wins.

The answer-recording run reads no code when the head, the record and the story set are unchanged. On a moved head it judges again only the answered departures and what the changed files affect. It compares each head's own change, so a trunk merge or a rebase changes nothing by itself. A revised record, a changed story set, a changed epic-level state, or an earlier verdict with no results makes it judge in full and say why.

## Key Invariants

1. A departure is accepted only by a trusted comment that names its ID, or by a record revision. A decision stub explains a departure and never accepts it.
2. On one pull request an ID never names two items.
3. An item a later run does not find again is listed as no longer found, with its answer, and is never dropped.
4. An answer from an untrusted author, with an unknown ID, with a verb that does not fit the item, or without a required reason is named in the verdict and applies nothing.
5. The severity counts include only open items, so an answered item blocks neither the merge pre-check nor close.
6. An unattended implement run never posts an answer, and it stops when a fix round posts one.

## Integration Points

- [conformance-gate](conformance-gate.md) — the gate whose departures and findings these IDs name, and whose blocking counts the answers reduce.
- [published-verdict-selection](published-verdict-selection.md) — picks the newest trusted verdict, which this registry reads its IDs and earlier answers from.
- [pr-driven-flow](pr-driven-flow.md) — the flow in which the engineer answers on the open pull request, before the merge.

## Decision Log

### 2026-10-04 — #829 — The engineer answers each item on the pull request, by an ID the toolkit assigns

Close used to ask the lead, after the merge, why the code departs from the decision record, when the engineer who made each choice had moved on. Analyze now names each departure before the merge, and the engineer answers it on the pull request. An ID must survive a re-run and an answer must survive a moved head, so the toolkit numbers items against the registry in the newest trusted verdict, rather than trusting a model to number the same way twice. An answer is one fixed line read by the same reader as close's waivers, which keeps the trust boundary in one place. The answer-recording run also judges in full on an unchanged head when the epic-level state changed or the earlier verdict recorded no results. That departs from the record's promise that an unchanged head reads no code, and it was accepted on the pull request as DV3: a pull request that has become the one completing the epic must have its success metrics judged. Refuted alternatives: IDs hashed from each item's content, which nobody can type and which collide inside one file; and a resolved thread or a reaction counted as the answer, which carries no reason.
