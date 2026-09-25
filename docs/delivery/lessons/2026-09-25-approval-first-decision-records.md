---
date: 2026-09-25
epic: "Decision Records That Are Quick to Review and Hide No Gaps"
source: "#787"
---

# Lesson: an L estimate on a format change, and a BLOCKER that nobody had to clear

## Estimate vs actual

Sized **L — 1–2 weeks**, with the utilization warning that it fills the sprint with no slack. Five
stories (M, M, M, S, M) planned, decomposed, recorded, implemented, analyzed and merged in a single
sitting, as one pull request.

The complexity drivers were right about the shape — four record-shape surfaces changing together, a
checkpoint parser reading exact headings, three downstream stages reading the record — and wrong
about the cost. Every one of those surfaces is prose or a pure text checker with a fixture. Nothing
in the epic touched a running system, a data migration or a schema. The next epic in this area
should size "N surfaces must change together" by whether the surfaces are *prose and pure
functions* or *stateful code*: the former is wide but shallow, and agent-driven implementation
collapses width almost for free. Reserve L for depth, not breadth.

## Decomposition

Five stories produced one pull request. The story boundaries were real as *review* units — each
named a separately checkable behaviour, and the conformance verdict scored all five independently
(6/6, 5/5, 5/5, 4/4, 5/5) — but they were not shipping units. The sequencing table said as much:
#789, #790 and #791 all hang off #788, and #792 off #789, so nothing could land until the drafting
change did.

That is a fine outcome, but it means the close path had to reach for the storyless-story waiver and
the multi-PR merge gate found nothing to gate. When the sequence is a single chain rooted in one
story, say so at planning and expect one pull request, rather than discovering it at close.

## The pending amendment nobody had to clear

The record filed two exact wording changes it promised to make — to #791's fourth criterion and to
#787's second assumption — and recorded both as `pending`, listed first under "Resolve before
approval". The epic then put *holding approval while a pending amendment remains* explicitly out of
scope. So the record was approved with both open, analyze reported them as still pending, the epic
merged, and close found them still unapplied.

Every mechanism worked exactly as designed. The gap is that "Resolve before approval" is the one
group in the new brief with no gate behind it: the checkpoint blocks a pending change that is
*missing* from that group, and permits any number of them that are *listed* in it. The group is
therefore a promise to the reviewer, not a precondition, and a reviewer who approves the whole
record approves the promise too.

Two things follow for the next epic here. First, the out-of-scope line that deferred the hold should
become an issue, not a sentence — the deferred-scope stub (#793) covers the cold read, not this.
Second, until a hold exists, the lead's own approval step is the only thing standing between a
listed BLOCKER and a closed epic; close can report it, which it now does in the deviation
rationale, but it reports it after the code has merged.
