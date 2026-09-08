---
date: 2026-09-07
epic: "One session teaches one lesson, written on arrival"
source: "#407"
---

# Lesson: risks the record only names are design work deferred into the build

## Estimate versus actual

Assessed **L (1–2 weeks)** on six stories, four of them M, with an explicit utilization warning that
the sprint had no slack. It landed in one working day across nine commits. The complexity drivers
were read as independent costs, but four of the six stories are phases of one chain sharing one
data structure and one test harness, so the second phase cost a fraction of the first. The driver
list should distinguish *stories that interlock* — which the assessment counted as a cost — from
*stories that share a mechanism*, which is a discount. Here it was the second, and the same shape
will recur across this feature's remaining epics.

## Where the time actually went

Not on the six stories. Three of the five recorded deviations exist because record #469 named an
ADDRESS risk without deciding what would satisfy it, and the build had to design the answer:

- "Prove the probe against this repository's own suite first, and decide the stated fallback" became
  a third fence state, an optional `probe_control` test in the plan schema, and a new
  `proven | unrunnable | unproven` verdict.
- "Measure the wait before the epic closes" was a genuine measurement task with a real chance of
  reopening the record.
- The fence's advisory nature forced a whole quoting-and-marker mechanism into the handoff prompt,
  because invariant 16 had no mechanism at all while nothing was being quoted.

An ADDRESS risk that ends in "decide X in the build" is a decision the record deferred, not a risk
it managed. It costs the same as a key decision but arrives without an approval gate, and it lands
as a deviation at close. **The next epic in this area should promote any ADDRESS risk whose remedy
is a named mechanism into a key decision at record time**, and keep ADDRESS for risks that are
genuinely accepted or genuinely monitored.

## The "one signal" decision was one story short

Record #469 decided the learner records "contribute one signal … used to rank a drill that is
already eligible". That reads clean against story #462, the drill story. It cannot serve story
#463's second criterion at all, because invariant 21 excludes from the drill exactly the concepts
that criterion is about — the ones from the lesson just finished. The contradiction was visible in
the record itself, between a decision and an invariant, and no gate caught it: the decision and the
invariant were checked against the epic, not against each other. A record whose invariants are
numbered and whose decisions are prose should have one pass that reads each invariant against each
decision it touches.

## Delivery: PR #476 merged six of nine commits

The pull request merged at `3a37622`, leaving `ac61968`, `9e494af` and `c087eab` — the whole session
chain, `teaching-session.ts` and `workbook-plan.ts` included — on the feature branch with no open
PR carrying them. `main` currently holds roughly a third of this epic.

Two process consequences:

1. **A merged PR is not evidence the epic landed.** The analyze receipt was taken at `c087eab` and
   read clean; nothing in the pipeline compared that SHA against what the merge actually contained.
2. **`git merge-base HEAD origin/main` is the wrong base after a partial merge.** It returns
   `3a37622`, the merged tip, so a close run by the literal formula would have diffed only the last
   three commits and reported a clean deviation pass over two thirds of an epic it never looked at.
   This close used the branch's actual fork point, `37202f78`, which is what the stamped range
   carries.

The remaining commits still need to reach `main` before `/nxs.distill` drains this entry against a
trunk that matches the close record's range.
