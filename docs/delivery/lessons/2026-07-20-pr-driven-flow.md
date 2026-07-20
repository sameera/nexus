---
date: 2026-07-20
epic: "PR-Driven Post-Merge Flow for Analyze, Close, and Distill"
source: "#101"
---

# Lesson: Isolate the deterministic must-be-correct part into a tested helper — but that green suite is not the live-integration acceptance

The decomposition worked the way it was drawn. The genuinely hard, must-be-exactly-correct concern
— the merge-strategy-safe range derivation and the worktree lifecycle — was pulled into one tested
helper library (STORY 1, M) with a thin CLI shim (STORY 2, S) before any command spec was touched.
That paid off downstream exactly as intended: the three command-spec forks (analyze, close, distill —
STORY 3/4/5) collapsed to declarative calls into the helper, and the independent import-bridge story
(STORY 6) rode alongside with no coupling. Analyze came back clean: 17/17 acceptance criteria met,
no invariant violations, the close-from-diff pass found zero deviations. An L epic that lands with a
matched implementation and a green suite is the shape you want.

**Estimation takeaway for the next epic that adds a git/`gh`-choreography capability (worktrees, PR
lookups, merge-range math):** the two moves compound, so plan for both. First, budget the
verification-critical mechanics as their own early story sized on correctness, not line count — the
range helper was small in code but carried the epic's whole correctness risk (squash vs rebase
indistinguishable by topology), and isolating it first is what let the spec edits stay thin. Second,
and this is the residual risk the green suite hides: unit tests with injected runners and real git
topologies prove the *logic*, not the *integration*. This epic shipped with no live end-to-end PR
run in the build environment — success metric 4 (the `--from` import) and the whole PR path are only
demonstrable by a real invocation, which the epic's own Risks flagged. "All ACs met + tests green"
is not "verified against a real PR." Size a live acceptance dry-run against a scratch hosted repo as
an explicit line item for any epic whose core value is external-tool choreography; do not let the
unit suite stand in for it.
