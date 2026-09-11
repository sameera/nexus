---
title: "Learner Folder"
aliases: ["learner store", "personal records", "one ignore rule", "learner ignore guard", "per-learner state"]
touches: ["workbook-store", "workbook-handoff", "lesson-renderer", "cold-drill", "just-in-time-lesson", "handoff-prompt", "focus-marking"]
last_updated_by: "#456"
status: active
verification: verified
---

# Learner Folder

Everything a workbook retains about one person lives under a single folder inside the workbook store: the concept ledger, progress, learning records, the hint log, the handoffs and why a slice was handed off. One ignore rule covers that folder however many workbooks the store holds, so excluding a person's stumbles is a single line rather than an audit. Nothing writes a personal record until git confirms the target path is ignored.

## How It Works

The folder is a direct child of the store rather than of each workbook, so a second workbook needs no second ignore rule. A workbook is committed, so the team shares it, and what the workbook retains about a person would be committed by the same act. The failure is asymmetric: a missing rule commits a person's stumbles to a shared repository, and git history makes that effectively irreversible. So the guard is a question put to git rather than a text match on one ignore file. Asking git also works when the rule lives in a nested or a global ignore file, which matching text in one file would miss. The question is asked per write, not per session, because a rule removed between two writes must stop the second one. Appending to a record goes through the same guard as creating one, because a record already existing is not the answer: the rule that excluded it may have gone since. When the answer is no the write refuses and names the missing rule.

## Key Invariants

1. Every record the workbook retains about a person lives under one learner folder inside the store, and no personal record exists outside it.
2. One ignore rule covers the learner folder however many workbooks the store holds.
3. Nothing writes a personal record until git confirms the target path is ignored; when it is not ignored the write refuses and says why.
4. The check is per write. Appending to an existing record asks the same question a first write asks.
5. No learner record is an input to a lesson page.
6. A workbook checked out with an empty learner folder reads normally.
7. A record is personal because of what it holds, not where it would land: the reason a slice was handed off is filed here, not left in derived scratch.

## Integration Points

- [workbook-store](workbook-store.md) — the store this folder is a direct child of, so one rule covers every workbook in it.
- [workbook-handoff](workbook-handoff.md) — handoff records are kept here, under the same rule as everything else personal.
- [lesson-renderer](lesson-renderer.md) — reads nothing from here, which is what lets an empty folder read normally.
- [cold-drill](cold-drill.md) — the hint counts kept here are the one personal signal that ranks an already-eligible concept.
- [just-in-time-lesson](just-in-time-lesson.md) — reads the same hint counts to decide which concepts the next lesson comes back to.
- [handoff-prompt](handoff-prompt.md) — the prompt is kept here, so it is never a page and can never appear as drift.
- [focus-marking](focus-marking.md) — files each verdict's reason here, so the one line saying why a slice was handed off survives for the reviewer.

## Decision Log

### 2026-09-07 — #405 — One learner folder, and a per-write question put to git

The folder sits directly under the store rather than inside each workbook, because the story promises one line rather than an audit, and that promise only holds if the line's coverage does not depend on how many workbooks exist. The write guard asks git instead of reading an ignore file, and it asks per write, because the rule can be removed between two writes and the second one has to stop. During implementation the resolve path was found to append outside that guard and was routed through it. Refuted alternative: a learner folder inside each workbook, matched by a wildcard ignore pattern. It keeps a workbook self-contained and movable as a unit, but wildcard patterns are the kind of rule people get subtly wrong, and one mistake commits a person's records.

### 2026-09-07 — #407 — Reciprocal links from the cold drill, the just-in-time lesson and the handoff prompt

The teaching session's stages read and write here, so the edges are recorded on both sides. The drill and the lesson both read the hint counts: the drill uses them to rank a concept already cold enough to ask about, and the lesson uses them to decide which concepts to come back to. The handoff prompt is written here rather than into the workbook, which is what keeps it from ever appearing as drift against the rendered lessons.

### 2026-09-11 — #456 — A handoff verdict's reason is a personal record, not derived scratch

The planning pass that marks a slice records one line saying why, and that line is about the learner rather than about the code, so it belongs here rather than beside the plan. The draft it was judged for is already excluded from the commit, which made leaving it there look safe — but being excluded from a commit is not what makes a record personal, and the reason would then sit outside the guard every other personal record passes. The proposal the reason arrived in is removed once it has been read, so this folder is the only place it is kept. Refuted alternative: discard the reason once the mark is set, which is simplest and keeps the pass from writing anything personal at all. It lost because the reviewer who approves the marks would then have nothing saying why a slice was handed off, which is the one thing that makes a wrong mark visible.
