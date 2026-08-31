---
date: 2026-08-31
epic: "Retire the Python runtime and fold the toolkit into one executable"
source: "#354"
---

# Lesson: a criterion that needs a human act needs a schedule slot, and a prose invariant needs a check that reaches the whole claim

Epic #354 was assessed L, filled the sprint, and landed all eight stories in the order its decision
record adopted. Both of its blocking close findings trace to the same shape of mistake, made twice
in different materials: an obligation was written down carefully and then left with nothing that
would force it to happen.

**The manual acceptance criterion never got a slot.** Record #400 added a criterion to the
seam-removal story — one live harness run against the executable before the payload deletion
removed the implementation it could be compared against. The record was explicit that this was the
last such point, and it flagged the risk itself: an ADDRESS item saying the run was hand-driven,
could not be satisfied by the automated suite, and sat on an epic with no schedule slack. The
mitigation it proposed was to run it as soon as the cut-over compiled. What actually blocked it was
neither time nor attention but authority: the harness refuses to create a scratch repository it
cannot delete, and the credential lacked `delete_repo`. That is a dependency on an outward-facing
grant, discoverable on day one of the epic by running the harness's own preflight, and nothing in
the plan required anyone to look. The story then closed and the next story deleted the comparison
window.

The estimate was not wrong; the sequencing was. **A criterion that depends on a human act or an
external grant should be resolved at epic planning — before the stories that consume it are
sequenced — not carried as a risk mitigation inside the story that needs it.** For the next epic in
this area: when the decision record adds an acceptance criterion the suite cannot check, the epic
owes that criterion an explicit prerequisite check in its first story, or it owes an admission that
the criterion is advisory.

**The prose invariant outran its enforcement.** Invariant 14 gave each README span exactly one
owning story, and the record split the readme by topic precisely because a three-way byte-identity
check would fail the build if the permission-grant text diverged across its surfaces. That reasoning
was sound and the split was drawn correctly. It just did not hold, because the check slices the
readme from `# Installing` onward and the Get Started summary makes the same claim seventeen lines
above that boundary. The epic shipped a readme asserting both one permission entry and two.

The general form: **when a decision record leans on an existing check to make a prose split safe,
the record should state the check's actual reach, not its purpose.** "A byte-identity comparison
holds the grant text together" was true and insufficient; "it reads only below the install heading"
was the fact that mattered. A cheap habit for next time — when an invariant is about a claim rather
than a symbol, grep for the claim across the whole file before trusting the test that covers part of
it.

**What went right, and is worth repeating.** The additive fold was the right call and paid for
itself: one implementation behind two declaration tables kept the registry change, the
thirty-seven-reference body rewrite and the name withdrawal as three separately reviewable commits,
and the corrected story order the record imposed on the epic's filed sequence prevented a red window
between the seam removal and the payload deletion. Both were decisions taken at the record, against
a plan already filed — evidence that the decision-record stage earns its place on an epic this size.

**One process gap to close.** The record's four scope edits were required to be written back onto
the filed story issues before implementation, and none were. It cost nothing this time because the
implementer worked from the record. It costs everything the first time someone works from the issue.
Either the write-back becomes a mechanical step at record approval, or the record should stop
pretending the issue bodies are the contract.
