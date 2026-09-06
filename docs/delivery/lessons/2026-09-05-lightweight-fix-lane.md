---
date: 2026-09-05
epic: "A lightweight lane for small fixes to reach the concept store"
source: "#263"
---

# Lesson: an L epic that was mostly prose, and the two places that cost real time

## Estimate versus actual

Assessed **L** on four drivers: seven stories with four sized M, a rule spanning two commands,
surgical edits to two command definitions over a thousand lines each, and a new validator mode that
must not disturb the existing checks. The shipped change is 1248 insertions across 15 files, and it
landed in one branch with seven commits and no rework of an earlier story by a later one.

The L was defensible but the drivers were mis-weighted. Three of the four named prose surfaces, and
prose turned out to be the cheap half. The genuinely new code — the validator mode and the range
read — is about 220 lines of implementation against 530 lines of test. What made the epic an L was
not the volume of any one story; it was that the rule had to hold in two places at once, and only
one of them is code.

## What the decomposition got right

Story #265, the validator mode, has no dependency on any other story and was built first alongside
#264. That mattered more than the sequence table shows. The mode is the only part of the lane that
cannot be argued out of by a prompt, so building it before the command that would rely on it meant
the enforcement existed before anything could be written that needed enforcing. **The next epic in
this area should keep placing the mechanical gate first in the sequence, not last.** A gate written
after the thing it gates tends to be shaped to pass what already exists.

## What to do differently

**A story whose deliverable is a command body needs its verification method chosen at planning, not
at implementation.** Four of the seven stories deliver prose into a command definition. The
acceptance criteria for those read like code criteria — "given X, when Y, then the command refuses"
— but nothing in the plan said how a refusal stated in prose would be shown to hold. The answer
arrived during implementation as a body-reading spec that asserts against the authored markdown, and
it works, but it was invented under time pressure and it is now load-bearing for four stories. Decide
that at decomposition: either the rule lives in prose and a body-reading spec pins it, or the rule is
extracted into code. Leaving it open pushes an architectural choice into the last story that touches
it.

**Two acceptance criteria were written narrower than the invariant they served, and implementation
had to widen them.** Story #265 said the check reads the staged diff; the invariant it serves says
the check is total. Story #264 said existing subcommands are unchanged; the sane implementation moved
a helper out of one. Both widenings were correct and both were caught only at the close diff. The
pattern is that the story author wrote the mechanism they pictured rather than the property that must
hold. **When a story exists to serve a named invariant, state the property in the acceptance
criterion and let the mechanism be the implementer's choice** — otherwise every reasonable
implementation reads as a deviation.

## On the estimate for the next lane-shaped epic

The recurring cost in this epic was not writing the lane; it was making sure the drain's existing
behavior was provably untouched. One of the five success metrics — "draining an epic entry behaves
exactly as it did before" — remains the weakest, because only its validator half is instrumented and
the command-body half rests on prose-regression assertions. **Budget explicitly for the
regression-proof half of any epic that adds a mode to an existing pipeline.** It is not covered by
the estimate for the feature itself, and here it was roughly a third of the test volume.
