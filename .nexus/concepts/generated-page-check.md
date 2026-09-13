---
title: "Generated Page Check"
aliases: ["generated page check", "page drift check", "committed generated output", "re-render and compare", "check mode"]
touches: ["lesson-renderer", "workbook-home-page"]
last_updated_by: "#458"
status: active
verification: verified
---

# Generated Page Check

The pages a workbook renders are committed, so a reviewer meets the change that produced them rather than a build artifact nobody sees. Committed generated output has one failure mode, which is drift from the source it was generated from. A check mode answers that: it re-renders, compares bytes, and reports what changed, what is missing and what is extra.

## How It Works

A generated page in a diff looks authored, and nothing on the page itself says which lesson it has fallen behind. So the answer is not a convention asking reviewers to notice, but a command that re-runs the generation and compares the result against what is committed.

The check repairs nothing. Re-rendering stays the author's act, because a check that silently rewrote the committed pages would remove the very signal it exists to raise, and the reviewer would meet a clean tree where a stale page had been.

The report separates three findings, because they mean different things. A changed page means the lesson moved and the page did not. A missing page means a lesson has never been rendered. An extra page means a lesson was deleted or renamed and its page stayed behind.

A workbook with a teaching plan is re-rendered from the plan and the lessons together, exactly as every other render path builds it, so the home page is compared too and a plan with no lesson written yet still has something to compare. The check and the session rendering from different inputs is how the check came to report the home page as drifted after every session.

## Key Invariants

1. The check re-renders and reports drift between a committed page and the lesson it came from, and between the home page and the plan it came from.
2. The check repairs nothing, so re-rendering stays the author's to run.
3. The report distinguishes a changed page, a missing page and an extra page.
4. The check compares bytes, so it agrees exactly with what a fresh render would write.

## Integration Points

- [lesson-renderer](lesson-renderer.md) — the render this check re-runs and compares against, and the page it was split from.
- [workbook-home-page](workbook-home-page.md) — the page this check now covers, re-rendered from the committed plan and compared byte for byte.

## Decision Log

### 2026-09-07 — #407 — Split from the lesson renderer

The renderer's page reached its own-content cap when the markup refusal had to be amended, and the committed-page drift check was the half that reads independently. A task asking why a committed page no longer matches its lesson needs neither the markup rule nor the chrome rules; a task debugging a failed render needs nothing about the check. What moved is the paragraph on committed generated output and the invariant on the check mode, and the reporting detail was drawn from the same shipped behaviour. The renderer's Decision Log stays whole on the renderer, and this page opens with its own birth entry rather than a copy.

### 2026-09-13 — #458 — The check renders from the plan and the lessons together, so it covers the home page

The check re-rendered from the lessons alone while the session rendered from the lessons and the plan's unwritten slices. Once a home page existed, those two inputs would disagree on every run: the check would report the home page as drifted after every session, and a newly approved plan with no lesson yet would have no page for the check to compare at all. Every render path now builds its inputs the same way, from the committed plan and the lessons the workbook holds, and a workbook with a plan renders even before its first lesson is written. A workbook with no plan still renders its lessons alone, unchanged. This entry also records the reciprocal link from workbook-home-page.
