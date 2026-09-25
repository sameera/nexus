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

## 2026-09-25 — The story count comes from the resolved epic.md via `--epic`
- **Choice:** `nexus razor-check --record` takes `--epic <path>` and counts the distinct `### Story` headings of the resolved `epic.md`; without it, it counts those in `--source`. The stage passes `--epic "${QDIR}/epic.md"`.
- **Why:** `epic.md` has one deterministic producer, while `source.md` is assembled by the model and may hold story bodies with no story headings, which would read as a one-story epic and silently skip the check.
- **Refuted alternative:** `--stories <n>`; explicit, but the model counts, and a wrong count passes silently.

## 2026-09-25 — A decision listed under both Resolve and Choices blocks
- **Choice:** A decision with a trade-off whose ID appears in both "Resolve before approval" and "Choices with trade-offs" is a blocking cross-reference finding.
- **Why:** G5 says it appears in the brief exactly once; two copies are how the trial's #786 lost a trade-off when an item moved groups, since one copy goes stale.
- **Refuted alternative:** Accept the duplicate as listed; it never blocks a correct draft, but lets the stale copy stand.

## 2026-09-25 — G13 reuses the amendment reader, so an unquoted old wording blocks
- **Choice:** The wording check reads each commitment through `commitmentsIn`; a line it cannot read, or one that gives no quoted Old or New (including an `unresolved` line that omits them), blocks whatever the brief says. An addition passes with `Old: ""`.
- **Why:** One reader means the checkpoint's two steps agree on what "the exact wording" is, and AC 3 is unconditional.
- **Refuted alternative:** Accept prose such as `Old: no criterion` as an addition; it passes the trial records, but the amendment check cannot read that line.

## 2026-09-25 — "Listed" is a whole-token ID anywhere in the group block
- **Choice:** An ID counts as listed when it appears as a whole token on any line (sub-bullets included, labels stripped) between the group's bold line and the next bold line or heading.
- **Why:** Resolve entries cite IDs inside prose, such as "(D2, D9)", so matching only an item's leading ID would miss them.
- **Refuted alternative:** Match only the leading `D<n>.` of a Choices item; stricter for Choices, but two rules for one word "listed".

## 2026-09-25 — The record-new fixture's pending change becomes amended
- **Choice:** `record-new.labelled.md`'s D2 commitment reads `Status: amended (verified 2026-09-20)`.
- **Why:** Its pending change sat under Choices, not Resolve, which is exactly the gap #792 blocks; the fixture is used as a passing draft, and amending keeps every line number other specs pin.
- **Refuted alternative:** Move D2 into "Resolve before approval"; also valid, but shifts the fixture's lines.

## 2026-09-25 — A guarantee or decision with no ID blocks on its own
- **Choice:** Any unnumbered guarantee or decision in a new-format draft is a blocking cross-reference finding, whatever else it says and whatever the brief lists.
- **Why:** Every cross-reference check matches by ID, so an unnumbered item skipped them all and could not be listed under "Resolve before approval" either.
- **Refuted alternative:** Block an unnumbered item only when it would fail a check if numbered; that re-implements every check a second time, by text, to reach the same fix (add the ID).
