## 2026-09-06 — A failed render clears the previous render's pages

- **Choice:** `renderWorkbookInto` is the render entry point; when the render throws it clears the workbook's output (pages, stylesheet, script) and rethrows, so a failed render leaves nothing to open.
- **Why:** Invariant 15 says a failed render leaves no partial *or stale* output behind; a surviving page no longer matches the lesson that produced it and nothing on the page says so.
- **Refuted alternative:** Leave the previous render in place (what the code and its spec did before), which keeps a readable workbook after a failure but makes it silently wrong.

## 2026-09-06 — Placement is enforced in code, not documented

- **Choice:** `assertWorkbookHome` runs inside `createWorkbook` and refuses a hub checkout; `resolveWorkbookHome` picks the member from the checkout the command ran in, or from `--repo` when run from the hub.
- **Why:** Invariant 6 had no implementing code — `createWorkbook` took whatever root its caller passed — so the rule held only by convention.
- **Refuted alternative:** Resolve placement only in the CLI. Rejected because any other caller could still put a workbook in the hub.

## 2026-09-06 — Renderer specs read a page through one DOM-backed fixture

- **Choice:** `workbook-page-fixtures.ts` parses a page (via the jsdom vitest environment) and returns what a reader perceives — text, emphasis, links, navigation, controls, what prints — and the specs assert only on that.
- **Why:** Invariant 21 forbids asserting through the emitted markup's shape; one module now knows the markup, and rearranging it changes that module and no spec.
- **Refuted alternative:** Keep string assertions but loosen them. Rejected because a looser string match still pins tag shape and still passes when the page stops being readable.

## 2026-09-06 — Lessons live in `lessons/`, ordered by an optional `plan.yml`

- **Choice:** Authored lessons sit under `<workbook>/lessons/`, pages render beside them at the workbook root, and `plan.yml` (`lessons:` list) gives teaching order; without it order is file name. A plan and a lessons folder that disagree fail the render.
- **Why:** The record names two render inputs — the lesson files and the plan that orders them — and the CLI needed a concrete layout to read them from.
- **Refuted alternative:** Order by file-name prefix only. Rejected because renaming a lesson to reorder it changes its page's URL.
