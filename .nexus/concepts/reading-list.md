---
title: "Epic Reading List"
aliases: ["reading list", "list builder", "overflow page", "pages-read sentence", "declared change", "concept departure"]
touches: ["epic-approval-gate", "decision-record", "conformance-gate", "grep-native-retrieval", "distiller", "pr-verdict-answers"]
last_updated_by: "#896"
status: active
verification: verified
---

# Epic Reading List

An epic carries a reading list: the concept pages that planning and conformance must read. The epic stage proposes it, the reviewer approves it at the digest, and it travels with the epic issue. The record stage designs against the listed pages, and the conformance gate checks code against their invariants.

## How It Works

The epic stage builds the list without a model. A page is a direct match when its title or an alias appears in the epic's text as a whole phrase. The neighbours those pages name follow, one step only, those named by more matches first. Archived and deprecated pages are never proposed. Seven pages is the most a list holds. Pages beyond seven are offered unticked at the digest, and the reviewer's one typed selection flips pages like stories. The approved list rides the epic issue's hidden metadata block and returns unchanged when the epic is rebuilt. An absent list reads as empty. The record stage gives the architect each listed page whole and names any page it cannot find. Its Concept-store changes section opens by saying which pages were read, then lists declared changes. Each declared change names a page, quotes one current statement exactly, and gives its replacement. The gate checks each listed invariant against the page as it stood before the change, and skips those a declared change covers.

## Key Invariants

1. A list holds at most seven pages, both as proposed and after the reviewer's selection.
2. The same input over the same store gives the same list in the same order. No model judges relevance.
3. The list names pages to read, never pages to write. It never decides what a drain writes, and no page text is copied onto an issue.
4. A listed page that is missing or inactive is named, and the run continues without it.
5. A record whose declared change quotes text that is not on the named page is not filed. The decision it cites states the reversed reasoning as its trade-off.
6. Invariants are checked as the page stood before the change, so a pull request cannot edit what it is checked against.
7. An uncovered contradiction is a departure at severity high, and it blocks close until answered. With an empty list, the report says no concept invariants were checked.

## Integration Points

- [epic-approval-gate](epic-approval-gate.md) — shows the proposed list in its digest selection and files the approved one.
- [decision-record](decision-record.md) — the record designed against the listed pages, with declared changes at approval.
- [conformance-gate](conformance-gate.md) — checks the listed pages' invariants and reports a contradiction as a departure.
- [grep-native-retrieval](grep-native-retrieval.md) — the retrieval model the list follows: matched pages first, then neighbours, seven in all.
- [distiller](distiller.md) — never reads the list; it infers its own concept mapping.
- [pr-verdict-answers](pr-verdict-answers.md) — numbers and answers a concept departure like any other.

## Decision Log

### 2026-10-09 — #896 — Planning and conformance read the concept store
The distiller wrote a page for every concept a closed epic touched, but no later stage read the pages. An architect could propose again an alternative a past epic rejected. The list is now built by a fixed phrase match and capped at seven pages. The reviewer corrects it at the digest. The conformance gate reads the listed invariants at the base of the change. Refuted alternative: let the epic-stage model judge relevance from page frontmatter. It would match paraphrase, but the list would differ between runs and could not be tested.
