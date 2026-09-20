## 2026-09-20 — The record checklist is its own module, not a mode of the planning gate's builder

- **Choice:** A new `record-offer` module beside `offer`, sharing only the document parse and the label stripper.
- **Why:** The two lists have no field in common beyond number and text — no smallest usable version, no dependency graph, no per-story parent — so a shared builder would be a union type whose halves never meet.
- **Refuted alternative:** Add a record mode to `checklist()` and widen `ChecklistItem` with the record's kinds; rejected because every planning-gate reader would then have to narrow on a kind it can never see.

## 2026-09-20 — The record list drops the provenance suffix each planning-gate line carries

- **Choice:** A record line renders as `<n>. <text>` with no trailing `inferred` or `you asked: "…"`.
- **Why:** The list holds only the model's own additions, so the suffix would say the same thing on every line.
- **Refuted alternative:** Keep the suffix for symmetry with the planning gate's render; rejected because the symmetry the epic asks for is in how a number behaves, not in what each line trails.

## 2026-09-20 — The freeze comparison is a checker argument, not a fetch the checker makes

- **Choice:** `razor-offer --record` takes the approved body as `--approved-body <path>`; the stage decides whether to fetch it, from `record_state`.
- **Why:** Keeps the checker read-only over local files, so the freeze rule is testable without a network or a `gh` stub.
- **Refuted alternative:** Have the checker take `--record-issue <n>` and fetch the body itself; rejected because every other razor verb reads only what it is handed.

## 2026-09-20 — A frozen line is still rendered and still ticked

- **Choice:** Freezing marks a line; it does not drop it from the list or arrive it unticked.
- **Why:** The reviewer needs to see the invariant that is binding them even when they cannot cut it here, and unticking would say a plain approval drops it, which is false.
- **Refuted alternative:** Omit frozen lines, since nothing can be done about them at this gate; rejected because on a revision run that hides most of the record from the person approving it.
