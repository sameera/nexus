## 2026-07-19 — Slug-line grammar & leaf-composed paths
- **Choice:** Each heading is followed by a single backtick-wrapped slug line carrying only the
  entry's own leaf slug; the parser composes a subdomain's full path as `<parent-leaf>/<own-leaf>`.
- **Why:** composing the path from nesting keeps the author from ever repeating the parent slug,
  avoids a "prefix must match parent" validation rule the AC doesn't require, and keeps same-leaf
  reuse under different parents (e.g. `connectors/catalog` vs `sources/catalog`) natural to author.
- **Refuted alternative:** have the author type the full slash-form path directly in the slug line;
  rejected because it duplicates the parent segment on every child, adds an unneeded
  prefix-must-match-parent check, and makes leaf reuse across parents awkward to write correctly.

## 2026-07-19 — Registry fixtures live in the specs, not the parity corpus (Story 1)
- **Choice:** Story 1's AC4 fixture suite (one well-formed registry + one fixture per malformation)
  lives entirely in `domain-registry.spec.ts` / `validate-concepts.spec.ts` as inline template
  strings; no `domains.md` is added to the shared parity corpus.
- **Why:** a `domains.md` at the corpus docs root would activate the registry pass for every
  existing corpus case and pull in Story 2's per-page `domain:` requirement, which is out of
  scope for Story 1; the registry/atlas corpus cases are deferred to Story 3, which can host an
  isolated registry-mode subtree without disturbing the existing corpus runs.
- **Refuted alternative:** add a well-formed `domains.md` (plus malformed variants) to the shared
  corpus now; rejected because it grows the corpus's blast radius into stories not yet built and
  risks the corpus's parity guarantees for consumers who haven't adopted the registry.
