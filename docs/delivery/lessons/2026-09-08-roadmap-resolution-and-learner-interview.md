---
date: 2026-09-08
epic: "A roadmap resolves, and an interview establishes the learner's starting point and focus"
source: "#455"
---

# Lesson: an invariant that names a mechanism catches the bug the invariant alone cannot

Epic #455 was estimated M across four stories — two M and two S — and it landed at roughly that size,
1,885 lines added across 23 files with no story splitting and no re-decomposition. The estimate is not
where the lesson is. The lesson is in what the conformance pass found, and in what the planning
artifacts did and did not prevent.

## An invariant stated as an outcome held in name only

Record #478's invariant 5 originally said the resolved roadmap is *self-contained*, so no later phase
reads the issue graph to learn what a story says. That is a correct statement of the outcome, and the
first implementation satisfied it on every test it was given — while silently truncating every real
story body at its first `##` sub-heading. The roadmap was self-contained; it was just wrong. The
reason nothing caught it is that the tests used short synthetic story bodies with no sub-headings,
which is exactly the shape a body does not have in production.

The fix that stuck was not a better test. It was rewriting the invariant to name the *mechanism*:
resolution reads the shared resolver's structured result and never parses the `epic.md` markdown,
because in that rendered document a story's own `## Acceptance Criteria` heading is indistinguishable
from the epic's next section. Once the invariant named the forbidden mechanism, conformance became
checkable by reading one import.

**For the next epic in this area:** when an invariant states a property of an artifact, ask what
mechanism could satisfy the words and violate the intent. If one exists, name it in the invariant.
Invariants that constrain mechanisms are checkable against a diff; invariants that describe outcomes
are checkable only against tests you thought to write.

## Two of four conformance findings were fixture realism, not design

Both the truncation bug and the one-directional phase check were cases where the test fixture was
shaped like the happy path rather than like production. The phase-reference check ran
planning-against-lesson only, which is the reverse of the flow the stage actually performs — planning
finishes, lesson writing begins — and it passed because the authored tree happened to satisfy the
unchecked direction. Neither was a design error. Both were the same error about fixtures.

**For the next epic in this area:** a check with a direction has two directions. A fixture standing in
for a document body should carry the sub-structure a real body carries.

## Two of three deviations came from the record being right about the decision and wrong about a detail

The record decided the too-wide-query refusal should "name the count". Implementation found that the
search is asked for cap+1 rows, which makes the returned count a floor rather than a total, so naming
it would report the fetch limit back as the learner's result. The record's decision — refuse before
fetching, by name — was correct; one clause of its wording was not implementable as written.

Separately, invariant 2's enumeration of write locations omitted the learner-folder ignore rule that
the record's own workbook-creation decision requires. That was an incomplete enumeration, and revising
the record was the right resolution rather than working around it in code.

**For the next epic in this area:** a decision record's *decisions* survived implementation intact
here; its *enumerations and its wording of surface detail* did not. Where a record commits to an exact
count, an exact message, or an exhaustive list, expect implementation to correct it, and prefer
`/nxs.decision-record --revise` over a code workaround when it does.

## The one estimate that was wrong was outside this epic

Relaxing epic #407's drift gate was carried as an ADDRESS risk on the record and landed inside #455
with no acceptance criterion covering it. It is two small diffs, so it cost almost nothing — but it is
delivered behaviour in a neighbouring epic changed under an epic whose stories do not mention it. It
was visible at planning: the record named it as a risk that had to land first.

**For the next epic in this area:** when a decision record's ADDRESS risk requires a change to another
epic's shipped behaviour, that change needs its own story in this epic or its own issue against the
other one. Carrying it as a risk gets it built, but it lands outside every acceptance criterion the
close pass has to check against.

## Process note, not a delivery lesson

The `nexus excluded-stores` helper is documented for use as an unquoted `$EXCLUDE` in a pathspec.
zsh does not word-split unquoted parameters, so under zsh the whole string is passed as one pathspec
and the pipeline stores are silently *not* excluded. The failure is silent in both directions: the
diff simply includes files it should have withheld. Worth fixing at the helper or its documented
usage.
