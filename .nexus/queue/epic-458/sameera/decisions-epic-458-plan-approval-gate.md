## 2026-09-12 — A slice is remembered through its lesson file
- **Choice:** `resolveArrival` matches written lessons to slices by lesson file name, and `open` carries the slice rather than a story number.
- **Why:** The plan's uniqueness rule is already keyed on the lesson, and a scaffold has no story to key on.
- **Refuted alternative:** A story-plus-part key on `StagedLesson`, which still needs a second rule for scaffolds.

## 2026-09-12 — A plan-wide epic survives only as the default for older plans
- **Choice:** Each story slice reads its own `epic`; a plan-wide `epic` is used only when a slice records none.
- **Why:** Hand-written single-epic plans keep reading, while every approved plan records the epic per slice.
- **Refuted alternative:** Refuse any slice without its own epic, which breaks every shipped single-epic plan.

## 2026-09-13 — Approval refuses a draft by the fingerprint of what the gate printed
- **Choice:** Printing the gate records a sha256 of the rendered draft beside it; `--approve` refuses when the current draft's fingerprint differs or none was recorded.
- **Why:** Invariant 13 needs "exactly the draft the reviewer was shown", and the rendered draft text is already deterministic.
- **Refuted alternative:** Re-print the gate inside `--approve` and approve whatever it shows, which approves a draft nobody read.

## 2026-09-13 — Pinning tests arrive through the prose file, filed under the slice identity
- **Choice:** The prose front matter carries `pinning_tests: [{slice, file, text}]`; a learner arrival puts `writeTest` on the brief, a handoff arrival returns a `tests` outcome naming both slices.
- **Why:** `--prose` is already the session's one channel for agent-written text, and a slice id keys the handed-off and next slice's tests in one file.
- **Refuted alternative:** A separate `nexus workbook pin-test` verb, which adds a second generative seam outside the fixed session chain.

## 2026-09-13 — Reviewer commands are declared in a YAML file passed with `--commands`
- **Choice:** `gate --approve --commands <file>` reads `suite`, `grading` and optional `probe_control` with the plan reader's own validation.
- **Why:** Argument vectors and a multi-line control test do not fit a flag, and every other planning judgement already arrives as a file.
- **Refuted alternative:** Repeated `--suite`/`--grading` flags, which cannot carry the control test's text.
