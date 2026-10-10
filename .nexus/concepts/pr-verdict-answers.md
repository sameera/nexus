---
title: "Pull-Request Verdict Answers"
aliases: ["verdict item IDs", "departure ID", "item registry", "answer line", "accepted departure", "waived finding", "approved deferred scope", "open-item counts"]
touches: ["conformance-gate", "published-verdict-selection", "pr-driven-flow", "reading-list", "answer-recording-run"]
last_updated_by: "#896"
status: active
verification: verified
---

# Pull-Request Verdict Answers

Every departure, finding and deferred-scope proposal a pull request's verdict lists carries an ID, and an engineer answers one with a single fixed line in a pull-request comment. The toolkit numbers the items and applies the answers; the model does neither. A later analyze run records the answers without judging unchanged code again.

## How It Works

The items sit in a second machine block on the verdict, which is also the ID registry. The next run on the same pull request reads it from that pull request's newest trusted verdict. A departure found again keeps its ID when it cites the same record element or the same concept invariant and shares a file. A new item takes the next unused number, because every number ever issued stays in the registry.

An answer line names the ID, a verb and a reason. A departure is accepted, a critical or high finding is waived, and a deferred-scope proposal is approved. Answers are read in the same comment pass as close's waivers, under the same trust rule. When several trusted, well-formed answers name one item, the newest wins.

## Key Invariants

1. A departure is accepted only by a trusted comment that names its ID, or by a record revision. A decision stub explains a departure and never accepts it.
2. On one pull request an ID never names two items.
3. An item a later run does not find again is listed as no longer found, with its answer, and is never dropped.
4. An answer from an untrusted author, with an unknown ID, with a verb that does not fit the item, or without a required reason is named in the verdict and applies nothing.
5. The severity counts include only open items, so an answered item blocks neither the merge pre-check nor close.

## Integration Points

- [conformance-gate](conformance-gate.md) — the gate whose departures and findings these IDs name, and whose blocking counts the answers reduce.
- [published-verdict-selection](published-verdict-selection.md) — picks the newest trusted verdict, which this registry reads its IDs and earlier answers from.
- [pr-driven-flow](pr-driven-flow.md) — the flow in which the engineer answers on the open pull request, before the merge.
- [reading-list](reading-list.md) — a departure from a listed page's invariant is numbered and answered like any other.
- [answer-recording-run](answer-recording-run.md) — the later run that records these answers and decides what to judge again; split from this page.

## Decision Log

### 2026-10-04 — #829 — The engineer answers each item on the pull request, by an ID the toolkit assigns

Close used to ask the lead, after the merge, why the code departs from the decision record, when the engineer who made each choice had moved on. Analyze now names each departure before the merge, and the engineer answers it on the pull request. An ID must survive a re-run and an answer must survive a moved head, so the toolkit numbers items against the registry in the newest trusted verdict, rather than trusting a model to number the same way twice. An answer is one fixed line read by the same reader as close's waivers, which keeps the trust boundary in one place. The answer-recording run also judges in full on an unchanged head when the epic-level state changed or the earlier verdict recorded no results. That departs from the record's promise that an unchanged head reads no code, and it was accepted on the pull request as DV3: a pull request that has become the one completing the epic must have its success metrics judged. Refuted alternatives: IDs hashed from each item's content, which nobody can type and which collide inside one file; and a resolved thread or a reaction counted as the answer, which carries no reason.

### 2026-10-06 — #875 — An unattended round is judged by its answer lines, and the registry is read from the pull request's repository

The unattended implement run first compared which comments held an answer line. An answer edited into a comment that already held one left the set of comments unchanged, so the run did not stop and the answer counted as the lead's own. The run now compares the answer lines themselves: the comment link, the ID, the verb and the reason. Trust and creation time are left out, because an edit changes neither and a trust change alone posts no answer. A line that disappears accepts nothing, so it does not stop the run. The registry read named no repository, so it asked the checkout's default repository. In any other checkout the registry read as empty and numbering restarted at DV1 and F1, which gave an existing item a new ID. It now reads the pull request from the pull request's own repository. Refuted alternatives: stopping on any comment whose update time moved, which would stop a round that edits only other text in a comment holding answers; and fingerprinting the whole answer record, which would stop on a trust change that posts nothing.

### 2026-10-09 — #896 — A concept-invariant departure keeps its ID, and the answer-recording run moves to its own page

A departure from a listed page's invariant has no record element to cite, so the page and invariant number identify it across runs. It is then numbered, answered and carried forward by the same rules as any other departure. Refuted alternative: a separate item kind, which the existing machinery would not carry across runs. The rewrite pushed the page's own content past the cap. How a later run records answers is separable from how items are numbered and answered, so it moved to the answer-recording-run page, with no change to its rules.
