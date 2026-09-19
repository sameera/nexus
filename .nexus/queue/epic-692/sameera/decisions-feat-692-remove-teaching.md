## 2026-09-19 — The record stage stops pinning workbook sources rather than addressing the new verb

- **Choice:** `/nxs.decision-record` drops its pin step entirely and reports that the record is
  closed and available to pin from; the teaching package's own stage does the pinning.
- **Why:** a stage does not drive a verb its own package no longer ships. Addressing the other
  package's executable would also fail the invocation gate, which resolves a code-span invocation
  against this executable's declared surface — correctly, because a Nexus adopter who has not
  installed the teaching package would be told to run something that is not there.
- **Refuted alternative:** keeping the step and guarding it on the teaching executable being
  present. It puts a second package's install state inside a Nexus stage's control flow, for a step
  that stage has no reason to own.

## 2026-09-20 — The workbook store stays in the pipeline's exclusion register

- **Choice:** `.nexus/workbook` stays in the set every stage withholds from the diffs it derives,
  even though nothing in this repository writes it any more.
- **Why:** the register is about what a stage must not read back as behaviour, not about what this
  package writes. An adopter who installs the teaching package has a workbook in their repository,
  and a conformance verdict that read its generated markup as shipped behaviour is exactly the
  failure the register exists to prevent.
- **Refuted alternative:** dropping the entry now that the writer has left. It would silently
  re-open the failure for every adopter who teaches a roadmap.

## 2026-09-20 — The placement specs move rather than being deleted

- **Choice:** the three assertions about where a workbook sits moved to the teaching repository; the
  exclusion assertions stayed.
- **Why:** they are two different behaviours that happened to be tested in one file. Placement
  belongs where the code that decides it lives; the exclusion belongs where the diffs are derived.
- **Refuted alternative:** deleting them with the import. It is what the compiler would have been
  satisfied by, and it would have dropped the only check that a workbook is committable.

## 2026-09-20 — The tracked coverage report goes with the tree it reported on

- **Choice:** delete the committed `coverage/` directory and add an ignore rule for it.
- **Why:** every source file it reported on left this repository, so what is left is a tracked
  artifact describing code that is not here. It was committed by accident in the first place.
- **Refuted alternative:** leaving it for #453 to handle. That issue is about the repository
  committing a coverage report at all; this directory is that report, and leaving a stale one behind
  to be tidied later is how it got committed in the first place.
