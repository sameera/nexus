## 2026-09-25 — Old-format template kept as decision-record-template-v1.md
- **Choice:** The new format takes the existing name `decision-record-template.md`; the old one is preserved as `decision-record-template-v1.md` and added to the seeded set.
- **Why:** Every stage and anchor already names the existing file, so the default path gets the new format and only the rare old-format revision names a new file.
- **Refuted alternative:** Give the new format a new name and keep the old name for the old template; it would spare adopters a re-seed but leave every new record drafted from the old file by default.

## 2026-09-25 — Stale seeded template stops the stage
- **Choice:** When the project's `decision-record-template.md` has no `## Guarantees` section, `/nxs.decision-record` stops and names the re-seed as the remedy.
- **Why:** Seeding never overwrites, so an adopter's copy stays old; drafting new-format content into it would file a record in neither format.
- **Refuted alternative:** Draft from the master shipped in the release instead; it needs no lead action but silently ignores a project's tuned template.

## 2026-09-25 — Refuted alternative written as `none` via guidance, not a standing line
- **Choice:** The template's decision entry carries no refuted-alternative line; its guidance comment tells the drafter to write the line, or `- **Refuted viable alternative:** none`.
- **Why:** D6 requires every optional field present as `none`, and nxs-razor §9 forbids a standing slot or placeholder for the alternative in any template; guidance satisfies both.
- **Refuted alternative:** A standing `{{ALTERNATIVE}}` line as in the trial template; it contradicts §9 and its conformance test.

## 2026-09-25 — Release marked breaking
- **Choice:** The 0.74.0 changelog says "Breaking" for the re-seed, and the release-notes spec's context sets `breakingChange: true`.
- **Why:** A repository seeded before 0.74.0 finds `/nxs.decision-record` stopping until the lead re-seeds.
- **Refuted alternative:** none
