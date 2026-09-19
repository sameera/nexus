## 2026-09-19 — The teaching set is derived from the import graph, not hand-listed

- **Choice:** the 68 files that moved are the transitive closure of `workbook-cli.ts` minus the
  closure of the pipeline entry points, plus the fixtures and specs that import only from it.
- **Why:** a hand-drawn inventory of 63 paths out of 152 is wrong the moment someone adds a module,
  and the whole point of this goal is that the next move relocates a directory.
- **Refuted alternative:** moving by filename pattern (`workbook-*`, `plan-*`, `teaching-*`). It
  misses `answer-check`, `fence-probe`, `html-escape`, `reading-tokens` and `roadmap`, and it would
  have taken `writer-stamp`, which is the pipeline's analyze/close artifact stamp.

## 2026-09-19 — The workbook store path is stated twice, on purpose

- **Choice:** `libs/teaching/src/workbook-location.ts` states where a workbook lives; the pipeline's
  `pipeline-stores.ts` keeps its own `.nexus/workbook` entry; a spec in the pipeline library pins
  that the two agree.
- **Why:** they are two different facts — "where the teaching stage writes" and "what a Nexus stage
  withholds from every diff it derives" — held by two packages that are about to become two
  repositories. After the split nothing can compare them, so the comparison exists while it can.
- **Refuted alternative:** the teaching library importing `@nexus/portable-tools/pipeline-stores`.
  The pipeline already imports the teaching library for the `workbook` verb, so that edge would make
  a workspace cycle, and it is exactly the edge that has to be absent for #690 to be a directory
  move.

## 2026-09-19 — The seam is enforced by a spec, not by convention

- **Choice:** `teaching-boundary.spec.ts` declares the three files allowed to import
  `@nexus/teaching` and what each may import, and asserts the teaching library imports nothing back.
- **Why:** a second import added quietly compiles, passes every other spec, and surfaces only as a
  broken build in the new repository.
- **Refuted alternative:** an eslint boundary rule. Lint is not currently a passing gate in this
  workspace, so a rule there would be written and never enforced.

## 2026-09-19 — The teaching library reads the authored component root through its own definition

- **Choice:** `teaching-components.ts` in the teaching library, rather than importing
  `authoredComponentRoot` from `vendor-components.ts`.
- **Why:** two teaching specs read the teaching stage's own shipped bodies, and that import would be
  the one remaining edge stopping the library from standing up alone.
- **Refuted alternative:** leaving `concept-extraction.spec.ts`'s inline `path.resolve(...)`
  and adding a second one. Two inline copies in one library is the drift the pipeline side already
  has one definition to prevent.
