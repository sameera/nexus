---
date: 2026-07-03
epic: "Prime Server Runtime Foundation"
source: "#15"
---

# Lesson: Front-loading the riskiest story de-risked the whole L epic

Sized L (1–2 weeks) with an explicit zero-slack utilization warning, the epic
named its own critical path up front: the Nx target replacement in Story 1 (no
first-party Nx plugin understands RR8 framework mode, so build/dev/preview and
test inference had to be hand-rewritten with no reference implementation). That
call held. The foundation story landed first and the three dependent stories
(chrome SSR, terminal client-only, stack doc) followed without compression —
the shipped code matched the decision record on every invariant, with a single
minor deviation (no `serve` target; `dev`+`preview` covered it).

For the next epic in this area:

- **Keep pre-identifying the "no reference implementation" story and sequencing
  it first.** The risk analysis paid off precisely because the unknown work was
  prototyped before the dependent stories committed to it. Repeat that pattern
  for any migration where the build/infra layer has no framework-aware tooling.
- **Trust the L sizing on framework-mode migrations — do not undersize.** The
  L held with no overrun; the zero-slack warning was accurate, not pessimistic.
- **Watch for planned target sets that don't survive contact.** The decision
  record's `build/serve/dev/preview` became `build/dev/preview/typecheck` in
  practice. Cheap to reconcile, but a reminder that Nx target lists are best
  finalized while prototyping the run-commands, not during planning.
