---
title: "Answer Check"
aliases: ["checkable answer", "answer checking", "spacing rule", "reveal after check", "fill-the-signature"]
touches: ["component-refusal", "parsons-problem", "trace-stepper"]
last_updated_by: "#480"
status: active
verification: verified
---

# Answer Check

A checkable answer is the one way the shared component library tells a learner whether a typed or rearranged answer is right. It compares one or more ordered parts against an expected copy already printed on the page, using a spacing-tolerant match, and it works with no network and nothing kept between page openings. Fill-the-signature, the smallest component in the library, is a checkable answer with one typed part and nothing else around it.

## How It Works

The expected copy is written into the widget's hidden, always-printed region at render time, once. A checkable answer's n-th part pairs with the n-th expected copy in the same widget, by position rather than by an id, because a component renders from data alone and cannot mint a page-unique id. A match trims leading and trailing whitespace and collapses whitespace between two word characters to one space; case, punctuation and quoting all still count. Checking states the result in words and enables the widget's reveal control, which stays disabled until a check happens. A control that rearranges an answer's parts, such as a Parsons move or a trace step, never calls into the check directly; it fires a plain `input` event, and any `input` event inside a checkable answer clears its result and disables reveal again. Every time the page is shown, on first opening, a reload, or a return through the back/forward cache, every checkable answer resets to how it was written, and every answer field opts out of the browser remembering or autofilling it.

## Key Invariants

1. A checkable answer's n-th part pairs with the n-th expected copy in the same widget, by position.
2. A match trims leading and trailing whitespace and collapses whitespace between two word characters to one space; everything else must match exactly.
3. Checking states the result in words and enables the widget's reveal control; any later input clears the result and disables reveal again.
4. A control that rearranges an answer's parts signals the change with a plain `input` event, never by calling into the check.
5. Every page show, including a back/forward-cache restore, resets every checkable answer to how it was written.
6. Every answer field opts out of the browser remembering or autofilling it.
7. The expected copy is written once, at render time, into the region print already shows.

## Integration Points

- [component-refusal](component-refusal.md) — the contract fields a checkable-answer component uses to reject a hollow declaration and exempt its code from the markup check.
- [parsons-problem](parsons-problem.md) — checks its settled line order with this mechanism, unchanged.
- [trace-stepper](trace-stepper.md) — checks a step's question with this mechanism, unchanged.

## Decision Log

### 2026-09-13 — #480 — One checking mechanism, matched by position and cleared by a plain input event

The library's first three answer-asking components share one checking mechanism rather than each growing its own, so a learner meets one way of asking to be checked and one way of being told the result. Parts pair with their expected copies by position because a component renders from data alone and cannot mint a page-unique id; the refuted alternative, generated ids linking each check to its copy, would need a per-page counter threaded through the seam. Checking enables the reveal control rather than the seam gaining a new render contract, which keeps the widget shell unchanged and lets the same disable/enable toggle double as the back/forward-cache reset. A control that rearranges parts signals the change with a plain `input` event instead of calling a clear-result function directly, which lets later components consume the checking unchanged; the refuted alternative, exposing a function each component's runtime calls, would tie every future component to this mechanism's internals rather than to one DOM event every browser already dispatches.
