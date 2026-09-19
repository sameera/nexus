---
title: "Handoff Prompt"
aliases: ["fenced brief", "coding agent handoff", "sibling slices to leave alone", "quoted story text", "prompt fence", "slice not the learner's to build"]
touches: ["teaching-session", "workbook-handoff", "teaching-plan", "learner-folder", "focus-marking"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Handoff Prompt

Handoff Prompt is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

## How It Works

Nothing here asserts the concept any more. The teaching stage left Nexus as its own package,
and its knowledge left with it — one page, one decision log, one place it can be wrong. What
stayed is this stub, because two things still need the name. A reader who greps an old slug
gets an answer instead of silence. And the pages here that name this one keep a live edge: an
edge whose other end is gone is a dead edge, which reads as though the interaction lapsed when
in fact it only moved.

The bullets below are the interactions as they stood when the page left. They are a map to
follow, not a claim about today; the page in the teaching repository is what is current.

## Key Invariants

1. This entry asserts nothing about behaviour; the page in the teaching repository is the one that does.
2. The name keeps resolving here, so a reader who searches the old slug is told where it went.
3. Edges from pages that stayed keep resolving, so no page here carries an edge whose other end is gone.

## Integration Points

- [teaching-session](teaching-session.md) — the chain that reaches a handoff slice and writes this prompt instead of a lesson.
- [workbook-handoff](workbook-handoff.md) — the pause this prompt is written beside, recorded through the existing mechanism rather than a second one.
- [teaching-plan](teaching-plan.md) — the slice marks, the pinned story text and the sibling list the prompt is rendered from.
- [learner-folder](learner-folder.md) — where the prompt is kept, under the same rule as everything else personal.
- [focus-marking](focus-marking.md) — the planning pass that decides a slice is not the learner's to build, long before this prompt is written.

## Decision Log

### 2026-09-07 — #407 — The quotation cannot forge its own close, and every other slice is a sibling

The story's words are quoted because a number alone is not buildable, and the quotation is delimited by markers that grow until the quoted text does not contain them. A quotation whose closing marker the quoted text can write is not a quotation, since the text after it would read as the prompt's own words, and the prompt's own words are the fence. The rules come last, after the quotation closes. Sibling is read as every other slice in the plan because neither the epic nor the record defines it more narrowly, and a wrong narrower guess would leave a slice unnamed for the agent to touch. Refuted alternative: name only the slices adjacent in the dependency order. It reads more like what sibling suggests, but slices in one epic routinely share files, so an epic's slices are not isolated by adjacency.

### 2026-09-11 — #456 — Reciprocal link from focus-marking

The mark this prompt reads is now set by a planning pass, judged against the focus the learner recorded. Nothing here changed: that pass writes no sibling list of its own, leaving the rule stated here — every other slice in the plan — as the only definition, and it writes no prompt and starts no session, so a handed-off slice still reaches a coding agent only through this step.

### 2026-09-13 — #458 — The prompt names its own slice's recorded epic, and names each sibling story once

A roadmap can now span several epics, so the plan-wide epic a prompt used to state would send a coding agent to the wrong one. Every slice that builds a story records the epic that story belonged to at approval, and the prompt names that. The epic is recorded rather than looked up when the prompt is written, because the prompt is built from the plan alone with no network and two renders must give the same prompt — and the resolved roadmap that knows each story's epic is ignored by git and missing from a fresh clone. Refuted alternative: look up the story's parent epic at prompt time, which catches a story moved to another epic after approval; it lost because the prompt would need the network, two renders could differ, and the committed plan would stop being the record of what was approved. The sibling list also changed with split stories and scaffolds in the plan: it names every other story once, however many slices build it, and never a scaffold, because a scaffold builds nothing a coding agent could touch.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
