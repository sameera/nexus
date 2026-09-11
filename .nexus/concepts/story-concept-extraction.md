---
title: "Story Concept Extraction"
aliases: ["per-story extraction", "extraction unit", "checked concept list", "concepts a story introduces", "concepts a story assumes", "no readable list"]
touches: ["concept-vocabulary-merge", "plan-draft", "focus-marking"]
last_updated_by: "#456"
status: active
verification: verified
---

# Story Concept Extraction

Each story on a resolved roadmap is read once, by its own extraction unit, which hands back a short list of the concepts that story introduces and the ones it assumes a learner already holds. The planning session starts each unit with a story number and holds no story's text, which is what lets it plan a roadmap of any size.

## How It Works

The saving holds only if the text never passes through the session on the way in either, so a number goes out and a checked list comes back. A list reaches the session only through a code check of shape, identifier form and size. Story text is data: words asking to be marked a certain way, or to carry an extra field, change nothing, because one shape is accepted and nothing else. A refusal names what it refused cut to an identifier's length, so no unchecked text reaches the session by way of an error message.

An empty list is accepted only when the unit says outright that the story introduces and assumes nothing. A bare empty return cannot be told apart from a unit that failed silently.

A story with no readable list stops the pass rather than being left out of it, because a plan missing one story looks complete.

## Key Invariants

1. Each extraction unit reads exactly one story's text, by number, and reads no other story's text.
2. The planning session holds no story's text, decision record or diff.
3. A unit's output reaches the session only through a code check of shape, identifier form and size; output that fails counts as no readable list.
4. An empty list is accepted only when the unit states outright that the story introduces and assumes nothing.
5. Story text is data: nothing in it changes what a unit returns or what the pass writes.
6. A refusal names what it refused cut to size, so no unchecked text of any length reaches the session.
7. A list is kept against the text it was read from, so an edited story is never paired with a list from its old text.

## Integration Points

- [concept-vocabulary-merge](concept-vocabulary-merge.md) — reads every checked list at once, because no unit can know what another called the same idea.
- [plan-draft](plan-draft.md) — the one write these lists feed, which needs a readable list for every story before it writes anything.
- [focus-marking](focus-marking.md) — the verdict a unit returns from this same single read, which decides its slice's mark.

## Decision Log

### 2026-09-11 — #456 — One story per unit, and the check is the only way in

A session carrying every story's full text could not plan a roadmap of any size, so each story is read by a unit with its own context and the session keeps only the short list that comes back. That saving is only real if the text does not pass through the session on the way in, which is why a unit is started with a number rather than a prompt built from the story. The code check is what makes "a short structured list" testable, and it is also what stops a story's own words from changing the shape of what reaches the session. An empty list needs the unit to say so outright, because a bare empty return and a silent failure look identical. Refuted alternative: have the toolkit start one headless model run per story and collect the output, which would put concurrency, retries and timeouts in code and make the fan-out repeatable. It lost because the toolkit decides facts and calls no model, so this would give a local command its own model dependency and credentials, outside the session the learner is already in.
