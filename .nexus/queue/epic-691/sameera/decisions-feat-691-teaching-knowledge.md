## 2026-09-19 — A forwarding address stays in the store, it is not archived

- **Choice:** the 35 moved pages stay at the top level of the concept store as `status: deprecated`
  stubs, rather than moving to the archive the way a retired page normally does.
- **Why:** the validator resolves a `touches:` edge against the page's own directory and refuses one
  whose other end is gone (#672). Five pages that stayed name a page that left, and archiving would
  have left all five holding a dead edge — which reads as the interaction having lapsed, when it only
  moved. The atlas already excludes deprecated pages, so the human-facing surface is clean either
  way, and a grep for the old slug lands on an answer.
- **Refuted alternative:** archive the pages and drop the five inbound edges. It follows the existing
  retirement convention exactly, and it silently deletes the only record that the teaching stage and
  the decision record, the record digest, workspace resolution, the pipeline-store exclusion and the
  portable tooling ever interacted.

## 2026-09-19 — The stub keeps its Integration Points and loses its body

- **Choice:** the forwarding page replaces Summary, How It Works and Key Invariants with the
  forwarding statement, and keeps the bullets and the whole decision log.
- **Why:** keeping the body would be a second copy of the knowledge in a repository that no longer
  ships the behaviour — the "two copies, one goes stale" failure the store exists to prevent. Keeping
  the bullets is what holds the edges live, and the log is append-only.
- **Refuted alternative:** a one-line stub with no sections. It fails the page schema, so nothing
  would keep the forwarding entry well-formed as the store around it changes.

## 2026-09-19 — Cross-repository edges are cut on arrival, not on departure

- **Choice:** the five edges to Nexus pages are dropped in the copy that landed in the teaching
  repository; the Nexus side keeps all of its edges.
- **Why:** the direction that has to lose the edge is the one whose store no longer holds the other
  end. Nexus still holds every page the retired stubs name, because the stubs are all still there.
- **Refuted alternative:** cutting both sides symmetrically. It would delete live edges between pages
  that both still exist here, for no reason other than symmetry.

## 2026-09-19 — The new store is validated by the Nexus executable, not by a copy of it

- **Choice:** the teaching repository is a Nexus adopter and runs `nexus validate-concepts` and
  `nexus check-atlas` against its own store.
- **Why:** it already depends on the Nexus package, and the validator is a verb on it. A second
  implementation would be the same drift the split was done to avoid, one level up.
- **Refuted alternative:** porting the validator. Several thousand lines, to check pages written to
  the same schema.
