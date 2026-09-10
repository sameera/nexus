---
date: 2026-09-10
epic: "Analyze a Member Story Pull Request From the Hub"
source: "#211"
---

# Lesson: An invariant with no story to land it is unowned work

Epic #211 was sized M with three stories, and all three landed. The epic's decision record also
stated sixteen invariants, and three of those invariants describe a trust boundary that no story
carried as acceptance criteria. Those three shipped incomplete. The post-merge conformance pass
found all three, and the epic closed on an explicit waiver with two critical findings open.

The pattern is worth naming, because it is not an estimation miss. Every story's acceptance
criteria were met, at 4/4, 4/4 and 2/3. The work that did not land was the work that lived only in
the invariants list. An invariant reads like a constraint on how the stories are built, so nobody
plans it as work, and nothing fails when it is skipped. The next epic in this area should either
attach each trust-boundary invariant to a story's acceptance criteria, or file it as its own story.
Stating it once in the record is not enough to get it built.

## The decision record's own risks predicted the rework, and did not prevent it

Record #495 carried two ADDRESS risks. Both fired.

The first predicted that cross-repository linked-issue queries would return nothing, leaving the
flow silently dependent on the branch-name rung. That happened. The mitigation the record named was
to state an issue-numbered branch-name convention for member repositories. That is not the
mitigation that shipped. Implementation added a commit-trailer rung to the candidate ladder
instead, which is the better answer, and it was designed during implementation rather than during
planning.

The second predicted that correcting the configuration root would change shipped single-repository
and hub behaviour, and asked for a test pinning the boundary. The test was never written, and that
is one of the two critical findings the close waived.

An ADDRESS risk names a mitigation that no story owns. The mitigation therefore gets resolved
reactively, at implementation time, by whoever hits the problem. When the mitigation is real work,
the next epic should carry it as a story rather than as a risk note.

## The repository's implementation tooling contradicted the epic's planning model

This epic planned for an epic's stories to arrive as separate pull requests, and its decision
record reasoned throughout about per-story verdicts. The epic then shipped as a single branch
carrying all three stories, named after the epic, because that is what `utils/implement-epic.sh`
produces.

That contradiction was not free. The candidate ladder had to gain an epic-level terminal answer and
a classification-based kind check after the first analyze pass had already run, and those
corrections are two of the four decisions this close records as superseding the record. Three
minor releases, 0.14.0 through 0.16.0, all landed in one pull request as a result.

Before the next epic in this area is planned, decide which shape the work actually arrives in and
make the tooling and the plan agree. Planning for per-story pull requests while the branch script
produces epic-level ones guarantees a mid-epic redesign of anything that resolves a pull request to
a story.
