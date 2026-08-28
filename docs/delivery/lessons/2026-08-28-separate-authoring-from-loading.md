---
date: 2026-08-28
epic: "Separate authoring from loading in the Nexus repository"
source: "#256"
---

# Lesson: an inventory measured at planning time is stale by implementation time

Complexity was filed as **M** and delivered as M — four stories, four commits, no re-scoping. The
estimate held. What did not hold was the epic's *content*: two of its four stories were filed against
facts that had changed by the time anyone worked them.

## What went wrong, twice, in the same shape

**The call-site story shipped a hand-measured inventory of code that reaches the component tree.** It
was measured carefully, during gating, and it named three mechanisms in the test suite by which one
file reached the loaded path. By implementation time all three had been refactored away, and several
sites the list did not name had appeared. Working the list as written would have produced a green
suite and a wrong result.

**The gate story assumed a sibling epic had already shipped a read-out it needed.** The epic's
Assumptions section says the version verb reports which content is present, "from #251". It did not.
The gate story's third acceptance criterion was therefore unverifiable as filed — and this was the
*ordering-gate* story, the one whose whole purpose was to be provably true before the tree moved. The
gate would have been recorded as passed on a criterion nobody could check.

Both are the same failure: **a planning artifact encoding a measurement of a moving system as though
it were a fact about the system.** The decision record caught the first one and converted the story's
acceptance mechanism from a checklist into a derived standing check — which is why the epic shipped
right. Nothing caught the second one until the engineer hit it.

## What the next epic in this area should do differently

- **Prefer a derived check to an enumerated list, in the acceptance criteria themselves.** "No site
  outside this waiver set names the loaded directory" is checkable forever; "these four files must be
  updated" is checkable once and wrong thereafter. Where an epic files a measured inventory, treat it
  as *evidence that the problem exists*, never as the story's checklist — and say so in the story.
- **Cross-epic assumptions need a named issue and a verified state, not a citation.** "from #251" read
  as settled because it named an issue. Nothing checked whether #251 had actually shipped the thing
  being relied on. An assumption that some other epic already delivered a capability should be an
  explicit precondition acceptance criterion — the way this epic correctly did for #249's fourth
  story, and incorrectly did not for #251's read-out.
- **Draw story boundaries by "what breaks at the same instant", not by "what kind of file is this".**
  The record split sites between the move story and the call-site story by category — the pointing
  install to the move, "build, ship, gate and test sites" to the sweep. In practice four test sites
  fail the moment the tree moves, so the move story had to absorb them or land red. When a change is
  ordering-critical, the unit is the set of things that must be true simultaneously.

## What worked and is worth repeating

The epic's sharpest feature was making its ordering gate an **acceptance criterion with an
evidence-on-the-issue requirement**, not a note in the Description. That is what gave the move story
something to read rather than a memory to trust, and it is what surfaced the missing read-out early
enough to build it inside the gate rather than discover it after the move. The decision record then
extended the same requirement to the undocumented-harness assumption, which had been the one gate in
the epic with no evidence requirement at all.
