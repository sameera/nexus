---
date: 2026-09-12
epic: "A Member Pull Request Resolves to the Stories It Implements"
source: "#564"
---

# Lesson: a test double that cannot fail the way the platform fails licenses a defect

Four defects in one resolver shipped green. One of them let the analyze gate report a pass over
stories nobody read, which is the worst failure this pipeline has. The estimate of M held. Four
stories landed in four commits on the day the epic was planned, and the sequencing edge the epic
declared was the only one that mattered. The delivery lesson is not about size. It is about why the
defects were invisible until a live multi-repository epic hit them.

The set-aside path for a missing issue existed and had a passing test. The test passed because the
double standing in for GitHub answers a missing issue with a successful call returning nothing.
GitHub answers a missing issue with a failed call. The double could produce a response the platform
never produces, so a test written against the double asserted behaviour that could not happen in
production. The code under test was never exercised on the path it would actually take.

The next epic in this area should treat a fixture's failure vocabulary as part of the contract it
stands in for. When a double models an external service, the shapes it can return must be a subset
of the shapes the service returns. A double that can return more than the service can is not a
weaker test. It is a test of a different system.

Two practices follow from that, and both cost little at the time they are applied.

First, when a defect is traced to a fixture, correct the fixture before the code, and expect an
existing test to turn red. Epic #564 did this deliberately, and the red test was the evidence that
the defect was real rather than theoretical. A separate missing-issue mode added beside the old
shape would have avoided churn in unrelated specs, and would have kept a fixture that misreports
the platform available for the next defect of this class.

Second, when the same rule is implemented in two places, expect the two to drift, and count the
drift as a cost at planning rather than a surprise at repair. The commit-trailer rung and the body
rung of this resolver disagreed about what a repository qualifier means. The two rungs sat twenty
lines apart in one file. Proximity did not prevent the drift, and reading either rung on its own
did not reveal it. The repair was one shared implementation used by both rungs, which is what
should have been written when the second rung was added.

One estimation note for the next epic here. The epic was planned as four defects in one resolver,
and during design one story grew to cover a fifth rung, the platform's closing-issue links. That
growth was accepted because the fix was smaller than the epic that would otherwise carry it. A bug
epic scoped by "defects found so far" should expect to find one more of the same class during
design, and should be planned with room for it rather than re-scoped at the record.
