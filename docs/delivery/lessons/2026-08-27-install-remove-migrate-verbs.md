---
date: 2026-08-27
epic: "Build the install, removal and migration verbs on one component-mirror primitive"
source: "#253"
---

# Lesson: an L epic whose new engineering was all in the failure modes

**Estimate vs actual.** Assessed L (1–2 weeks) with the utilization risk flagged at planning: fills
the sprint with no slack. Six stories, twenty-three files, one PR, closed inside the assessment. The
sizing held — but for a reason worth naming, because the driver the estimate recorded was not the
driver the work had.

**The decomposition was right, and its rightness came from the discovery, not the epic.** The
epic's own framing — "three call sites of one function that already exists" — is what made six
stories the correct split rather than three or ten. That framing was settled before the epic, in the
discovery that graduated into it: one component set per account, an explicit second install step, and
Nexus writing components but never permission files. A future epic in this area should expect the
same shape: when the primitive already exists and is tested, the story count follows the *callers*,
and the estimate should follow the *guards each caller does not share*, not the file count.

**Where the L actually went.** Not into the mirror. Into resolving the install location without a
silent fallback, into making "deliberately empty" unrepresentable by accident, and into confining a
destructive sweep to what git can undo. The complexity drivers recorded at planning — "a destructive
gated path over tracked files in repositories the user was not thinking about, config-directory
resolution that exists nowhere today" — named both correctly. That is an estimation practice worth
keeping: for a verb epic, size the *error paths*, because the happy path is a call to something that
already works.

**Sequencing lesson: the widening story is the one to hold back.** Story #313 unblocked everything;
#317 (the duplicate diagnostic) was correctly blocked on all four others, because it is the story
that observes the others' shape rather than adding shape of its own. That paid off — the duplicate
comparison had to move from the two component *roots* to the two file *sets*, and that discovery is
only available once the pointing install exists. A diagnostic story placed early would have been
built against a model of the system that the epic then changed.

**What close inherited from analyze, and what that says about the gate.** The final analyze run at
the merged head reported 6/6 stories conformant with one medium and two low findings, all three
being invariants met at some call sites and not others — never at the site that deletes. The gate did
its job: none blocked, all three are named in the close record's deviation rationale and filed as two
backlog stubs. The lesson for the next epic is about *where* partial invariant coverage appears. All
three findings are the same shape — a rule stated once in the record, implemented correctly in the
component that motivated it, and then not carried to the sibling walkers that also touch the same
tree. An epic that states an invariant over "every verb" should get, at decomposition time, an
explicit enumeration of the call sites the invariant binds, and a story that owns the enumeration.
Four walkers existed here; the record said "no verb", and two of the four were reached.

**Scope drift was real, small, and justified in both instances.** Re-pointing the shipped components
off `nexus deploy`, and dropping `workspace init`'s `--payload` flag, were both wider than the story
text and both narrower than the record's decisions. Neither needed a new story. The in-flight decision
stubs captured both at the moment of choosing, which is what let close verify them against the diff
instead of reconstructing intent — twelve stubs across one branch, all twelve confirmed by the shipped
code. Capture cost nothing and carried the whole Key Decisions section.
