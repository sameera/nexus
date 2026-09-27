## 2026-09-26 — Solo declaration key
- **Choice:** `delivery.solo: true` in `.nexus/config/settings.yml`, read by a new `nexus solo-check` that asks the close-role resolver for shape first.
- **Why:** a `github.*` key would sit beside catalogue rows that inherit from hub defaults, which D2 forbids for a per-repository lane.
- **Refuted alternative:** a top-level `solo: true` scalar, which the two-level settings readers elsewhere in the toolkit would misparse as a section.

## 2026-09-26 — What the conformance rule skill copies
- **Choice:** analyze's whole "# Phase 2 — Conformance checks" section, byte for byte between copied-from markers, with the spec comparing the marked span to the live section.
- **Why:** Phase 2 is where the per-story, guarantee, success-metric and drift rules and their severities live; Phase 3's report and receipt are analyze's own hand-off.
- **Refuted alternative:** copying Phases 2 and 3, which would carry receipt-writing text into a lane that writes none.
