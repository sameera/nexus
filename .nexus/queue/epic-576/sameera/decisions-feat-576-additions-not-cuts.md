## 2026-09-12 — The ordering block is a title-keyed list, not a table

- **Choice:** `## Implementation Order` is a bullet list (`- **<Title>** — blocked by: …`), parsed line by line.
- **Why:** The filed `## Implementation Sequence` is a table keyed on issue numbers; a second table shape at drafting time reads as the same artifact and invites the two to be confused.
- **Refuted alternative:** Mirror the filed table's `| Story | blocked_by |` shape at drafting time.

## 2026-09-12 — A missing ordering row blocks, but only when the draft declares stories

- **Choice:** `checkOrdering` returns nothing when the draft has no `### Story` heading; otherwise every story must have a row.
- **Why:** The decision-record and discovery stages share this checker and have no stories; demanding a block there would block drafts the rule was never written for.
- **Refuted alternative:** Require the block whenever the heading is absent, and let the other stages carry an empty one.

## 2026-09-12 — Filing-body derivation gets its own function rather than widening stripLabels

- **Choice:** `deriveFilingBody` strips labels and removes the ordering section; `stripLabels` keeps its line-local meaning.
- **Why:** `ordering.ts` calls `stripLabels` per line to read a title; widening it to remove a whole section would make the reader depend on the writer.
- **Refuted alternative:** Extend `stripLabels` to drop the block as well.
