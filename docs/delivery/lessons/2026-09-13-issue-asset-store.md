---
date: 2026-09-13
epic: "Durable asset store for filed issues"
source: "#594"
---

# Lesson: a record's risk mitigation needs an owner, or it does not happen

The record for this epic carried one ADDRESS risk with an explicit instruction: verify that a
private store's image renders inline in an issue in another repository, before story #597 is
implemented, and fall back to a plain link if it does not. Story #597 shipped, the epic passed its
conformance gate with zero critical and zero high findings, and the verification never ran. Nothing
in the pipeline noticed. The analyze stage reported it honestly as unverifiable from the diff,
because a renderer's behaviour is not something a diff can show, and the close stage was the first
place a human was asked about it.

The gap is structural, not a lapse. A risk written as "verify X before story #<n>" names a
precondition for a story, but nothing carries it to that story. The story's acceptance criteria were
met as written, and the criteria are what every gate reads. A risk mitigation that lives only in the
record's Risks section is invisible to every stage after the record is approved.

What the next epic in this area should do differently: when a record's risk names work that must
happen before a specific story, put that work into the story's acceptance criteria, or file it as
its own story ahead of the one it gates. A criterion is read by the epic gate, by the implementer
and by the conformance check. A sentence in Risks is read once, at approval, by the person who
wrote it.

The rest of the epic ran close to plan. The estimate was M and the work landed as five stories in
one pull request, with two small deviations from the record, both of them refinements the record's
wording did not anticipate rather than changes to what it decided. The one that cost real time was
substring matching: the record said the assertion matches declared paths "exactly", which sounds
settled until the published address of `assets/flow.png` under a feature named `issue-assets` ends
in `issue-assets/flow.png` and the rewrite starts eating its own output. A record that specifies a
matching rule should say what the match boundaries are, because "exactly" does not answer it.
