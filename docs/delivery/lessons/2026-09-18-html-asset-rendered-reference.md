---
date: 2026-09-18
epic: "A filed issue's HTML asset links to a configured renderer"
source: "#613"
---

# Lesson: a test that pins a proxy has to be replaced in the change that invalidates it

This epic was sized M on two S stories, and it landed in one sitting with the conformance gate clean on its first run. The estimate held, so the sizing is not the lesson.

The lesson is about what happened to a guard. An earlier epic wanted the reference builder never to learn whether the store is public or private, and it pinned that with a test asserting the builder took no more than two inputs. The input count was never the property anyone cared about; it was a cheap stand-in for it. This epic had to add an input, so the stand-in had to go, and a test that had been protecting a real invariant was suddenly an obstacle to a change that did not threaten that invariant at all.

What made this land well is that the replacement was designed at planning rather than discovered during implementation. The decision record named the new guard — a check over the builder's own source that no word describing visibility survives in it — and named the refuted alternative, bundling the new input into an options object so the old assertion kept passing. That alternative is the one an engineer reaches for under time pressure, and it is the worse outcome: the assertion's letter survives while its meaning is voided, and the same object would accept a visibility field a year later with nothing failing.

Two things the next epic in this area should carry forward.

First, when a test pins a proxy for the property you actually want, say so in the test, next to the assertion. The engineer who has to change it then knows whether they are removing a guard or removing a stand-in, and those call for different care.

Second, a constraint that is documented but not enforced will be believed. This epic shipped documentation telling teams a renderer template must carry exactly one slot, while the code only checks that a slot is present. Nothing decided was contradicted and the conformance gate passed, because the gate reads the code against the record and both were individually defensible. The gap was only visible when the shipped prose and the shipped behaviour were read side by side, which is the close-from-diff pass, not the conformance pass. Where a decision record states a countable constraint, the story that implements it should carry an acceptance criterion that counts.
