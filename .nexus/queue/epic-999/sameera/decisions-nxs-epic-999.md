## 2026-11-21 — R2 pre-check: a feature-only meta block drops the epic title
- **Choice:** Checked before #1047: the serializer uses a meta block's raw frontmatter verbatim, so a block carrying only `feature_issue` would resolve without the `epic:` title the blockless epic resolved with. #1047 makes the serializer add `epic:` from the issue title when the block lacks it.
- **Why:** R2 asks that the only read-back change be the added feature issue number.
- **Refuted alternative:** Write `epic:` into the added block too — it edits the body beyond the feature reference D5 allows.

## 2026-11-21 — migrate is a feature-issue subverb with an injected GitHub side
- **Choice:** `nexus feature-issue migrate [--apply]`; the planner takes a `MigrationGh` and the CLI binds the REST listing and `runCreateStory` with a kept ledger under `.nexus/tmp/feature-migration/`.
- **Why:** Reuses #998's lookup, work item and guarded filer, so both epics find and file feature issues one way.
- **Refuted alternative:** A new top-level `nexus migrate-features` verb — a second home for feature-issue rules.

## 2026-11-21 — The body write is part of the shared feature step
- **Choice:** `writeFeatureReference` in `feature-link.ts` replaces a body only while it still reads as listed, edits nothing but the body, and reads it back; the migration writes every body through it and links through `linkToFeature`.
- **Why:** G3 routes every write through the guarded filer or the shared link step, and neither could edit an existing body.
- **Refuted alternative:** Calling `gh issue edit` from the migration — a write outside both shared steps.

## 2026-11-21 — Close links stubs through the batch filer's own feature pass
- **Choice:** Close hands each stub `feature_issue` in its work item, so `create-story`'s existing feature check and relates-to pass link it; link warnings become close notes.
- **Why:** It is #998's shared link step, already warn-only and run after the ledger records the issue.
- **Refuted alternative:** A separate link call from close after filing — a second implementation of the same step.

## 2026-11-21 — Read-back check through the serializer, not a live resolve
- **Choice:** Compare `extractMeta` + `serializeEpic` output of the old and new bodies, with the feature issue reference removed, before each edit.
- **Why:** The resolver's body-to-epic.md rule lives in those two pure functions, so the check needs no extra GitHub read.
- **Refuted alternative:** Calling `resolveEpic` against GitHub per issue, which re-fetches stories that the body edit cannot change.
