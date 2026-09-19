## 2026-09-19 — The sweep's candidate set is the union of prefix and record, not the intersection

- **Choice:** a path becomes a removal candidate when it carries the Nexus prefix **or** the
  installing package's own record claims it; the existing `foreign`/`mine` filters then run
  unchanged.
- **Why:** the prefix answers for a root that predates the record, and the record answers for a
  package whose components carry no Nexus prefix at all — neither alone covers both.
- **Refuted alternative:** widening `isNexusNamespacedPath` to know about `nxsx`. That makes the
  namespace predicate a register of every package that ever ships, which is the thing the record
  exists to replace, and it would put the teaching package's files back inside a Nexus sweep.

## 2026-09-19 — A record path is swept only inside a managed subtree, and only if really present

- **Choice:** guard the record-derived candidates with `isUnderManagedSubtree` and an `lstat`
  presence check.
- **Why:** the record is a claim about what was placed, not a licence to delete an arbitrary path;
  a hand-edited or corrupt record must not be able to reach the component root's top level.
- **Refuted alternative:** trusting the record verbatim, since the mirror writes it. It is a file
  on disk in a directory the owner edits.

## 2026-09-19 — `nxsx`, not a scoped directory or a longer word

- **Choice:** the four components become `nxsx.teach`, `nxsx.teach-plan`, `nxsx-workbook`,
  `nxsx-concept-extractor`.
- **Why:** the harness's component names are flat, so the namespace has to live in the name; one
  extra character keeps the prefix obviously related to Nexus while failing `startsWith("nxs.")`
  and `startsWith("nxs-")`, which is exactly the property the sweep and the migration need.
- **Refuted alternative:** `teach.*` with no prefix. It would collide with an adopter's own
  component named `teach`, and the adopter's files are the ones the namespace rule protects.
