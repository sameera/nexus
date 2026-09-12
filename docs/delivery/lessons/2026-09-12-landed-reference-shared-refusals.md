---
date: 2026-09-12
epic: "The epic-classification and cross-kind collision refusals move into nxs-landed-reference"
source: "#515"
---

# Lesson: Splitting one shared section across three stories leaves its call sites naming the wrong thing

The epic moved a pair of refusals out of one command file into a section of a shared skill, then had
two lanes load it. Three stories, estimated M, and the estimate held: three commits, ten files, no
rework and no unmet acceptance criterion across eighteen of them.

The decomposition itself is what is worth carrying forward, and it is worth carrying forward with one
correction.

Splitting the shared section by *application point* rather than by *lane* was the right cut. Story
one wrote the refusal half and converted the lane that already had it. Story two gave the second lane
the same half. Story three added the reconciliation half and wired it into both lanes at once. Each
story shipped a section a reader could hold whole, and the dependency graph let the two later stories
build on the first without either waiting on the other.

The correction: a story that *adds* to a shared section must revisit the call sites written by the
story that created it. Story one's call sites named "Section E", which was exact when E.1 was all of
Section E. Story three added E.2 beneath it and left those citations naming a section that now
encloses more than they mean. Nobody is misdirected, because the section's preamble binds each half
to its own application point, but the record's own invariant asked the call sites to name the point
and they no longer quite do. The next epic that grows a shared section in stages should carry an
acceptance criterion on the *later* story requiring the earlier story's references be re-pointed —
the growing story is the only one that knows the names changed.

One more thing held up well under decomposition: the invariant list. Record #544 carried seventeen
constraints, and the closing conformance pass could walk them one by one against the shipped diff
because each named an observable property of a specific file rather than an intention. Seventeen is a
lot to write; it cost one review pass instead of an argument.

Finally, a gap this epic found the hard way: the record's key decisions described how an entry's kind
is read without stating how the one kind that records no kind is identified. That went unnoticed
until implementation, and closing it took a separate commit. An invariant that requires an existing
behaviour to keep working deserves a check, at design time, that the mechanism it now runs through
can actually see the case the old mechanism saw.
