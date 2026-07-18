---
epic: "#67"
date: 2026-07-18
head: b88edc2
mode: full
findings: { critical: 0, high: 1, medium: 0, low: 0 }
---

Conformance: Committed Queue Scratch Capture (queue-scratch-capture-cc2c66fc)  ·  epic #67
Mode: full
Surface: 9 files changed (uncommitted working tree — retroactive epic, no branch diff), 5 stories (0 closed / 5 open)

Per-story AC conformance:
  STORY 1 (#68) Committed per-user scratch layout & authoring rule: 5/5 met · 0 partial · 0 unmet · 0 contradicted
  STORY 2 (#69) Close mines committed scratch and stops deleting:   4/4 met · 0 partial · 0 unmet · 0 contradicted
  STORY 3 (#70) Analyze reads PR-head scratch as soft context:      2/2 met · 0 partial · 0 unmet · 0 contradicted
  STORY 4 (#71) Distiller explicitly ignores per-user scratch:      3/3 met · 0 partial · 0 unmet · 0 contradicted
  STORY 5 (#72) Setup retires plan-capture hook & retargets seeds:  3/3 met · 0 partial · 0 unmet · 0 contradicted

Invariant violations:   none (all 8 decision-record invariants held)
Success metrics:        1) decision retrievable at analyze+close → moved (close globs ${QDIR}/*/decisions-*.md; analyze reads per-user scratch); measurable by inspection
                        2) zero scratch → concept store → moved (distill Phase-3 sources + constraint ban per-user paths); measurable in distillation-PR
                        3) close deletes no scratch → moved (rm -rf plans block removed from nxs.close.md); measurable by working-tree inspection post-close
                        4) no repo-wide opt-in; hook gone → moved (capture-plan.sh deleted; setup no longer seeds hook/opt-in); measurable by inspection
Scope drift:            manual/assets.html SCRATCH slide rewritten to committed model (no story AC named it; consistent with epic intent) · docs/TODO.md RR7 line toggled [x] (unrelated to this epic)

Severity: ⛔ critical 0 · ⚠️ high 1 · medium 0 · low 0

HIGH — All 5 story issues (#68–#72) are OPEN and the implementing changes are uncommitted in the
working tree. Code conformance is fully met (verified against the working-tree diff), but /nxs.close
hard-blocks until every child story issue is closed. Close the story issues and commit the change
before /nxs.close. This is a process-state block, not a code defect.
