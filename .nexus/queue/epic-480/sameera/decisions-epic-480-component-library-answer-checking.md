## 2026-09-13 — Checkable answer pairs with its expected copy by position in the widget
- **Choice:** The n-th `[data-check]` in a widget compares against the n-th `[data-expected]` in the same widget.
- **Why:** Components render from data alone and cannot mint page-unique ids deterministically, while position is fixed at render time.
- **Refuted alternative:** Generated ids linking each check to its copy, which would need a per-page counter threaded through the seam.

## 2026-09-13 — Reveal-after-first-check is enforced by the runtime, not the render
- **Choice:** Every page show disables the reveal control of any widget holding a checkable answer; a check re-enables it.
- **Why:** Keeps the widget contract and shell unchanged (#616 chosen approach) and doubles as the back/forward-cache reset.
- **Refuted alternative:** A new contract flag making the shell render the reveal control `disabled`.

## 2026-09-13 — A control that rearranges parts signals the change with an `input` event
- **Choice:** The check clears on any `input` event inside a checkable answer; later controls dispatch one after moving parts.
- **Why:** Lets #518/#519 consume the checking unchanged instead of calling into it.
- **Refuted alternative:** Exposing a clear-result function each component's runtime calls directly.

## 2026-09-13 — Code fields are dotted paths with a `*` wildcard; the markup check reads the remaining scalars
- **Choice:** `codeFields` on the component contract; the renderer removes those values from the parsed declaration and scans every other key and scalar.
- **Why:** The trace stepper's code lives inside a list of steps, so field names alone cannot name it.
- **Refuted alternative:** Top-level field names only.

## 2026-09-13 — Checking behaviour is specified by running the shipped script in jsdom
- **Choice:** A learner fixture opens the rendered page with `JSDOM` (`runScripts: "outside-only"`), evals `workbook.js`, and traps network/storage/cookie/history access.
- **Why:** The spacing rule, gating and resets only exist when the script runs (#616 ADDRESS risk); a parsed document without a browsing context cannot focus.
- **Refuted alternative:** Running the script with `new Function` against a `DOMParser` document.

## 2026-09-13 — The Parsons shuffle guard compares lines with all whitespace removed, and rotates by one
- **Choice:** A seeded (FNV-1a of the lines) Fisher–Yates shuffle; if it equals the expected order with every whitespace character stripped, it is rotated one position; the "two distinct lines" refusal uses the same stripped comparison.
- **Why:** Stripping is stricter than the check's spacing rule, so no written shuffle can pass the check, without a second copy of the spacing rule in TypeScript; a rotation of a sequence with two distinct items always differs.
- **Refuted alternative:** Re-implementing the runtime spacing rule at render time, or re-seeding until the shuffle differs.

## 2026-09-13 — A Parsons line moves with a pair of native buttons that stay put at the ends
- **Choice:** "Earlier"/"Later" buttons on every line, a no-op at the first/last position, focus returned to the pressed control, position announced in a polite live region.
- **Why:** Native buttons are keyboard, touch and pointer operable with no extra handling, and never-disabled controls keep focus from falling off a line that reaches an end.
- **Refuted alternative:** Disabling the control at the ends.

## 2026-09-13 — A trace question belongs to the step it asks about and shows while the learner is one step before it
- **Choice:** `steps[k].question` gates the move from step k-1 to step k; only that one question is visible, and it hides once the step is taken.
- **Why:** Matches #616 (the step's state stays hidden until its question is checked) with one visible question at a time and no computed state.
- **Refuted alternative:** Keeping every passed question and its result visible beneath the snippet.

## 2026-09-13 — Trace step lines must be integer line numbers; a missing state renders empty
- **Choice:** A non-integer, zero or out-of-range `line` fails the render; `state` is not required.
- **Why:** #616 lists exactly which trace declarations fail the render, and a blank state still yields a checkable exercise.
- **Refuted alternative:** Also refusing a step with no state.
