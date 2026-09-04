---
date: 2026-09-04
epic: "Planning Carries Only Asked-For Scope"
source: "#284"
---

# Lesson: a rule set is only as wide as the parser that enforces it

The epic was assessed L over five stories and shipped six, after a mid-flight revision added #424
and re-sized #287. The record's own second ADDRESS risk called this out before implementation began
and asked for a decision — re-derive the rollup, split, or defer a story — and no decision was taken;
the work simply proceeded and the epic's utilization banner still quotes the five-story assessment.
The re-derivation rule this epic invented for whole-story *cuts* has no counterpart for whole-story
*additions*, which is the direction scope actually moved. The next epic in this area should treat a
story added after the record is approved as the same trigger a cut is: re-derive the rollup, and
re-derive or remove the banner.

The substantive lesson is about where enforcement lives. This epic's premise is that an instruction a
model can drop is not a guarantee, and it built a shared checker to replace three such instructions.
Two of the four gaps found at the conformance gate are the same shape: the checker enforces the rules
on the document shape it was written against — an epic — and the two neighbouring stages that adopt
the rules have document shapes it cannot parse, so for them the shared checker degrades to a citation
test and the rest of the rule set falls back to exactly the instruction the epic set out to replace.
The story that adopted the rules elsewhere (#289) was sized S on the reasoning that it "adds no rule
of its own and implements no check of its own", and that reasoning was right about scope and wrong
about outcome.

For estimation: when a story's value is "the same rules now apply over there", size the parser work
that makes that true, not the wiring. A story that only invokes a shared component inherits that
component's blind spots along with its guarantees, and the blind spots are invisible in the story's
own acceptance criteria — every criterion #289 wrote is about what the draft carries, and none is
about what the check can see.

A smaller sequencing note that worked: `razor-check` shipped in the first story carrying assertion
mode alone, and the second story added counting and citations to the same verb. That kept every
story's promise enforceable at the moment it shipped, instead of leaving the first story's guarantee
resting on a later story's arrival. Worth repeating whenever a rule and its enforcer are split across
stories.
