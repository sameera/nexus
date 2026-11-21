## 2026-11-21 — R2 pre-check: a feature-only meta block drops the epic title
- **Choice:** Checked before #1047: the serializer uses a meta block's raw frontmatter verbatim, so a block carrying only `feature_issue` would resolve without the `epic:` title the blockless epic resolved with. #1047 makes the serializer add `epic:` from the issue title when the block lacks it.
- **Why:** R2 asks that the only read-back change be the added feature issue number.
- **Refuted alternative:** Write `epic:` into the added block too — it edits the body beyond the feature reference D5 allows.

## 2026-11-21 — migrate is a feature-issue subverb with an injected GitHub side
- **Choice:** `nexus feature-issue migrate [--apply]`; the planner takes a `MigrationGh` and the CLI binds the REST listing and `runCreateStory` with a kept ledger under `.nexus/tmp/feature-migration/`.
- **Why:** Reuses #998's lookup, work item and guarded filer, so both epics find and file feature issues one way.
- **Refuted alternative:** A new top-level `nexus migrate-features` verb — a second home for feature-issue rules.
