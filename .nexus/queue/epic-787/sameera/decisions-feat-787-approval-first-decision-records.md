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

## 2026-09-25 — Cut IDs passed to derive as an explicit `--cut` flag
- **Choice:** `nexus razor-check --derive` takes `--cut G3,R2`, and stops naming every line that still cites a listed ID as a whole token, writing nothing.
- **Why:** The explicit list is deterministic; the stage already knows what the reviewer cut.
- **Refuted alternative:** Detect cut IDs as gaps in the G/R numbering; it needs no flag, but a gap left by an earlier revision would read as a fresh cut.

## 2026-09-25 — `none` fields removed wherever they appear, not only inside decision entries
- **Choice:** `deriveFilingBody` drops any `- **<Field>:** none` bullet (case-insensitive, optional period), and `survivingTokens` reports one as `none-field`.
- **Why:** G10 says no `none` field reaches a filed body, and no epic, close or story template writes such a line, so a generic rule costs epics nothing.
- **Refuted alternative:** Remove them only inside a record's `#### D<n>` entries; it is narrower, but it makes the derive step format-aware and misses a `none` field written elsewhere.

## 2026-09-25 — The section reader returns guarantees and invariants as separate lists
- **Choice:** `readRecord` returns `{ format, decisions, guarantees, invariants, risks, conceptChanges }`, with the list the format lacks left empty; the checkpoint reads a draft in neither format by the old headings, as today.
- **Why:** One flat shape serialises directly for #790's read-only command, and keeping the neither-format checkpoint on the old path leaves every old-format result unchanged.
- **Refuted alternative:** A discriminated union per format; it is stricter in TypeScript, but every caller then branches before it can read the risks and decisions both formats share.

## 2026-09-25 — Unlabelled guarantee or risk blocks at `razor-check --source`, new format only
- **Choice:** `checkDraft` adds provenance-label findings for every unlabelled guarantee and risk when the draft reads as the new format.
- **Why:** G7 (D4) requires it, and an old-format draft is left exactly as today.
- **Refuted alternative:** Leave it to #792's cross-reference findings; the cut list would then keep an unlabelled line only through the reader's default, with no finding.
