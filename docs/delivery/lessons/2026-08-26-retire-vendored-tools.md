---
date: 2026-08-26
epic: "Retire the hub's vendored tools directory"
source: "#257"
---

# Lesson: A deletion epic's cost sits in the survivor, not the deleted thing

The epic was sized **S** on the grounds that it was a pure deletion with a migration
population of zero, and that estimate held: four stories landed in four commits, no
migration path was needed, no compatibility shim, no deprecation window. The discovery
that measured the population at zero before planning is what made that estimate safe,
and it is worth repeating for any retirement — measure the occupants first, then size.

What the estimate did not anticipate is where the judgement went. Three of the four
deviations recorded at close are boundary questions about the code and prose that
**survive**, not about the thing removed: how much vendoring-era vocabulary to rename,
whether one invocation form or two should remain, whether a file no story enumerated
should be touched. The deletion itself was mechanical. Deciding where the deletion stops
was not.

Two concrete lessons for the next retirement in this area:

- **Absence-assertion ACs must enumerate every record-category directory up front.**
  #296 AC4 searched for four named identifiers rather than the word "vendor" — the right
  instinct, since surviving code legitimately keeps vintage names. But it exempted only
  `docs/delivery/lessons/`, and the conformance analysis then found matches in
  `.nexus/discovery/`, forcing a mid-flight AC amendment. Records of what was true when
  written — delivery lessons, discovery stores, close records, concept Decision Logs —
  are all in the same category, and an AC that exempts one should exempt all of them by
  construction.

- **Sequencing the workspace-wide search last paid off.** #296 ran after the three
  narrower stories, and its cross-tree search caught what their local assertions could
  not: the discovery-store matches and the dangling README reference. A deletion epic
  should always end with a story whose assertion is over the whole tree, and that story
  should be allowed to touch files the earlier stories did not enumerate.

One process note: the epic ran with **no decision record**, so `/nxs.analyze` ran in
downgraded mode and `/nxs.close` had no invariants to check against. For an S-sized pure
deletion whose approach was fully settled by the preceding discovery, that was
proportionate — the two medium findings analyze did surface were both boundary questions
the close resolved as intended deviations, not defects. The signal to watch is the ratio:
when a "pure deletion" starts producing deviations about the survivor's shape, the next
one of these may deserve a short record naming the boundary before implementation starts.
