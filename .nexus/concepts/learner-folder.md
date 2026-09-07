---
title: "Learner Folder"
aliases: ["learner store", "personal records", "one ignore rule", "learner ignore guard", "per-learner state"]
touches: ["workbook-store", "workbook-handoff", "lesson-renderer"]
last_updated_by: "#405"
status: active
verification: verified
---

# Learner Folder

Everything a workbook retains about one person lives under a single folder inside the workbook store: the concept ledger, progress, learning records, the hint log and the handoffs. One ignore rule covers that folder however many workbooks the store holds, so excluding a person's stumbles is a single line rather than an audit. Nothing writes a personal record until git confirms the target path is ignored.

## How It Works

The folder is a direct child of the store rather than of each workbook, so a second workbook needs no second ignore rule. A workbook is committed, so the team shares it, and what the workbook retains about a person would be committed by the same act. The failure is asymmetric: a missing rule commits a person's stumbles to a shared repository, and git history makes that effectively irreversible. So the guard is a question put to git rather than a text match on one ignore file. Asking git also works when the rule lives in a nested or a global ignore file, which matching text in one file would miss. The question is asked per write, not per session, because a rule removed between two writes must stop the second one. Appending to a record goes through the same guard as creating one, because a record already existing is not the answer: the rule that excluded it may have gone since. When the answer is no the write refuses and names the missing rule.

## Key Invariants

1. Every record the workbook retains about a person lives under one learner folder inside the store, and no personal record exists outside it.
2. One ignore rule covers the learner folder however many workbooks the store holds.
3. Nothing writes a personal record until git confirms the target path is ignored; when it is not ignored the write refuses and says why.
4. The check is per write. Appending to an existing record asks the same question a first write asks.
5. No learner record is an input to a lesson page.
6. A workbook checked out with an empty learner folder reads normally.

## Integration Points

- [workbook-store](workbook-store.md) — the store this folder is a direct child of, so one rule covers every workbook in it.
- [workbook-handoff](workbook-handoff.md) — handoff records are kept here, under the same rule as everything else personal.
- [lesson-renderer](lesson-renderer.md) — reads nothing from here, which is what lets an empty folder read normally.

## Decision Log

### 2026-09-07 — #405 — One learner folder, and a per-write question put to git

The folder sits directly under the store rather than inside each workbook, because the story promises one line rather than an audit, and that promise only holds if the line's coverage does not depend on how many workbooks exist. The write guard asks git instead of reading an ignore file, and it asks per write, because the rule can be removed between two writes and the second one has to stop. During implementation the resolve path was found to append outside that guard and was routed through it. Refuted alternative: a learner folder inside each workbook, matched by a wildcard ignore pattern. It keeps a workbook self-contained and movable as a unit, but wildcard patterns are the kind of rule people get subtly wrong, and one mistake commits a person's records.
