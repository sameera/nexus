## 2026-09-18 — Reference page names use a `ref--` prefix the render reserves
- **Choice:** A reference page renders to `ref--<concept-slug>.html` beside the lessons, and the render refuses any lesson whose page name starts with `ref--`.
- **Why:** Invariant 17 needs the page beside the shared stylesheet and script, and a lesson file can take any name, so only a refused prefix keeps the two apart.
- **Refuted alternative:** A `reference/` output subfolder, which needs a second asset path and collides with the authored `reference/` folder's name.

## 2026-09-18 — A reference file declares its concept as a single `concept` string
- **Choice:** The authored file's front matter carries `concept: <name>`; anything else, a list included, is refused as naming other than one concept. The page title is derived from the concept.
- **Why:** One scalar field makes "exactly one concept" a type check rather than a count over a list.
- **Refuted alternative:** Reusing the lessons' `concepts:` list and refusing lengths other than one.

## 2026-09-18 — The print fixture treats controls, live regions and navigation as droppable
- **Choice:** `printPage().withheld()` checks every element carrying content under the rules in force when printing (plain rules plus print rules), and skips buttons, form fields, `[aria-live]` regions and `nav`.
- **Why:** Invariant 15 lets print drop controls and chrome; a control's label or a stepper's position readout is not content.
- **Refuted alternative:** Checking only the print block, which misses the screen rule `overflow-x: auto` that was the live clipping vector.

## 2026-09-18 — On paper a code block wraps rather than scrolls
- **Choice:** The print block sets `.lesson pre { overflow-x: visible; white-space: pre-wrap; overflow-wrap: anywhere; }`.
- **Why:** Paper cannot scroll, so a visible overflow alone would still run a long line off the sheet.
- **Refuted alternative:** `overflow-x: visible` alone, which removes the clip but loses the line's end past the margin.
