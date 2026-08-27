---
date: 2026-08-27
epic: "Rewrite every component invocation to name a toolkit, behind a build-time gate"
source: "#250"
---

# Lesson: land the gate first, and make its exemption channel expire on a condition

This epic was sized L on a driver that reads like a chore — seventy-nine invocation strings across
twenty-three bodies — and the estimate held. What made it hold was the sequencing, not the effort:
story #301 shipped the gate before any rewrite, so the two rewrite stories worked under a check that
failed on a mistyped verb during the rewrite rather than after it. The next mechanical migration in
this repository should copy that shape directly. A rewrite of this width has partial migration as its
default outcome, and a gate that lands last only tells you what you already shipped.

The mechanism that made the gate landable on day one was the pending register: an explicit list of
not-yet-migrated bodies, which only shrinks, whose empty state is the epic's recorded completion
condition. That is worth generalising. The alternative the decision record refuted — deriving
"migrated" as "this body currently contains no legacy form" — needs no bookkeeping and is the obvious
first idea, but it makes the regression guard a tautology, because reintroducing a path just
reclassifies the body and the build stays green. An exemption channel is safe when it can only close,
and dangerous when it can quietly reopen. Story #303 deleted the register and its parameter along
with the last legacy site, which is the discipline that keeps it honest: the channel did not outlive
the migration by even one story.

Two costs surfaced late and neither was in the estimate. First, the scanner's own reader was subtly
wrong in a way no acceptance criterion would have caught — the fence reader inverted its state on an
unbalanced inner fence and silently un-gated everything after it, and three component bodies already
nest deep fences, so the gate was standing on a correct-by-accident balance. A gate that reads
component prose needs a test for its reader, not only for its verdict. Second, deleting the seven
legacy skill scripts took roughly 340 lines of `parity.spec.ts` with them: three migration axes lost
their second artifact. That deletion was correct and each axis's own comment had named this epic as
its retirement, but it was discovered during the work rather than planned. When an epic's completion
condition is "an old artifact is gone", the tests that compare against that artifact are part of its
scope and should be counted at planning.

The last lesson is about ordering across epics. This epic's rewrites were promoted to hard-blocked on
the packaging work that puts the toolkit names on the caller's path, and that promotion happened at
the design gate rather than at planning. It was the right call — without it every shipped stage would
have named a command that does not resolve, and this repository's own pipeline would have been the
first casualty. An epic whose assumptions read "X already exists" should test each one against the
tree at planning time; here three of four assumptions named other epics, and two of them were not yet
true.
