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

## 2026-09-25 — The section reader is a separate projection over `readRecord`
- **Choice:** `recordSections` in scope-razor maps `readRecord`'s raw lines into named parts (decision, why, refuted alternatives, trade-off, delivered by, guarantee IDs; guarantee group and cited decisions; risk severity; concept-change page/old/new), with labels stripped and `none` fields absent; `nexus record-sections --body` prints it as JSON.
- **Why:** The checkpoint needs the raw lines and their exact text for cuts and frozen marks, while the later stages need values by name, so one reading serves both without changing the checkpoint's shape.
- **Refuted alternative:** Extend `RecordReading` itself with the named fields; one type, but every checkpoint caller then carries fields it never reads and a change for one reader risks the other.

## 2026-09-25 — The reader prints no section text for close's baseline
- **Choice:** `record-sections` lists parts only; `/nxs.close` reads How it works and the Mechanism from the body as prose.
- **Why:** The record says the later stages "read the body as prose as before"; the reader's job is the lists a stage can drop a line from, and a prose section cannot lose a line that way.
- **Refuted alternative:** Include `howItWorks` and `mechanism` text in the JSON; one fewer place to look, but it duplicates the body in the output and adds fields no check reads.

## 2026-09-25 — The neither-format block is opt-in via `razor-check --source --record`
- **Choice:** `checkDraft` takes `{ record: true }` and adds a blocking `record-format` finding when the draft reads as neither format; `/nxs.decision-record` passes `--record` at its draft check.
- **Why:** The checker cannot tell a record draft from an epic draft by content, and an epic draft always reads as neither.
- **Refuted alternative:** Infer "record" from a `# Decision Record:` heading; no flag, but a hand-edited heading would silently skip the check it exists for.

## 2026-09-25 — Distill's additions paid for inside the ceiling
- **Choice:** The distill base stage stays under its recorded load ceiling by condensing the Phase 3 Sources paragraph and the Phase 0 old-contract/no-record items that restated each other, rather than raising the ceiling.
- **Why:** The ceiling record requires `replaces > bytes`, so it is designed only to go down.
- **Refuted alternative:** Move the format rules into a new distill contract skill; it keeps the base stage small, but the rules apply to every ordinary drain, which the contract model reserves for no contract.

## 2026-09-25 — A bare commitment reference reads the epic repository
- **Choice:** `nexus record-amendments` reads a bare `#N` against the resolved `epic-repo` (the current repository when empty), and an `owner/repo#N` against the repository it names; it takes no `--epic` flag.
- **Why:** The record is filed as a sub-issue of the epic, so under the issue-reference rule a bare number in its body resolves against the epic's repository, and a story in another repository is already written qualified.
- **Refuted alternative:** Take `--epic <N>` and read every other number against `story-repo`; it guesses right for an unqualified story in a split workspace, but contradicts the reference rule the record body is written under.

## 2026-09-25 — The amendment check fails closed on an unreadable commitment line
- **Choice:** A non-`none` "Epic commitment affected" line that does not read as `<issue>. Old: "…". New: "…". Status: <status>.` exits 1 naming the decision and line, and nothing is fetched; an `unresolved` line may omit the wording and is reported unchecked.
- **Why:** An unchecked commitment must not read as a checked one, and the stage has no result to write for a line it cannot parse.
- **Refuted alternative:** Report the line in the JSON and exit 0, leaving it to #792's cross-reference block; the output stays complete, but until #792 ships nothing stops a malformed commitment reaching the cut list.

## 2026-09-25 — The pure half lives in scope-razor, the gh half in portable-tools
- **Choice:** `@nexus/scope-razor/amendments` reads commitments from the draft (through `readRecord`) and matches wording; `libs/portable-tools/src/record-amendments.ts` resolves the repository, fetches with `gh api` through an injected `Runner`, and takes an injectable clock.
- **Why:** The commitment field is read by the one record reader, and scope-razor has no process seam; the verb module can take a fake runner in its spec the way `fetchRecord` does.
- **Refuted alternative:** Reuse `fetchRecord` from record-digest for the fetch; one fewer gh call site, but its diagnostics name a "record issue" and it hashes a body nobody reads here.
