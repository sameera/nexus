---
date: 2026-08-26
epic: "Give the release one version identity and a writer stamp"
source: "#251"
---

# Lesson: A capability is not delivered until the thing that invokes it is reachable

Estimate held. The epic was sized S — "one verb, four artifact writers stamped, one guard in the
dispatcher" — and that is what landed, across three stories with no blocking dependency between
them, in one PR. Nothing about the decomposition needs to change.

The lesson is about what "done" meant, and it is one this feature has now produced twice.

Story #306's acceptance criteria pin a *contract*: each of the four artifacts carries the version
of the toolkit that wrote it, an absent stamp reads as an unknown writer, the stamp sits outside
every verified hash. All four are implemented and tested, and conformance analysis found no story
AC unmet. But the epic's own success metric — "every artifact the toolkit writes carries the
version that wrote it" — is not true of anything the pipeline writes today, because the four prose
writers are told to take the stamp from `nexus version` and no `nexus` executable is reachable:
the package declares no `bin`, and nothing is on PATH until #252 ships the manifest. Every writer
silently takes the "omit if unresolved" branch. The close record for this very epic had to resolve
its own stamp through the Python half's importable module instead, because the verb the command
text names could not be run.

That is the same interval the toolkit-by-name work hit a day earlier: a capability whose
implementation is complete and whose *invocation path* does not exist yet, with the failure
expressing itself as a silent empty substitution rather than an error. Twice now the gap has been
found by conformance analysis at the end rather than by planning at the start.

**What the next epic in this area should do differently.** When a story's acceptance criteria
describe a contract that a *different, unshipped* story makes reachable, say so in the epic's
sequencing rather than leaving both unblocked. #305, #306 and #307 were all filed with
`blocked_by: none`, which was true of their code but not of their observable effect — #306's
metric is gated on #252. Either state the dependency in the Implementation Sequence, or write the
success metric so it measures the contract that actually ships in this epic and let the
end-to-end metric belong to the epic that closes the gap. A metric no story in the epic can move
is a metric that will be reported as unmeasurable at close, every time.

The safe-by-construction design deserves credit and is worth keeping: an unresolved version
yields no stamp rather than a fabricated one, so the reachability gap degrades to "unknown
writer" instead of recording a lie. The deferral reasoning also held up — the version-difference
ladder stayed out on an explicit, population-based argument with a named revisit trigger, and
nothing in implementation pushed back on that call.
