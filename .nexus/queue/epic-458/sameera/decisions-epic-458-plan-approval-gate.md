## 2026-09-12 — A slice is remembered through its lesson file
- **Choice:** `resolveArrival` matches written lessons to slices by lesson file name, and `open` carries the slice rather than a story number.
- **Why:** The plan's uniqueness rule is already keyed on the lesson, and a scaffold has no story to key on.
- **Refuted alternative:** A story-plus-part key on `StagedLesson`, which still needs a second rule for scaffolds.

## 2026-09-12 — A plan-wide epic survives only as the default for older plans
- **Choice:** Each story slice reads its own `epic`; a plan-wide `epic` is used only when a slice records none.
- **Why:** Hand-written single-epic plans keep reading, while every approved plan records the epic per slice.
- **Refuted alternative:** Refuse any slice without its own epic, which breaks every shipped single-epic plan.
