---
title: "Handoff Prompt"
aliases: ["fenced brief", "coding agent handoff", "sibling slices to leave alone", "quoted story text", "prompt fence", "slice not the learner's to build"]
touches: ["teaching-session", "workbook-handoff", "teaching-plan", "learner-folder"]
last_updated_by: "#407"
status: active
verification: verified
---

# Handoff Prompt

A slice the plan marks as not the learner's to build is handed to a separate coding-agent session rather than taught. The session writes a prompt naming the repository, the branch, the epic, the one story to build, the sibling slices to leave alone, and the two epic-level commands not to run. It gives that prompt to the learner and pauses.

## How It Works

The two commands are named because the epic is not finished when one slice is, and an agent that closed it would end the milestone before the learner finished.

The story's own words are quoted, because a number alone is not something an agent can build from. The prompt is read by an agent that acts on what it reads, so the quotation is delimited by markers the quoted text cannot forge: they grow until they do not occur in the text they enclose. The rules are stated outside the quotation and come after it closes, so the last words the prompt says are its own. Text imitating a marker stays inside the quotation, where it restates nothing.

The words quoted are the state the plan pinned, not a live read, so the prompt needs no network and renders identically twice. It is a personal record under the learner folder and never a page, so it can never appear as drift against the rendered lessons. Every other slice in the plan is a sibling, because slices in one epic routinely share files.

## Key Invariants

1. A prompt names exactly one story to build, and also names the repository, the branch, the epic, the sibling slices to leave alone, and the two epic-level commands not to run.
2. The sibling slices are every other slice in the plan.
3. Story text quoted inside a prompt is delimited by markers the quoted text cannot forge, and no rule of the handoff is stated inside the quotation.
4. The prompt's own rules come after the quotation closes, so the last words are the prompt's own.
5. The words quoted are the state the plan pinned, so the prompt needs no network and renders identically twice.
6. A prompt is a personal record under the learner folder and never a page in the workbook.
7. A session that hands a slice off neither builds it nor teaches it.

## Integration Points

- [teaching-session](teaching-session.md) — the chain that reaches a handoff slice and writes this prompt instead of a lesson.
- [workbook-handoff](workbook-handoff.md) — the pause this prompt is written beside, recorded through the existing mechanism rather than a second one.
- [teaching-plan](teaching-plan.md) — the slice marks, the pinned story text and the sibling list the prompt is rendered from.
- [learner-folder](learner-folder.md) — where the prompt is kept, under the same rule as everything else personal.

## Decision Log

### 2026-09-07 — #407 — The quotation cannot forge its own close, and every other slice is a sibling

The story's words are quoted because a number alone is not buildable, and the quotation is delimited by markers that grow until the quoted text does not contain them. A quotation whose closing marker the quoted text can write is not a quotation, since the text after it would read as the prompt's own words, and the prompt's own words are the fence. The rules come last, after the quotation closes. Sibling is read as every other slice in the plan because neither the epic nor the record defines it more narrowly, and a wrong narrower guess would leave a slice unnamed for the agent to touch. Refuted alternative: name only the slices adjacent in the dependency order. It reads more like what sibling suggests, but slices in one epic routinely share files, so an epic's slices are not isolated by adjacency.
