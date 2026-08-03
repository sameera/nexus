## 2026-08-03 — The counted region is computed by walking sections, not by slicing at a heading index

- **Choice:** Build the counted region by walking the body line by line and dropping every line inside an excluded section, rather than slicing the body at the first excluded heading.
- **Why:** Exclusion must hold wherever an excluded section sits, and a page may legally carry sections after Integration Points; a slice assumes an order the schema never fixes.
- **Refuted alternative:** Keep the existing "slice at `## Decision Log`" shape and slice twice.

## 2026-08-03 — The stale `claude-components` pin on main is re-pinned here, not filed separately

- **Choice:** The re-vendor this epic already owes (record Invariant 14) also corrects a `claude-components` pin that was already stale on main.
- **Why:** The pin is one file with one value; leaving the inherited half stale would fail the same test this epic must leave green.
- **Refuted alternative:** Re-pin only the validator entry by hand and file the drift as a bug — the pin is written whole by the vendor step, so a hand-edit is not available.

## 2026-08-03 — Severity is an optional field whose absence means blocking

- **Choice:** A finding carries `severity: "advisory"` or nothing; absence reads as blocking, behind one predicate.
- **Why:** Every check that predates the two-severity output is blocking, so the default is the correct reading, and only a check that opts in has to say anything.
- **Refuted alternative:** A required two-valued severity on every finding — explicit at the call site, but it restates "blocking" at ~40 existing push sites and makes a new blocking check fail to compile rather than behave correctly by default.

## 2026-08-03 — The store-level trigger runs only on a full-store invocation

- **Choice:** The two revisit-trigger numbers are computed when the run scans the concepts directory itself, and skipped when the caller passes an explicit file list.
- **Why:** The drain invokes the validator with a changed-file list; computing a store-wide sum there would add a full-store pass to every drain for a number that moves by fractions of a percent.
- **Refuted alternative:** Compute it on every run regardless of the file list.
