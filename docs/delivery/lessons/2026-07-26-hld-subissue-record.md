---
date: 2026-07-26
epic: "The Decision Record Becomes an Approvable Sub-Issue"
source: "#139"
---

# Lesson: Prose commands are the program — budget review depth there, not in the tested code

The PR #148 review's own summary holds the lesson: "the problems are almost entirely in the prose
commands — which in this repo *are* the program." The TypeScript and Python surfaces shipped clean
(962 tests green, 95%+ coverage, zero blocking findings); both blocking findings and most of the
mediums were in the `.claude/commands/*.md` prose — phases entered as entry points without the
phases that produce their inputs, a stale stub contradicting the file's own updated contract, a
label lifecycle asserting approval before the approval act. Test-first development never touches
these files, so human review is their *only* gate. For future epics whose surface is mostly prose
commands (this one rewrote six), plan the review as the main quality phase and expect the
edit-distance between "described" and "executable" to be where defects concentrate — a phase jump
in prose is the same bug as an uninitialized variable in code, but no test will ever catch it.

Two smaller observations:

- **A bootstrap epic runs on the contract it replaces.** This epic gave decision records a durable
  home, but its own record predated the mechanism and lived in gitignored scratch — so its close ran
  the downgraded pass and its rationale survives only through this close record's prose. When an
  epic changes a pipeline contract, decide up front whether to back-fill the new mechanism for the
  epic itself (here: filing its record as a sub-issue mid-flight once Story 4 landed would have made
  it its own first consumer) or accept the old-contract close and capture the *why* redundantly.
- **The L assessment priced structural risk, not calendar time.** Rated L (1–2 weeks, utilization
  warning) for six interlocked surfaces and a hash contract that had to freeze early; it merged in
  two days. The complexity drivers were real — they showed up as review findings and a scope edit,
  not as duration. Keep rating on interlock (it correctly forced a decision record and an early
  canonicalisation freeze), but don't let the size letter imply schedule.
