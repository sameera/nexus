---
epic: "#94"
date: 2026-07-20
head: 1e368ef
mode: full
findings: { critical: 0, high: 0, medium: 0, low: 2 }
---

Conformance: Domain Filing and Drift Advisory in the Drain (.nexus/queue/domain-filing-drift-f0249299)  ·  epic #94
Mode: full
Surface: 29 files changed, 3 stories (3 closed / 0 open)

Per-story AC conformance:
  STORY 1 (#95) The drain files new concepts under the taxonomy:  4/4 met · 0 partial · 0 unmet · 0 contradicted
  STORY 2 (#96) A drift advisory surfaces taxonomy decay in the PR: 7/7 met · 0 partial · 0 unmet · 0 contradicted
  STORY 3 (#97) Seed mode drafts a registry for an existing store:  3/3 met · 0 partial · 0 unmet · 0 contradicted

Invariant violations:   none — all 13 constraints in the decision record hold in the diff.
Success metrics:
  SM1 (zero gate interruptions when every concept fits; gated 100% when none fits) — plausibly moved; observable per-drain (the gate fires or it does not), prompt-enforced rather than benchmarked.
  SM2 (empty section below threshold; byte-identical repeats; always exit 0) — measurable and moved; proven by parity.spec.ts and runCli always returning 0.
  SM3 (seed draft without modifying any page or the atlas) — measurable and moved; asserted by seed-registry.spec.ts.
Scope drift:
  - generate-atlas.ts CLI self-invoke guard hardened with a basename check so importing buildAdjacency into drift-advisory does not inline the atlas's main() into the advisory bundle. Bundler-correctness fix required to make the shared-engine decision (record: "one shared detection engine") work; breaks no invariant (Invariant 9 mandates the shared import). Documented in the engineer scratch.
  - renderAdvisory drops low-priority sibling notes under the staleness alarm too, beyond Invariant 8's literal "misfile and refinement". Consistent with AC5's "in place of page-by-page flags"; documented.
  - Seed adds an "Ungrouped — file by hand" section, generic candidate-N names, and TODO rubrics — elaboration within AC1.

Severity: ⛔ critical 0 · ⚠️ high 0 · medium 0 · low 2

All three story issues (#95, #96, #97) are CLOSED and the implementing code on HEAD (1e368ef) conforms to
every acceptance criterion and all 13 invariants. No blocking findings — the epic is ready for /nxs.close.

LOW — AC5 (Story 2) measures "filed-vs-detected disagreement" as the misfile count alone; refinement
hints do not count toward the 20% staleness threshold. Defensible (a misfile is a genuine wrong-domain
disagreement; a refinement is a correctly-filed page that could be more specific), but worth confirming
this is the intended measure.

LOW — the Phase 6.1 taxonomy gate is rendered via AskUserQuestion, which always surfaces an "Other"
choice in addition to the three graded options AC2 names. Not a contradiction — the epic's own Phase 6
convention documents "Other" as always available and it is not one of the taxonomy options — but the
literal "exactly three options" reads against a four-button prompt.
