---
epic: "#114"
date: 2026-07-22
head: 7a4a67b
mode: full
findings: { critical: 0, high: 1, medium: 2, low: 1 }
---

Conformance: Issue-Sourced Planning: Nothing Commits Until Close (issue-sourced-planning-68be4a6b)  ·  epic #114
Mode: full (decision-record.md present, 18 invariants)
Surface: 41 files changed, 5 stories (1 closed / 4 open) · code committed locally (HEAD 6 commits ahead of origin/main), not pushed/merged

Per-story AC conformance (verdicts from the committed diff, not issue state):
  STORY 1 resolver rebuilds an epic:        4/4 met · 0 partial · 0 unmet · 0 contradicted   (all 4 ACs directly unit-tested)
  STORY 2 planning files, commits nothing:  4/4 met · 0 partial · 0 unmet · 0 contradicted
  STORY 3 /nxs.epic --from:                 3/3 met · 0 partial · 0 unmet · 0 contradicted
  STORY 4 hld & analyze read via resolver:  3/3 met · 0 partial · 0 unmet · 0 contradicted
  STORY 5 queue entry born at close:        3/3 met · 0 partial · 0 unmet · 0 contradicted   (AC2 caveat below)

Invariant violations:   none (all 18 constraints in decision-record.md hold against the diff)

Success metrics:
  1 zero new queue files after /nxs.epic   → measurable (git status); moved — planning writes to session scratch (nxs.epic Phase 4)
  2 hld/analyze zero committed-file reads   → measurable (path taken); moved — dual-read resolver path (Story 4)
  3 resolver twice = byte-identical         → measurable + directly tested (serialize/resolve determinism specs); strongly met
  4 100% trunk queue entries carry close rec → measurable (scan); NOT yet demonstrable on trunk — this epic's own old-contract entry has no close-record.md (expected per the migration Assumption; #114 predates the new contract)
  5 --from #<issue> → epic.md hld accepts   → measurable (run); moved — --from → resolver, hld dual-read + complexity-default-L for hand-filed epics

Scope drift:
  - .nexus/queue/sequencing.md — a committed roadmap doc at the queue ROOT (not an epic entry); no story called for it. Informational; not an entry the distiller globs.
  - docs/features/multi-repo-workspaces/backlog.md (+195) — the deferred-scope stubs named in Out of Scope. Expected.

Gating findings:
  ⚠️ HIGH  — 4 of 5 story issues OPEN (#116, #117, #118, #119) and epic #114 OPEN. /nxs.close hard-blocks
             until every child story is closed. Code is committed on local main but not pushed/merged. Not ready to close.
  medium   — committed epic.md's story↔issue-number mapping has drifted from the live GitHub issues. epic.md's
             Implementation Sequence maps STORY-114.02→#116, .03→#117, .04→#118, .05→#119, but the live issue
             titles at those numbers are Story 4, Story 5, Story 3, Story 2 respectively. The native blocked_by edges
             follow epic.md's NUMERIC table (e.g. #119 blocked_by #115,#116,#117), so read against the live titles the
             graph is incoherent (the "planning" story #119 appears blocked_by "hld/analyze" #116 and "born-at-close"
             #117). #114 is old-contract so its own pipeline reads the committed epic.md and is unaffected, but this is
             the exact two-copy drift the epic set out to eliminate — appearing in the epic's own planning artifacts.
  low      — see sequencing.md under Scope drift.

Severity: ⛔ critical 0 · ⚠️ high 1 · medium 2 · low 1
