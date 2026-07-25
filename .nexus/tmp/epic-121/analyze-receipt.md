---
epic: "#121"
date: 2026-07-23
head: 0de048f
mode: full
findings: { critical: 0, high: 0, medium: 0, low: 0 }
---

Conformance: GitHub Publishing Config (.nexus/tmp/epic-121)  ·  epic #121
Mode: full
Surface: 18 files changed, 7 stories (7 closed / 0 open)

Per-story AC conformance:
  STORY-121.01 Single shared config resolver:            3/3 met · 0 partial · 0 unmet · 0 contradicted
  STORY-121.02 Declared classification mode:             5/5 met · 0 partial · 0 unmet · 0 contradicted
  STORY-121.03 Project V2 target none|auto|explicit:     3/3 met · 0 partial · 0 unmet · 0 contradicted
  STORY-121.04 Uniform resolver precedence:              3/3 met · 0 partial · 0 unmet · 0 contradicted
  STORY-121.05 Workspace defaults + repo targeting:      3/3 met · 0 partial · 0 unmet · 0 contradicted
  STORY-121.06 /nxs.setup seeds the github: block:       3/3 met · 0 partial · 0 unmet · 0 contradicted
  STORY-121.07 Persist resolved defaults (write-back):   3/3 met · 0 partial · 0 unmet · 0 contradicted

Invariant violations:   none (all 10 decision-record invariants hold)
Success metrics:        1 no-block parity          → measurable (parity tests + legacy-auto path)  · plausibly moved
                        2 single module, zero dup  → measurable (grep + guard test) · met
                        3 no-crash on bare repo     → measurable (labels fallback + none path + ensure-label) · plausibly moved
                        4 four-consumer equivalence → measurable (shared module + resolve CLI) · plausibly moved
                        5 epic label pre-exists     → measurable (ensure_label upsert) · plausibly moved
                        6 probe/discovery once/repo → measurable (write-back integration test) · plausibly moved
Scope drift:            (info) gh helpers (ensure_label/lookup_issue_type_id/set_issue_type/repo_has_issue_types)
                        centralized into the shared module beyond Story 1's literal "config reader" — serves the
                        anti-copy-paste thesis + Invariant 8; beneficial, no invariant broken.
                        (info) legacy-auto fallback label is always the resolved epic-label (default `epic`), not the
                        old `frontmatter-type.lower()`; within the intended enhancement→epic change (Story 2 / DR).
                        (info) Story 7 AC1 text names "the resolved issues-repo" among persisted values, but the code
                        deliberately never writes issues-repo/epic-repo/story-repo — following Invariant 6 and the
                        epic's resolved Open Clarification (write-back never pins "current repo"). Conformant to intent.

Severity: ⛔ critical 0 · ⚠️ high 0 · medium 0 · low 0
