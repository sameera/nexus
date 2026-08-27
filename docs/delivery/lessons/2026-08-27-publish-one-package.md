---
date: 2026-08-27
epic: "Publish the release as one package carrying both toolkits, the component payload and the changelog"
source: "#252"
---

# Lesson: an epic whose last story needs a *state* the epic cannot reach should say so at planning, not at close

Epic #252 was sized M across four stories and delivered all four, but its final story — #312,
one tagged release with an adopter-language changelog — carried an acceptance criterion that
required the release to have actually been cut. Decision record #334 then wrote invariant 15,
which forbids the tag and the publish while any shipped component body still reaches a toolkit
capability by an in-repository path. The record and the story were in direct conflict from the
moment the record was approved, and nothing surfaced it until the conformance gate ran at close.
The remedy cost an issue amendment, a backlog stub and a rescoped AC on an otherwise finished epic.

**What to do differently.** The record's own ordering note already said the release tail was
gated on another epic. When a decision record introduces an invariant that blocks an action a
story's AC asserts, that is a story-level scope change and belongs in `/nxs.decision-record`'s
story-coverage pass — not left for `/nxs.analyze` to find as a partial AC. The coverage pass
should ask, per story, whether every AC names something reachable *within this epic's own
boundary*; an AC that needs a state a sibling epic must produce is an AC that belongs to that
sibling epic.

**The decomposition itself was sound.** #308 (package definition) → #309 (defined payload) →
#310 (gate over what was released) → #312 (changelog + release) is the right sequence, and the
first three landed without deviation. The record's deliberate separation of *definition* from
*tail* was correct and let downstream epics #253 and #256 start on a locally-installed package.
The failure was only that the separation was recorded in the epic's prose and the record's
decision, and never propagated back into the story's acceptance criteria.

**Estimate vs actual.** The M rollup held for the four stories, but the close cost more than a
close usually does: an issue amendment, a stub, and a new executable gate (`nexus:release-gate`)
written *during* the close pass because the analysis found a procedure step with nothing behind
it. Writing that gate at close was right — it goes green by itself when #250 lands — but a
release-blocking invariant is the kind of thing that wants an enforcement mechanism named in the
record alongside the invariant, so the story that introduces it builds it.

**One more, cheaper.** The epic landed across two PRs on the same branch, with a `main` merge
between them. The close-from-diff range therefore had to be assembled by hand from both PR
anchors; the branch's own fork point would have swept a sibling epic's already-distilled work
into this epic's attribution. Reusing a branch after its PR merges is convenient and costs a
manual range derivation at close. A second branch is cheaper.
