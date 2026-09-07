---
title: "Close Record: The workbook store, and the renderer that turns lesson markdown into pages"
epic: "#405"
feature: "Roadmap-Driven Learning"
date: 2026-09-07
nexus_version: 0.5.0
analyze: "stale — ran 2026-09-07 @ 006ef734761d1eb31576dd2b9bc8b7b48aba0ad1, 1 commit(s) unanalyzed; waived 2026-09-07"
record: "#450"
record_hash: f48dcba61728a0702b0a0f9e940cd6f01b841600bad81569a01d31ffb79521c9
range:
  - repo: github.com/sameera/nexus
    base: 7e1edcdddf144e50de198c00ba9676009e1dc44a
    head: b5f1ce09e01dbb853ccd6e1d6fa63dd3582bf50d
---

# Close Record: The workbook store, and the renderer that turns lesson markdown into pages

## Key Decisions

- **A failed render clears the previous render's output rather than leaving it in place.** `renderWorkbookInto` became the render entry point: when the render throws it removes the workbook's pages, stylesheet and script, then rethrows. Invariant 15 forbids partial *or stale* output, and a surviving page from an earlier render no longer matches the lesson that produced it while nothing on the page says so. *Refuted alternative:* leave the previous render in place — the behaviour the code and its spec had before — which keeps a readable workbook after a failure but makes it silently wrong.

- **Workbook placement is enforced in code, not documented.** `assertWorkbookHome` runs inside `createWorkbook` and refuses a hub checkout, and `resolveWorkbookHome` picks the member from the checkout the command ran in, or from `--repo` when run from the hub. Invariant 6 had no implementing code — `createWorkbook` accepted whatever root its caller passed — so the rule held only by convention. *Refuted alternative:* resolve placement in the CLI alone, rejected because any other caller could still put a workbook in the hub.

- **Renderer behaviour is asserted through one DOM-backed fixture module.** `workbook-page-fixtures.ts` parses a page under the jsdom test environment and returns what a reader perceives — text, emphasis, links, navigation, controls, what prints — and every renderer spec asserts only on that. Invariant 21 forbids asserting through the emitted markup's shape; one module now knows the markup, so rearranging the markup changes that module and no spec. *Refuted alternative:* keep string assertions but loosen them, rejected because a looser string match still pins tag shape and still passes when the page has stopped being readable.

- **A concrete store layout: lessons under `lessons/`, teaching order from an optional `plan.yml`.** Pages render beside the lessons at the workbook root; without a plan, order is file name; a plan and a lessons folder that disagree fail the render. The record named two render inputs — the lesson files and the plan that orders them — but no layout to read them from, and the CLI needed one. *Refuted alternative:* order by file-name prefix only, rejected because renaming a lesson to reorder it would change its page's URL.

- **Resolving a handoff goes through a guarded append, not `fs.appendFileSync`.** `appendLearnerRecord` asks `isIgnoredByGit` exactly as `writeLearnerRecord` does, and `resolveHandoff` uses it, threading the runner from the CLI. Invariant 9's guard is per write, and the resolve append was the second write that contract exists for. *Refuted alternative:* treat the record already existing on disk as the answer and leave the append unguarded, rejected because the ignore rule can be removed between the pause and its resolution — precisely the case the per-write check was written for.

- **Ship the record's check mode rather than revise the record to drop it.** `nexus workbook check <slug>` and `checkWorkbook` re-render the lessons in memory, compare bytes against the committed files, and report changed, missing and extra pages without repairing anything. The record's generated-pages decision named four properties and the fourth — a check mode that catches drift — had no implementing code when the first conformance pass ran. Committed generated output has exactly that one failure mode, and a deterministic renderer makes the comparison exact. *Refuted alternative:* revise the record to drop check mode, rejected because the drift it names is real and unguarded — a generated page in a diff looks authored, and nothing on it says which lesson it has fallen behind.

- **The exclusion set gained a readable command-facing face.** The set is defined once in `pipeline-stores.ts`, and `nexus excluded-stores` is the verb the analyze, close and distill command bodies call instead of restating the member paths; a spec fails when any body restates one. No story asked for a CLI verb, but invariant 4 requires command prose to derive its exclusions from the one definition, which is unreachable from prose without it.

## Deviation Rationale

- **Invariant 20 is relaxed for print (deviated from record #450, invariant 20).** The invariant states that the workbook declares no colour or typography value and resolves every one of them from the shared reading-surface definition. `workbook-render.ts` declares nine literal colour values inside its `@media print` block. Invariant 19 — print is ink on white whatever the screen theme — cannot hold without literals somewhere, because the shared definition in `reading-tokens.ts` carries no print set, and a library cannot reach back into the application for one. The code confines the literals to `@media print` and assigns them only onto shared token names, and `workbook-render.spec.ts` pins that confinement: no literal may appear in the screen half, and every literal in the print half must be assigning a `READING_TOKEN_NAMES` member. Invariant 20 therefore holds for the screen surface, which is the surface it was written about, and yields to invariant 19 for print.

- **A vitest coverage report was committed at the repository root (deviated from record #450's generated-output decision).** The epic's final commit, `207cfa1`, added eighteen generated files totalling roughly 7,250 lines under `coverage/`, and they are now tracked on `main`. This was accidental — the commit's intent was the feature README. It is unrelated to the epic's scope, and it is the class of file the record's own decision governs: committed generated output must carry a provenance banner and be check-verified against its source, and this carries neither. `.gitignore` covers `**/test-output/vitest/coverage` but not the root path, so nothing stopped it. Removal and the missing ignore rule are filed as deferred scope.

## Deferred Scope

Deferred items filed as backlog stub issues:

- #453 — The repository commits no coverage report, and no ignore rule is missing for one

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-09-07-workbook-store-and-renderer.md`
