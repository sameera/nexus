---
date: 2026-09-21
epic: "The Razor Check Reads a Decision Record as a Decision Record"
source: "#759"
---

# Lesson: a claimed single definition is not a held single definition

The epic asked one checker to adopt the story definition its sibling already used. The change did that, and the code now says so: `storyHeadingTitle` is documented as "the single definition of what a story heading is; every check that walks stories asks it". Three readers in the same library still hold their own copy of that idea. They agree today, and nothing fails if one of them stops agreeing.

Two things follow for the next epic in this area.

**A consolidation epic should name every reader it is consolidating, in the epic, before the work starts.** This one named the two the issue named. The other three were visible from a single search of the library, and would have been either in scope or explicitly out of it. Instead they are deferred scope discovered at close, which is the more expensive place to discover them.

**A success metric that reads "two things agree" needs a story that makes the agreement checkable, or it is not a metric.** The third metric here — that the record checkpoint's checklist and the razor check agree on which headings in a record are decisions — is true and unverifiable. The epic gate passed it because it is well-formed prose. The conformance gate flagged it as not measurable, which is the right stage to catch it, but by then the shape of the epic was already fixed. Ask of each metric at drafting time: what would fail if this stopped being true?

**The two conformance runs on the same commit disagreed.** The local run reported one medium and one low; the certifying run against the pull request reported none, and carried the same two observations as prose under "worth a look, neither a finding". The published verdict is what the close gate reads, so the close would have recorded a clean epic with no trace of either observation. They reached this close only because the local receipt was read alongside it. Either the severity of an observation should not depend on which mode analyze ran in, or a close should read both.
