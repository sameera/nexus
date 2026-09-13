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

## 2026-09-13 — The taught prefix travels into the draft through the rewrite
- **Choice:** `rewritePlan` takes `carried` stubs, sets them aside before merging, strips their concepts from the rest, continues a partly taught story's part numbers, and prepends them; approval then checks the draft's prefix matches the taught slices.
- **Why:** The gate must show and coverage must check exactly the plan approval writes, so the fixed prefix has to be in the draft rather than spliced in at approval.
- **Refuted alternative:** Splice the carried slices into the plan at approval time, which approves an order and a coverage verdict the reviewer never saw.

## 2026-09-13 — A re-approval refuses a second declaration of the commands
- **Choice:** `--approve --commands` over an existing plan is refused; the committed plan's suite, grading and control test are reused.
- **Why:** Record #591 has re-approval reuse them, and silently preferring either source would hide which one won.
- **Refuted alternative:** Let a newly declared file replace the committed commands.

## 2026-09-13 — Every render path takes one options builder over the plan and the lessons
- **Choice:** `planRenderOptions` in the store builds lessons, stubs and home entries from a given plan; the session, approval, `render` and `check` all call it, and a workbook with no teaching plan keeps the lessons-only render.
- **Why:** Check mode compares bytes, so any path that rendered from different inputs would report the home page as drifted after every session (record #591 ADDRESS risk 2).
- **Refuted alternative:** Add home-page rendering to each path separately, which is how the render verb and check mode diverged from the session before.

## 2026-09-13 — The home page is `index.html`, its dependency edges are in-page anchors
- **Choice:** The home page renders to `index.html`, each slice an `<li>` anchored by its identity, dependencies linked by anchor; the plan reader refuses a lesson that would render to that name.
- **Why:** Derived lesson names start `story-` or `scaffold-`, so the reservation only ever refuses a hand-written plan, and anchors keep the graph navigable without layout code.
- **Refuted alternative:** An SVG graph laid out by a script when the page opens, which record #450 refuses because the content must exist at render time.

## 2026-09-13 — An empty issue body is pinned as an empty string, and the reader accepts it
- **Choice:** `pinned.body` must be a string but may be empty; approval pins it verbatim.
- **Why:** An issue with no description is the story's real state, and refusing it at approval would block a legitimate roadmap over a field nobody chose.
- **Refuted alternative:** Refuse at approval a story whose body is empty, which moves the refusal earlier without making the plan any more true.

## 2026-09-13 — Plan and pages are written by staging the plan and restoring the previous pages on failure
- **Choice:** `writePlanWithPages` stages `plan.yml.partial`, holds the previous rendered files in memory, writes the pages, and renames the plan into place only after they land; on failure it removes the staging and restores the old pages.
- **Why:** Invariant 31 asks for together-or-not-at-all, and the page write clears the folder before writing, so only a held copy can put it back.
- **Refuted alternative:** Render pages into a sibling directory and swap directories, which would move the authored `lessons/` folder along with them.
