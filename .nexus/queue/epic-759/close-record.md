---
title: "Close Record: The Razor Check Reads a Decision Record as a Decision Record"
epic: #759
feature: "Scope Discipline"
date: 2026-09-21
nexus_version: 0.69.0
analyze: ran 2026-09-21 @ e3648f1241889b6a50ac84091add168a4e2884f2
range:
  - repo: github.com/sameera/nexus
    base: b33462f510fe1ed141237108d9b9f43d7dea25ff
    head: f1adef7297bf589da958d74b9a345a83aa10d0d3
---

# Close Record: The Razor Check Reads a Decision Record as a Decision Record

## Key Decisions

- **The one story-heading definition stays in `ordering.ts` and gains a caller.** The ordering check already owned the match that answers "which stories does this draft declare", and the epic said to adopt that definition rather than invent a second one. So the file that owned it exports the heading-level half as `storyHeadingTitle`, and the story check asks it. Refuted alternative: a new module holding the definition both checks import. A competent engineer would reach for it to avoid one checker depending on another's file. It loses because neither check is the other's dependency today, and it buys a third file for one regular expression.

- **The shared match dropped its heading marker, rather than the caller re-adding one.** The two callers see different text: the story check walks sections and receives a heading with `### ` already stripped, while the ordering check reads raw lines. The regular expression required the marker, so one definition could not serve both. It now matches the heading's text, and the line-reading caller strips the marker first. Refuted alternative: keep the marker in the pattern and have the story check prepend `### ` before asking. It loses because it makes a caller reconstruct a shape the parser it just used had already removed, which is the kind of quiet re-assembly that goes wrong when a third caller appears.

- **Stories that declare no story raise nothing, rather than raising a different finding.** The check skips a third-level heading that does not name a story instead of reporting it as unrecognised. This is the same answer the ordering check already gave, for the same stated reason: four stages share this checker, and a draft that declares no story is not an epic draft.

## Deviation Rationale

None. The shipped code is the approach the epic stated: the story check adopts the story definition the ordering check already used. Nothing in the diff relaxes or works around what the epic scoped, and this epic has no decision record to deviate from — it closed at S complexity, below the threshold that warrants one.

## Deferred Scope

Deferred items filed as epic stub issues:

- #762 — Every reader that decides whether a heading names a story asks the same definition, and a check pins that so the readers cannot drift apart again.

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-09-21-one-definition-claimed-is-not-one-definition-held.md`
