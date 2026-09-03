# Delivery-plan document template

The section list, the per-milestone shape, and the definition of done. Sections marked
**(re-cut only)** are omitted when no existing delivery order is being replaced.

Write in the `nxs-prose-style` register: one idea per sentence, no em-dash parentheticals,
common words, references resolved. Every section exists to move the reader toward one decision,
which is whether to adopt this order. Cut anything that does not.

Length is a consequence, not a target. A plan for a feature with seven milestones and an
accepted design behind it runs long, and that is fine when every part is load-bearing. A
section you cannot say the purpose of is a section to delete.

---

## Front matter

```markdown
# <Feature> — an incremental delivery plan

Draft for review, written <YYYY-MM-DD>. This plan replaces the delivery order in <source>. It
does not replace the scope analysis in that record, and it does not replace the accepted
high-level design on <source>.

<One line on how it was produced and what checked it, when that is true.>
```

On a revision, append a note rather than rewriting silently. The reader is usually the person
who reviewed the last version, and they are looking for what moved:

```markdown
**Revised <date>, after review with <who>.** <What was re-cut, and the axis it moved to. Which
items were removed as not real. What renumbered.>
```

---

## What this plan changes

Three things, in this order:

1. **The diagnosis, in two or three sentences.** Where the existing order came from and why
   reusing it is the root of the problem. When it came from a design document's component
   decomposition, say so — it explains the mistake without blaming anyone for it.
2. **The slicing axis, in one sentence.** Not which component gets built, but what the feature
   can survive and how truthfully it reports what it did. This sentence is the plan's thesis
   and a reader should be able to quote it back.
3. **The material changes, numbered.** One line each, each naming what moves and the
   consequence. A reader who reads only this list should be able to decide.

Close with the total estimate, compared against what the existing plan claims, and the plain
statement that the work is not smaller. Point at the section that names where the risk sits.

---

## Part 1 — Why the current breakdown does not deliver incrementally **(re-cut only)**

One subsection per structural fault. Lead with the central objection, the one that applies to
the largest number of milestones. Each subsection names the specific epics, stories, or
milestones involved, quotes their own words where those words convict them, and states the
consequence in terms of what a person can and cannot do.

Epic success metrics are worth reading closely here. An epic whose metrics count internal
artifacts and never mention the outcome arriving somewhere is announcing that it is
component-ordered.

An epic that describes itself as a verification slice rather than a customer-facing capability
is also worth checking against its own acceptance criteria, because the two sometimes disagree.
When the criteria require more than the self-description admits, both halves are problems: the
epic is larger than it claims, and it declines to claim the outcome that would make it
demonstrable.

---

## Part 2 — Corrections to the numbers and claims **(re-cut only, when there are any)**

Factual corrections come before the roadmap, because each one changes what the plan can
promise. Check every one against the source issue or the recorded concepts, and say which.

Include here:

- Figures that are wrong, or that are a different unit than they appear. A range that reads
  like a count of items and is really a byte budget cannot be multiplied by an item size.
- Claims that do not hold. A component described as failing safe that does not fail safe.
- Requirements asserted in an earlier draft that turn out not to be real. State that they do
  not hold, especially when you asserted them, and say why: which artifact the invariant
  actually governs, or which conditions the hazard actually needs.
- Consequences for specific stories. When a correction makes a story pointless — a measurement
  of a shape the plan replaces one milestone later — say to drop it, and say what measurement
  replaces it and which milestone takes it.
- Decisions recorded elsewhere as a result of a correction, with the issue they were recorded on.

---

## Part 3 — The roadmap

Open with the milestone count and one paragraph restating the axis and the guarantee: from the
first milestone onward, every milestone runs end to end, completes, and states its own outcome,
and no milestone leaves a working capability behind a later one.

### Per-milestone shape

```markdown
### M<n> — <the outcome, as a short sentence>

<Days>. Sized <t-shirt>. <A sentence on where it sits in the plan's risk, when notable.>

**What can be claimed.** <One or two sentences a person outside the team would recognise as a
capability. This is the milestone's contract with its reader.>

**Who it is for.** <The persona or role. Whether the claim is internal or customer-facing, and
the ceiling that bounds it.>

**Content.**
- <Work item.>

**Decisions taken here, because this is where they bind.**
- <The decision, the option chosen, and why this milestone is where it binds.>

**One check, not a decision.** <A question answered by looking rather than by choosing, and
what the answer decides. Often whether the milestone may run against real data.>

**Internal checkpoint, around day <n>.** <For an extra-large milestone carrying the central
bet: the point the bet resolves, reached before the rest of the work starts.>

**Deliberately absent.** <What is not here, and why. Name the later milestone that takes it, or
the reason it is speculative.>

**Drawn from.** <The epics and stories in the existing breakdown this milestone consumes, and
which parts of them.>

**Verified by.** <Who accepts it. A named role, not "the team", when the role is what makes the
claim meaningful.>

**Evidence.** <Observable pass conditions. Counts that must match. The regression proof. One
negative test: the primary failure mode deliberately triggered and observed.>

**Ship gate retired.** <The gate from the design's exit criteria, or None with what it does
instead. Note a gate whose text needs amending rather than ticking.>

**Risks this milestone attacks.** <The assumption it can kill.>

**Where the complexity sits.** <For a milestone that looks smaller than it is: the two or three
things carrying its risk. This is what justifies it being its own milestone rather than a tail
on another.>
```

Not every milestone needs every heading. Use the ones that carry information for that
milestone, and keep the order stable so a reader can scan across milestones for the same thing.

Two headings do more work than their length suggests:

- **Deliberately absent** is how the plan refuses gold-plating in writing. It also ends the
  review conversation where somebody notices a gap and assumes it was an oversight.
- **Evidence** is where a milestone becomes falsifiable. "The destination count equals the
  source count and the stored summary reconciles against both" can fail. "Pagination works"
  cannot.

### The orphan section

Scope the existing record lists as out of scope, but describes as ship-blocking and unowned, is
not a scope decision. Give it its own section with the same shape, plus:

- **When.** The natural slot, and separately the hard constraint. "Alongside M2 is natural. It
  must land before the first pilot commitment, because every milestone's evidence rests on a
  comparison that means nothing if a read might have been silently truncated."
- **Constraint that shapes it.** Why it ships in a narrower form than the design asks for, and
  what would promote it to the full form.
- **What is deliberately absent, and why**, with each reason stated separately when an earlier
  version of the work included something this one drops.

---

## Part 4 — Sequencing rules

Numbered, each in bold-lead form, each with its reason. Open by saying these are technical
constraints rather than preferences, then keep that promise: a rule you cannot justify from a
dependency or a hazard is a preference and belongs elsewhere.

The rules that recur across features:

1. The completion mechanism is part of the loop, not a refinement of it. List every downstream
   mechanism that needs a terminal outcome, because that is the argument.
2. A shared contract is fixed before its consumers are built, with a deadline inside the
   milestone rather than a milestone of its own.
3. A shared query or interface is designed before anything calls it, by its first caller, and
   re-measured by the milestone that raises its volume.
4. The producer and the consumer of one contract ship together.
5. Each default is chosen with the mechanism it parameterises, against a measurement an earlier
   milestone took.
6. A write path precedes the verification of it, so a guarantee is verified in the milestone
   whose work creates the hazard.
7. A decision is taken in the milestone that binds it, and nowhere earlier.

**When a rule reverses a rule the previous plan held, say so in the rule.** Give the old reason
and why it no longer applies. A reader who remembers the old rule and cannot find its refutation
will assume you forgot it. A rule that has now been stated three different ways across drafts is
worth admitting as such — it tells the reader where the plan has been least stable.

---

## Part 5 — Definition of done, applied to every milestone

This list is close to universal. Adapt the wording to the system, keep the substance.

- A change delivered through the real path, run on the real runtime, with the result verified at
  the real far end. A unit test does not stand in for a run.
- The increment states its own outcome. A milestone does not hand a person the job of finding
  out whether it worked.
- Conservation checked. What went in equals what came out, or the difference is named and
  reported rather than passing silently.
- The pre-existing path still behaves identically. Checked every milestone, as a regression
  proof.
- No milestone changes what an existing surface means without repairing it in the same
  milestone. State the concrete check, not the principle.
- The increment's absent safeguards are stated out loud at the review, so nobody mistakes the
  increment for the finished feature.
- One negative test per milestone. The increment's own primary failure mode is deliberately
  triggered and observed.
- No story counts as done while the other half of a paired change sits in a different milestone.

---

## Part 6 — Gate burn-down and what could falsify the design

A table: milestone, gate retired, risk attacked first, what would falsify the design here.

The falsification column is the point of the ordering, and it is what replaces a de-risking
probe milestone. Say that under the table. Each milestone should be able to kill an assumption
early rather than late, and the entry should be specific enough to recognise if it happens.

Note where the burn-down improves against the previous order and why, since that is the
strongest single argument for the re-cut. Note also any gate whose text needs amending rather
than ticking, because a gate listing a clause about scope that has since been cut is moot rather
than satisfied, and a gate requiring an owner as well as a mechanism is not retired by the
mechanism alone.

---

## Part 7 — Where this plan is most likely to be wrong

A table of milestone and risk. Be specific about size risk: which milestone is extra-large,
what it carries, what the honest split would be if it does not fit, and what that split costs.

Include the risks the ordering *adds*. Every re-cut trades something. The usual trade is that
the central architectural bet is tested later than a short probe would have tested it. Name the
mitigation and say what makes it work.

Where an independent review estimated differently for the same content, cite that estimate and
say to treat it as still live. A re-ordering does not reduce the work.

---

## Part 8 — Estimates, dependencies, and gaps

Two subsections:

- **Estimates and dependencies in the existing breakdown that need attention.** Sizes
  conditional on an unmade decision. Utilisation warnings. Work with no story anywhere, whose
  size is therefore unestimated rather than small.
- **Gaps this plan does not close.** Work the plan knows about and does not schedule, so nobody
  discovers it later and assumes it was covered. Classification work across a component set.
  Infrastructure that has to exist before a milestone can be feature work.

---

## Part 9 — The cuts in the existing record, reviewed **(re-cut only)**

For each item the existing scope-reduction record cuts: is it a real scope decision, or unowned
ship-blocking work relabelled? Say which, and for the second kind give it a milestone.

---

## Part 10 — Does this plan still achieve the goals of the feature?

A table mapping each recorded goal or success criterion to the milestones that deliver it. This
is the section that catches an axis change that quietly dropped a goal, which is the main risk
of re-cutting a plan.

---

## Part 11 — Decisions, and the milestone that owns each

Grouped by milestone, numbered continuously. Then two separate groups, because a reviewer treats
them differently:

- **Checks, not decisions.** Questions answered by looking, with what the answer decides.
- **Standing, and needed before <the commitment>.** Items with no milestone and a hard deadline
  anyway.

This section is what a reviewer scans to confirm that nothing was decided before the code that
depends on it. If it reads like an up-front decision list, the plan still has an M0 in it.

---

## Presenting it

Do not narrate the document. Present the decision:

- The slicing axis, in one sentence.
- The milestone titles in order, one line each.
- The material changes against the existing breakdown.
- The total against the old total, with the statement that the work is not smaller.
- Anything you added that was not asked for, flagged so it can be cut.
- The question: adopt this order?
