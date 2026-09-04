---
title: "Close Record: Retire the Sequencing Page Into Issue State"
epic: "#218"
feature: "Issue-Sourced Planning"
date: 2026-09-04
nexus_version: 0.1.0
analyze: ran 2026-09-04 @ 4b96c5ac5b1cb338f2bde00294c2c2d64541bfd5
range:
  - repo: github.com/sameera/nexus
    base: c1cebd00113801acd5ae37519b36668aaf2dbd1b
    head: 1e54f6ec088031bc300a4a986f167d385544c90f
---

# Close Record: Retire the Sequencing Page Into Issue State

## Key Decisions

- **Rationale was moved only onto stubs that did not already carry it.** Of the eight
  still-open stubs the page held rationale for, only #132, #215 and #216 received a new
  attributed note; #209, #211, #212, #213 and #214 were verified to already carry the
  reasoning, or to express it as a native `blocked_by` edge, and were left untouched. A
  duplicated note would make the stub body the next surface needing hand-reconciliation —
  precisely the cost this epic exists to remove. *Refuted alternative:* copy every wave-table
  row's rationale onto its stub verbatim, so the move is mechanical and needs no per-line
  judgement.

- **The proof that no rationale line was lost lives in ephemeral branch scratch, not a
  committed ledger.** The line-by-line accounting was written to `notes-<branch>.md`, which the
  distiller deletes with the entry, rather than to a tracked document. The epic puts "any
  replacement for the sequencing page, in any form" out of scope, and a permanent accounting
  file is that replacement under another name; ephemeral scratch still gives the reviewer the
  full audit at review time. *Refuted alternative:* a short `docs/delivery/` accounting note
  recording where each line went, kept permanently.

- **The retirement is a pure deletion — no content was relocated to another tracked file.**
  The net change to tracked, non-scratch content is a single 99-line deletion. Every surviving
  piece of the page went to a GitHub issue body or was already expressed as an issue
  dependency edge; nothing landed in a new or existing document. This is what makes the
  backlog query sufficient on its own rather than merely primary. *Refuted alternative:* a
  narrowed successor page carrying just the wave narrative, which would have preserved the
  hand-reconciliation cost the epic was retiring.

## Deviation Rationale

The epic has no decision record, so deviations were derived against the epic's own stated
approach, success metrics and scope (downgraded — no invariant check).

- **The "no reference from any tracked file" success metric is not literally met.** Path
  references to the deleted page are zero, but `docs/delivery/lessons/2026-07-22-issue-sourced-planning.md:42`
  still names `sequencing.md` in past tense. The metric was read as written, the mention is a
  known miss, and removing it was judged not worth reopening a historical lesson — the epic's
  own Out of Scope excludes editing those files.

- **Two of the four drop/supersession verdicts required no issue-state change.** The page
  declared #197, #109, `hub-design-gate` and `entry-abandonment` dead. Only #197 needed action
  (now CLOSED / not planned, with the drop rationale as a comment); #109 was already closed;
  `hub-design-gate` and `entry-abandonment` were never filed as issues at all. Both
  supersessions are already recorded on the closed issues that superseded them (#139 and
  #114), so confirming that no open issue carries the name was the whole of the work and
  nothing new was written for them.

- **Commit `f31b368` rode the PR with zero net effect on the change set.** It moves the
  delivery-plan skill into the authored component tree and no story called for it. A
  pre-existing red suite on `main` blocked the branch, so the fix was made here to get green;
  `main` then landed the same change independently and the merge at `4b96c5a` took main's
  side, leaving the commit contributing nothing to the landed diff. Recorded so a reader is
  not surprised that the commit vanishes from the change set.

## Deferred Scope

none

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-09-04-sequencing-page-retirement.md`
