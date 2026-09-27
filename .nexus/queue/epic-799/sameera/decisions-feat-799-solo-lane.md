## 2026-09-26 — Solo declaration key
- **Choice:** `delivery.solo: true` in `.nexus/config/settings.yml`, read by a new `nexus solo-check` that asks the close-role resolver for shape first.
- **Why:** a `github.*` key would sit beside catalogue rows that inherit from hub defaults, which D2 forbids for a per-repository lane.
- **Refuted alternative:** a top-level `solo: true` scalar, which the two-level settings readers elsewhere in the toolkit would misparse as a section.

## 2026-09-26 — What the conformance rule skill copies
- **Choice:** analyze's whole "# Phase 2 — Conformance checks" section, byte for byte between copied-from markers, with the spec comparing the marked span to the live section.
- **Why:** Phase 2 is where the per-story, guarantee, success-metric and drift rules and their severities live; Phase 3's report and receipt are analyze's own hand-off.
- **Refuted alternative:** copying Phases 2 and 3, which would carry receipt-writing text into a lane that writes none.

## 2026-09-27 — Loop's staleness check on the advisory report
- **Choice:** the loop reads only `.nexus/tmp/epic-<N>/advisory-report.md` and stops when its `head` is not exactly `git rev-parse HEAD`, which is why the report's `head` is the full SHA.
- **Why:** a blocked round writes no report, so an old report must not pass for the current round; exact full-SHA equality needs no prefix matching.
- **Refuted alternative:** deleting the report before each analyze round, which would hide a stale file rather than name it, and would not cover a report the first round never replaced.

## 2026-09-27 — Superseded #802 spec assertion and the fix-lane wording
- **Choice:** the #802 spec's "no file of any kind" assertion now pins "writes no receipt, on every path"; Phase 0.1 keeps its existing sentence and adds a separate one refusing `advisory-report.md`.
- **Why:** the re-approved D5 replaced "writes nothing" with an advisory report, and a separate sentence leaves the fix-lane spec and the `--pr`-shared refusal text untouched.
- **Refuted alternative:** folding the report into the Phase 0.1 sentence, which would have forced editing the fix-lane spec.
