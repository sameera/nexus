---
title: "Close Record: The rest of the shared component library, and the answer-checking it needs"
epic: "#480"
feature: "Roadmap-Driven Learning"
date: 2026-09-13
nexus_version: 0.45.0
analyze: ran 2026-09-13 @ ab121ea6abfdfad6f426d669554f2aacc2e96a5b
record: "#616"
record_hash: 5723586238a29de3fdacdafbdf47d5ed4a3ebe9207c24001572003250ffc6c77
range:
  - repo: github.com/sameera/nexus
    base: 06b0875f3a9ba6ccecdebba056624d1e67f2b10b
    head: f1acc8776d98e4a4beb3b13ac29ee2bca434e6ff
---

# Close Record: The rest of the shared component library, and the answer-checking it needs

## Key Decisions

- **The n-th checkable answer pairs with the n-th expected copy by position, not by a generated id:** a component renders from data alone and cannot mint a page-unique id deterministically, while position is fixed at render time. Refuted: generated ids linking each check to its copy, which would need a per-page counter threaded through the seam.
- **Reveal-after-first-check is enforced by the runtime disabling the reveal control, not by a new render contract:** keeps the widget shell unchanged (matching the record's chosen approach) and the same disable/enable toggle doubles as the back/forward-cache reset. Refuted: a new contract flag making the shell render the reveal control pre-disabled.
- **A control that rearranges parts (a Parsons move, a trace step) signals the change with a plain `input` event rather than a called function:** lets #518 and #519 consume the checking unchanged instead of calling into it directly. Refuted: exposing a clear-result function each component's runtime calls.
- **Code-bearing fields are named as dotted paths with a `*` wildcard, and the markup check reads every other key and scalar:** the trace stepper's code lives inside a list of steps, so a field name alone cannot name it. Refuted: top-level field names only.
- **Checking behaviour is specified by running the shipped script in jsdom against a rendered page, never by reading the script's text:** the spacing rule, gating and resets only exist once the script runs, which is the record's ADDRESS risk on the runtime never having been tested by execution. Refuted: evaluating the script with `new Function` against a parsed document with no browsing context.
- **The Parsons shuffle guard compares lines with all whitespace stripped and rotates by one when the seeded shuffle would otherwise equal the expected order:** stripping is strictly tighter than the runtime's spacing rule, so nothing that would pass the check can be produced as a shuffle, without a second copy of the spacing rule in TypeScript. Refuted: re-implementing the runtime's spacing rule at render time, or re-seeding until the shuffle differs.
- **A Parsons line moves with a pair of native, never-disabled "earlier"/"later" buttons rather than drag-and-drop:** native buttons are keyboard, touch and pointer operable with no extra handling, and a control that stays enabled at the ends keeps focus from falling off the puzzle. Refuted: drag and drop, which cannot be driven from the keyboard and would still need a parallel keyboard path.
- **The manual real-browser restore check the record's ADDRESS risk required was run and recorded in the queue's per-user notes before analyze, not merely asserted:** reload, back/forward-cache restore (verified as an actual bfcache return via the navigation-timing API, not a fresh navigation) and autofill opt-out were each driven in headless Chromium against the shipped components.

## Deviation Rationale

None. The close-from-diff pass found no deviation from decision record #616: the shipped code implements every one of its 17 constraints and invariants as decided, including both amendments the record itself made to prior seam behaviour (interaction may now compare answers; the markup check now exempts declared code fields). The one place the record anticipated a mismatch — #519's acceptance criteria still reading "the mark moves on by one line" against the record's chosen "moves to the line the next step names" — was corrected on the story issue directly (a comment amending AC1/AC2 and the title) rather than in the shipped code, which was already conformant; see the Process Lesson.

## Deferred Scope

None.

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-09-13-component-library-answer-checking.md`
