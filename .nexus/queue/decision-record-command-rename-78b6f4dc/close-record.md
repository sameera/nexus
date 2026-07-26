---
title: "Close Record: Rename /nxs.hld to /nxs.decision-record"
epic: "#151"
feature: "Pipeline Command Surface"
date: 2026-07-26
analyze: ran 2026-07-26 @ f4f83707c2a3174cf8bdc541932d39025e7dd93c
range:
  - repo: github.com/sameera/nexus
    base: 0e32a29a2c64ef68c4976417151105de458a19c8
    head: e035ab54ee8d3e79c2d451011852b47045b8abb9
---

# Close Record: Rename /nxs.hld to /nxs.decision-record

## Key Decisions

- **Prime stage chip reads `record`, stage id `decision-record`:** the full command name does not
  fit the header rail strip, and the epic explicitly delegated the chip text to the engineer. The
  stage id keeps the full `decision-record` name so code identity matches the command; only the
  visible label is shortened. Refuted alternative: render the full `decision-record` label and let
  the rail accommodate it — rejected because the six-stage strip is width-constrained and the
  shortened form was sanctioned in the epic's notes.
- **Sweep extended beyond AC3's enumerated surfaces to `docs/design/` mockups and
  `manual/assets.html`:** success metric 1 demands zero `nxs.hld` hits repo-wide outside the
  designated historical paths, and these living design docs are not on the historical list.
  Refuted alternative: touch only the AC-listed surfaces and treat mockups as out of scope —
  rejected because it would leave the success-metric grep failing on living files.
- **Mockup-internal rail keys keep `hld`** (e.g. `setRail({... hld:"active"})` in
  `prime-ui-mockup-light.html`): these are internal JS state keys containing no `nxs.hld` string,
  so no AC or success metric is violated; rewriting them is deferred to a future mockup refresh.
  Refuted alternative: none — flagged by analyze as a low-severity note, not a violation.

## Deviation Rationale

No deviations. The epic has no decision record (complexity S — a legitimate no-record outcome),
so the pass ran downgraded against the epic's stated approach and scope; the shipped diff matches
it: hard cut with no alias, historical paths byte-identical, vendored payload re-stamped, Prime
stage renamed.

## Deferred Scope

None. Nothing was deferred from this epic; no backlog append was made.

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-07-26-decision-record-command-rename.md`
