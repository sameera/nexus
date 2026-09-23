---
date: 2026-09-21
epic: "A Published Verdict's Story Numbers Name the Repository They Belong To"
source: "#751"
---

# Lesson: a medium finding that cites a record invariant is not advisory

The unattended implementation loop runs fix-and-re-analyze rounds until the conformance verdict carries no critical and no high finding. Medium and low never gate. That is the right default for most findings, and it was wrong for this one.

The verdict on the first certified commit carried a single medium: the epic-wide derivation computed the candidates it dropped and then discarded them on three of its five printed states, while both stage prompts told their reader that every state carries them. The finding named record #764's invariant 12 by number. The loop shipped past it, marked the pull request ready, and the epic would have closed on a verdict that said the derivation names its dropped candidates when it did not on the path a lead actually reads.

Two things follow.

**Severity is about blast radius; citation is about conformance.** A finding that names an invariant is saying the build does not do what the approved design said, whatever damage that does today. The gate already distinguishes "invariant violations" from graded findings, and this one arrived graded because its consequence was information loss rather than a wrong verdict. Whether a finding cites an invariant is mechanical and could gate on its own, separately from severity.

**The loop's gate should be stated where the epic is planned, not only in the script.** Nothing in the epic or the record said "critical and high block, medium does not". The lead who reads a clean close has no way to know a medium was passed over unless they open the superseded verdict. Either the loop gates on invariant-citing findings too, or a close record states which findings were left standing and why.

A third thing, smaller and worth saying plainly: the medium was found because the local receipt was read alongside the published one. The published verdict for the same commit graded the same two observations as prose under "worth a look, neither a finding". That is the second time in one sitting the two analyze modes disagreed about severity on the same commit — the earlier case is in `2026-09-21-one-definition-claimed-is-not-one-definition-held.md`. Twice is a pattern, not a coincidence.
