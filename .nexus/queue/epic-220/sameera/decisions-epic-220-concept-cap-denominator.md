## 2026-08-03 — The counted region is computed by walking sections, not by slicing at a heading index

- **Choice:** Build the counted region by walking the body line by line and dropping every line inside an excluded section, rather than slicing the body at the first excluded heading.
- **Why:** Exclusion must hold wherever an excluded section sits, and a page may legally carry sections after Integration Points; a slice assumes an order the schema never fixes.
- **Refuted alternative:** Keep the existing "slice at `## Decision Log`" shape and slice twice.

## 2026-08-03 — The stale `claude-components` pin on main is re-pinned here, not filed separately

- **Choice:** The re-vendor this epic already owes (record Invariant 14) also corrects a `claude-components` pin that was already stale on main.
- **Why:** The pin is one file with one value; leaving the inherited half stale would fail the same test this epic must leave green.
- **Refuted alternative:** Re-pin only the validator entry by hand and file the drift as a bug — the pin is written whole by the vendor step, so a hand-edit is not available.
