---
epic: "#101"
date: 2026-07-20
head: 717ec0f
mode: full
findings: { critical: 0, high: 0, medium: 0, low: 1 }
---

Conformance: PR-Driven Post-Merge Flow for Analyze, Close, and Distill (pr-driven-flow-6eaa19ec)  ·  epic #101
Mode: full
Surface: 31 files changed, 6 stories (6 closed / 0 open)

Per-story AC conformance:
  STORY 1 PR/worktree helper library:      4/4 met · 0 partial · 0 unmet · 0 contradicted
  STORY 2 Helper skill (CLI shim):         2/2 met · 0 partial · 0 unmet · 0 contradicted
  STORY 3 /nxs.analyze --pr <N>:           3/3 met · 0 partial · 0 unmet · 0 contradicted
  STORY 4 /nxs.close --pr <N>:             4/4 met · 0 partial · 0 unmet · 0 contradicted
  STORY 5 /nxs.distill range-first + cont.: 2/2 met · 0 partial · 0 unmet · 0 contradicted
  STORY 6 /nxs.hld --from <path>:          2/2 met · 0 partial · 0 unmet · 0 contradicted

Invariant violations:   none. Note (low): invariant 3 ("local drain behaves exactly as before")
  is worded more strongly than the change it accompanies — STORY 5 reorders the ordinary single-repo
  drain to range-first (was introducing-commit-first). The code faithfully implements the decision
  record's explicit "Make the drain range-first" decision + STORY 5 AC1; for a normally-merged entry
  the derived diff is identical, diverging only for a legacy entry whose recorded range and
  introducing commit differ. A planning-wording tension, not a code defect.
Success metrics:
  1. Analyze/close/distill run against a PR w/ no manual range computation → measurable (helper
     stamps the range) · plausibly moved.
  2. Range correct for squash/merge/rebase (proven by tests) → measurable (range.spec.ts covers all
     three real topologies) · met.
  3. Member rejected for --pr; single-repo/hub supported; local + migration flows regression-green →
     rejection is unit-tested (identity.spec.ts); the "local/migration unchanged" regression claim
     is a test-suite outcome, not readable from the diff (defer to nxs-qa).
  4. Out-of-band design doc seeds a record via --from → code path exists (hld.md import mode); it is
     LLM-executed spec prose with no unit test, demonstrable only by a live invocation (the epic's
     own Risks already flag "no live end-to-end PR test in the build environment").
Scope drift:            none material; STORY 5's range-first change touches the ordinary drain but is
  explicitly called for by STORY 5 AC1, so it is in-scope, not drift.

Severity: ⛔ critical 0 · ⚠️ high 0 · medium 0 · low 1
