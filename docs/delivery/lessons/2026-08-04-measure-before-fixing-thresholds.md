---
date: 2026-08-04
epic: "The Body Cap Measures the Concept, Not Its Neighbours"
source: "#220"
---

# Lesson: measure the store before choosing the number, and sequence contract ahead of code

Four stories (three S, one M), estimated M overall, landed in four commits with no rework, no page
edited, and no acceptance criterion missed. Three things made that outcome cheap, and they are the
transferable part.

**The thresholds were derived from a measurement taken before the record was written, not chosen and
then defended.** Every integer this epic fixes — the 40-word ceiling, the 25-word advisory, the
12-edge tripwire, the 25% and 25-bullet revisit triggers — was set against a full pass over the 47
active pages (own-content maximum 383, 198 bullets averaging 13.7, 95th percentile 21, maximum 35,
highest degree 15). That is what let the epic assert "every page passes unedited" as a success metric
rather than a hope, and it is why the day-one advisory count was predicted exactly (4 bullets) before
any code existed. An epic that changes a threshold should budget the measurement pass as planning
work, ahead of the decision record — the record cannot refute an alternative honestly without it.

**Sequencing the contract ahead of the code cost nothing and removed a whole class of argument.**
Story #221 amended the schema and its changelog with no behaviour at all; #222 and #223 then
implemented a contract that already existed. Reviewing "does the code match the contract" is a
mechanical question. Reviewing "is this the right rule" while also reviewing the diff that implements
it is not. Where an epic changes a stated rule, give the rule its own story and land it first.

**The releasability analysis belonged in the record, and paid for itself.** The decision record
identified that stories 2, 3 and 4 have no coherent intermediate trunk state — the moment the
validator emits an advisory while the drain still treats any printed finding as blocking, a drain
touching the hub page blocks on a non-blocking finding — and recorded a scope edit merging them into
one change. The alternative (a temporary suppression switch whose only purpose is to be deleted) was
refuted on the page rather than discovered mid-implementation. **The next epic in this area should
ask the same question explicitly at the record stage: for each story boundary, is trunk coherent if
we stop here?** A story labelled "not releasable on its own" in the epic notes is a signal the record
must resolve into an actual merge plan, not carry forward as a caveat.

One residual: the epic's Out of Scope was already filed as backlog stubs (#225, #226) at planning, so
close deferred nothing new. That is the intended shape — deferral at the moment scope is cut, not
rediscovered at close — and it left the close's deferred-scope step as a pointer rather than a
filing. Worth keeping.
