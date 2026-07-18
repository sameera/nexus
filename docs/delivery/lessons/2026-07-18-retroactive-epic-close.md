---
date: 2026-07-18
epic: "Committed Queue Scratch Capture"
source: "#67"
---

# Lesson: Retroactive epics close clean when the diff matches, but the process gates fight you

This epic documented a change that was **already implemented** — `CLAUDE.md` and several
`.claude/commands/*.md` files already carried the new committed-scratch contract before the epic,
decision record, or story issues existed. The planning artifacts were written afterward to give the
shipped change a record the pipeline could close and distill.

What the retroactive path cost, for the next PM estimating a "document-what-shipped" epic:

- **The analyze gate fires on process state, not code.** `/nxs.analyze` found full code conformance
  (5/5 stories met, all 8 invariants held) yet still raised a HIGH — because the story issues were
  open and the change was uncommitted at analyze time. On a retroactive epic the code is done before
  the issues exist, so the gate's process precondition is guaranteed to trip first. Expect one waiver
  or one commit-then-reanalyze cycle purely to satisfy sequencing, not quality.
- **Sequence the bookkeeping: commit + close issues *before* analyze, or accept a stale receipt.**
  Here the receipt ran at `b88edc2`, then the implementing commit `f044886` landed, making the
  receipt both stale (1 commit after) and carrying the now-resolved HIGH. Both conditions described
  the same fact. Running analyze *after* the commit and issue-close would have produced a single clean
  receipt and no waiver.
- **Deviation-hunting is cheap when there is no branch.** With the whole change in one squashed-style
  commit on `main` and no in-flight scratch, the close-from-diff pass had nothing to reconcile — the
  decision record and the diff agreed line-for-line. The only judgement calls were incidental changes
  bundled into the commit (a manual-slide rewrite that was in-intent; an unrelated `docs/TODO.md`
  toggle that was noise).

Takeaway for the next epic in this area: if you must write the epic after the code, do the GitHub
bookkeeping (commit, close story issues) **before** running `/nxs.analyze`, so the conformance receipt
is clean and current and `/nxs.close` needs no analyze waiver.
