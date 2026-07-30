---
date: 2026-07-30
epic: "Tmp-First Analyze & Close Artifacts, with GitHub Fallback for Distill"
source: "#170"
---

# Lesson: decompose from the durability boundary, not from the file placement

## Estimate vs. actual

Assessed **L** (1–2 weeks) with an explicit "no slack" warning, and delivered in a single day
across five stories. The assessment was wrong in an instructive direction: the epic's own
complexity drivers named "three-command contract change" and "durability-model change", but four
of the five stories turned out to be prose edits to command specs. Only story #175 carried real
code (the migration helper). An epic whose surface is mostly prompt-spec text should be sized on
the number of *decisions* it forces, not the number of commands it touches.

## What the decision record caught that decomposition missed

The epic was written from the symptom — `close-record.md` lands in a path nothing commits — so its
acceptance criteria described **file placement**. The real decision was one level up: *what is the
durable copy of a close's rationale?* Once record #176 answered that (the epic issue's close
comment, in every mode), four of the epic's ACs turned out to be wrong as filed, and the record had
to rewrite them:

- Story #173's "skip the committed deletion" would have left every closed epic's per-user scratch
  stranded on the trunk with nothing to ever delete it — a permanent leak, by design.
- Story #173's merge precondition, specified as range-head reachability alone, fires on the
  *normal* path: a local close stamps the pre-merge branch tip, which a squash or rebase merge
  never lands on the trunk. It would have trained the operator to waive the gate, destroying it.
- Story #174's third AC rested on a false premise — that a local close leaves no GitHub surface to
  recover from. It does: the same close comment.
- Story #174's fourth AC offered a hard-block-vs-degraded-drain either/or that resolved to neither.

Two story issues (#173, #174) had to be re-filed mid-flight to carry the ratified bodies. That is
the gate working, but it is expensive: the ACs were re-litigated after the stories were already
filed as issues.

**For the next epic in this area:** name the durability boundary — what is authoritative, what is
derived, what is disposable — in the epic's Description, and decompose from that. Where an epic's
premise is "artifact X moves", state what depends on X surviving *before* writing acceptance
criteria about where X lives.

## Unplanned scope rode a no-slack branch

Two items landed that no story called for: a general-purpose headless-implementation script
(`utils/implement-epic.sh`, +169) and a bundle-fingerprint re-pin. Neither is harmful — the script
is deliberately retained — but both surfaced at *close*, in the diff pass, rather than in review.
The fingerprint re-pin also didn't hold: the bundle embeds the very command files this epic
rewrote, so later commits re-staled it and left a test red on main.

**For the next epic:** on a branch assessed with no slack, land unrelated tooling and housekeeping
as their own commits on their own branch. A re-pin of a fingerprint that hashes files the branch is
actively rewriting is guaranteed to be stale by the time the branch merges — sequence it after the
last content commit, or leave it out.

## The conformance gate has a mode gap worth knowing

Analyze was run locally against the branch while the work shipped through a PR, so `/nxs.close --pr`
found no machine block on the PR and classified the gate as `missing` — even though a current,
matching receipt existed on disk at exactly the PR head. The gate was resolved by inspection.
Running `/nxs.analyze --pr <N>` rather than locally, when the epic is going to close through a PR,
avoids the manual reconciliation.
