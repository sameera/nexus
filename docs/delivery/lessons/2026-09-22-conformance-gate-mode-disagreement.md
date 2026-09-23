---
date: 2026-09-22
epic: "The Epic Issue Carries the Ledger of What Shipped"
source: "#769"
---

# Lesson: the two conformance modes disagreed twice, and both times the pull-request mode was right

This epic was implemented by an unattended loop that iterates against the local conformance mode and
then certifies once against the pull request. The local mode went clean after one fix round. The
certifying run then found a high finding the local run had not, twice in a row, at two different
commits.

Both findings were in the same place: a stage contract telling the lead to run a command in a shape
the command refuses. The local mode reads the branch diff and the epic. The pull-request mode builds
a worktree and can actually run the commands the contract names, so it caught an instruction that
does not work and the local mode could not. Neither finding was subtle once seen, and each would
have surfaced the first time somebody closed an epic whose code merged in a repository they did not
hold — which is the shape this epic exists to serve.

Two things to carry forward.

The certifying run is not a formality. Treating the local mode's clean result as the answer would
have shipped a close stage that could not open its own distillation worktree. Budget for the
certifying run to fail and for at least one fix round after it, rather than treating it as the last
green light before merge.

An epic that changes what a stage instructs should exercise the instruction. Six of the seven
stories were verifiable from the diff. The two defects were both in the gap between a contract's
prose and a command's actual argument handling, which nothing in the loop checks until a run tries
it. A story that rewrites a stage's instructions is worth sizing with that verification in it.

Estimate held: L was assessed at one to two weeks; the implementation loop, three conformance rounds
and the close ran in a single sitting. The complexity drivers were right about the shape — a
seven-story chain whose first observable outcome arrives at the third story — and wrong about the
duration, because none of the stories needed a human decision once the decision record was approved.
