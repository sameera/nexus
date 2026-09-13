---
title: "Parsons Problem"
aliases: ["parsons problem", "shuffle guard", "line reordering exercise", "earlier later buttons"]
touches: ["answer-check", "component-refusal"]
last_updated_by: "#480"
status: active
verification: verified
---

# Parsons Problem

A Parsons problem shows the learner a function's or test's lines in shuffled order and asks them to put the lines into the order that makes it work. The learner moves lines with a pair of buttons and checks the settled order with the shared checkable-answer mechanism. The shuffle is written into the page once, so a reload and the printed page always meet the same starting order.

## How It Works

The shuffle is a seeded ordering, the seed a hash of the declared lines, so it is a fixed function of the declaration rather than of when the page happens to render. It never lands on the expected order: a comparison to the expected order, made with every whitespace character stripped, triggers a rotation by one position, and a sequence of two or more distinct lines always differs from its own rotation. Comparing with whitespace stripped is stricter than the check's own spacing rule, so no order this guard writes can ever pass the check. A learner moves a line with a pair of "earlier"/"later" buttons that stay enabled at both ends of the list, doing nothing at an end instead of disabling, so keyboard focus never falls off the puzzle. A move swaps two adjacent lines, announces the line's new position, and fires a plain `input` event, which clears any existing check without this component calling into it. A declaration naming fewer than two distinct lines fails the whole render, because no order of them can be wrong.

## Key Invariants

1. The written shuffle is a deterministic function of the declared lines; the same lesson always renders the same starting order.
2. The shuffle never equals the expected order: a rotation by one position is applied whenever a whitespace-stripped comparison would otherwise match it.
3. A move swaps two adjacent lines; no line is created, lost, or duplicated.
4. Both move controls stay enabled at every position, doing nothing at an end instead of disabling.
5. A move announces the line's new position and fires a plain `input` event, clearing any existing check.
6. A declaration naming fewer than two distinct lines fails the whole render.
7. An untouched Parsons problem prints every line and the expected order.

## Integration Points

- [answer-check](answer-check.md) — checks the settled order against the expected one, unchanged.
- [component-refusal](component-refusal.md) — fails the whole render when a declaration names fewer than two distinct lines.

## Decision Log

### 2026-09-13 — #480 — The shuffle guard strips whitespace and rotates by one; lines move with native buttons

Two decisions shape this component. The shuffle guard compares lines with all whitespace stripped and rotates the order by one position when that stripped comparison would otherwise equal the expected order; stripping is strictly tighter than the runtime's own spacing rule, so nothing that would pass the check can be produced as a starting shuffle, without a second copy of the spacing rule written in TypeScript. The refuted alternative, re-implementing the runtime's spacing rule at render time or re-seeding until the shuffle differs, would either duplicate a rule that must stay in sync in two places or make the render's output depend on how many seeds it happened to try. A line moves with a pair of native, never-disabled "earlier"/"later" buttons rather than drag-and-drop, because native buttons are keyboard, touch and pointer operable with no extra handling, and a control that stays enabled at both ends keeps focus from falling off the puzzle; the refuted alternative, drag and drop, cannot be driven from the keyboard and would still need a parallel keyboard path built alongside it.
