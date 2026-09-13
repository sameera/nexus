---
title: "Component Refusal"
aliases: ["declaration refusal", "code field", "codeFields", "checkable exercise refusal"]
touches: ["widget-seam", "answer-check", "parsons-problem", "trace-stepper", "lesson-renderer"]
last_updated_by: "#480"
status: active
verification: verified
---

# Component Refusal

The widget contract lets a component say why a declaration cannot become a checkable exercise, and name which of its own data fields carry code. A refusal fails the whole render exactly as an unknown component name already does. A named code field's value is exempt from the lesson renderer's markup check, because the component itself escapes and shows that value as code.

## How It Works

A component's refusal function takes the declared data and returns why it cannot make an exercise, or nothing when it can: an empty expected answer, too few distinct lines to reorder, a step naming a line the snippet does not have. A refusal fails the whole render, naming the reason, exactly as an unknown component name already does — an exercise with a hole in its expected answer would otherwise tell every learner they are wrong. A component separately names its code-bearing fields as dotted paths, with a `*` wildcard matching every item of a list or every key of a map, because a field carrying code can sit nested inside a structure, such as a step inside a stepper's list of steps. The lesson renderer's markup check reads a widget declaration as markup-bearing content by default; a declared code field's value is removed from what the check reads, and every other key and scalar in the declaration is still read and still checked.

## Key Invariants

1. A component's refusal function returns why a declaration cannot make an exercise, or nothing when it can.
2. A refusal fails the whole render, naming the reason, exactly as an unknown component name does.
3. A component names its code-bearing fields as dotted paths; a `*` wildcard matches every item of a list or every key of a map.
4. A named code field's value is exempt from the lesson renderer's markup check.
5. Every other key and scalar in a declaration is still read by the markup check.

## Integration Points

- [widget-seam](widget-seam.md) — the component contract this extends; an unknown component name fails the render the same way a refusal does.
- [answer-check](answer-check.md) — the mechanism the three components below use refusal to protect: an exercise with nothing to check against.
- [parsons-problem](parsons-problem.md) — refuses a declaration naming fewer than two distinct lines.
- [trace-stepper](trace-stepper.md) — refuses a step naming a line the snippet does not have, or a question with no expected answer.
- [lesson-renderer](lesson-renderer.md) — the markup check whose code-field values this exempts.

## Decision Log

### 2026-09-13 — #480 — Split from widget-seam: a component may refuse a declaration and name its own code fields

Three more components ask the learner for an answer, and each can be declared with nothing to check against: a signature with no expected text, a Parsons list with fewer than two distinct lines, a trace step naming a line the snippet does not have. The seam already had one failure mode, an unknown component name, so a hollow declaration was given the same one rather than a second contract shape: a component may now say why it cannot check a declaration, and that failure takes down the whole render exactly as an unknown name does. Refuted alternative: leaving each component to throw its own error, which would give every future component its own way of failing instead of the one the seam already has. Separately, a component's code, such as a trace snippet or an expected signature, reads like markup to the lesson renderer's own markup check; a component now names which of its own fields carry code, as dotted paths with a `*` wildcard for a field nested inside a list or map, and the renderer skips checking only those fields' values. Refuted alternative: reading a component's code fields by convention, such as any field named `snippet` or `answer`. It needs no contract change, but it silently misreads a future component whose code lives in a differently named field, and a wrong guess there is a markup lesson would fail to catch.
