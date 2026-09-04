# Delivery-plan antipatterns

Ten ways a delivery plan stops being incremental. Each entry gives the symptom you can look
for in a draft, the reason it is a problem, and the repair. Read the whole file before writing
a plan, and again against the draft.

The worked examples come from one real case: a pagination feature whose eight-epic
component-ordered roadmap was re-cut into seven outcome-ordered milestones. The examples are
concrete on purpose. Generalise the shape, not the domain.

## Contents

1. [Component-per-milestone](#1-component-per-milestone)
2. [The decisions-only phase](#2-the-decisions-only-phase-m0)
3. [The completion mechanism deferred](#3-the-completion-mechanism-deferred)
4. [One mechanism split across two milestones](#4-one-mechanism-split-across-two-milestones)
5. [Defaults chosen away from their mechanism](#5-defaults-chosen-away-from-their-mechanism)
6. [The verification milestone at the end](#6-the-verification-milestone-at-the-end)
7. [Usage bans standing in for delivery](#7-usage-bans-standing-in-for-delivery)
8. [Non-functional work sized for the wrong volume](#8-non-functional-work-sized-for-the-wrong-volume)
9. [Invented requirements from misapplied invariants](#9-invented-requirements-from-misapplied-invariants)
10. [The de-risking probe as its own milestone](#10-the-de-risking-probe-as-its-own-milestone)

Plus: [transition scaffolding nothing needs](#bonus-transition-scaffolding-nothing-needs) and
[the milestone bundled by theme](#bonus-the-milestone-bundled-by-theme).

---

## 1. Component-per-milestone

**Symptom.** Each milestone is one runtime component: the connector, the store, the compiler,
the worker, the console. The dependency order is correct and every milestone is real work,
which is why this passes review. The tell is arithmetic: count how many milestones stand
between the start and the first outcome anyone outside the team could observe. In the worked
case the answer was four of eight, inside a four-sprint budget.

**Why it is a problem.** The plan cannot be shortened, stopped, or reprioritised anywhere
before that point, because nothing before it is a deliverable. Every intermediate review is a
status report rather than a demonstration. And the design's riskiest assumptions stay untested,
because testing them requires the whole path.

**Where it comes from.** The design document's own decomposition, reused unchanged as a build
order. It is nearly always taken in good faith: the architecture section is the most
authoritative breakdown available, so it gets adopted. Say this in the plan when you re-cut,
because it explains the mistake without blaming anyone for it.

**Repair.** Step 1 of the skill. Find the spine, put the whole spine in M1, and give the
ceiling-lifting components their own later milestones.

---

## 2. The decisions-only phase (M0)

**Symptom.** The roadmap opens with a milestone made of decisions, investigations, spikes, or
"settle the shape of X". It is short, two or three days, and it ships nothing runnable. In the
worked case, a proposed M0 held: settle the correlation identifier semantics, choose the
correlated-query design, decide the failure-policy semantics, decide the object store's shape
across cloud, on-premises and air-gapped, and confirm an engine configuration.

**Why it is a problem.** Two reasons, and the second is the important one.

The first is that a milestone with no runnable deliverable breaks the plan's own standard
before the plan begins.

The second: **a decision taken before the code that depends on it is taken with the least
information anyone involved will ever have.** The object-store decision in that list is a good
example. Deciding its cloud, on-premises and air-gapped shapes in an up-front phase means
deciding before anyone has written a line against the store, measured a round trip, or found
out what the tenancy prefix scheme costs. Deciding it in the milestone that builds the store
means deciding it with all of that in hand.

**Repair.** Dissolve the phase. Move each item into the milestone whose code binds it. Then
sort the items into decisions (a choice between viable options) and checks (a question
answered by looking), and label them differently, because a reviewer treats them differently.
A check often decides whether a milestone may run against real data, which is worth saying
explicitly.

Where an item genuinely cannot wait — a decision that shapes a contract every consumer reads —
it does not need a milestone of its own. It needs a deadline inside M1: "fix the shape of the
fetch result in the first two days of M1". That is a sequencing rule, not a milestone.

---

## 3. The completion mechanism deferred

**Symptom.** An early milestone's honest claim contains a phrase like "reports that fetching
finished and the drain state is unknown", or "the driver makes no claim about whether the
spawned work finished". The mechanism that makes the run's own status trustworthy — a barrier,
a join, a fan-in reconciliation, an acknowledgement, a genuinely terminal terminal state — sits
in a later milestone. In the worked case it was the fourth epic of eight.

**Why it is a problem.** This is the deepest one, so it is worth stating at length.

An increment that cannot report its own outcome is not a smaller version of the feature. It is
a different thing. Four consequences follow, and they compound:

- The evidence every earlier increment rests on has to be gathered by hand, because the system
  will not tell you whether the work landed.
- Whole classes of usage stay unsafe. In the worked case a scheduled job could overlap itself,
  because the previous run reported terminal while its work was still in flight.
- The worst failure the design admits — reporting success before the work landed — is the
  normal behaviour rather than a bug, so it cannot be tested for.
- Every downstream mechanism that needs a terminal run is blocked behind it anyway: cleanup
  triggered by termination, a checkpointed hand-off between segments, a reconciliation sweep.
  Deferring the completion mechanism therefore defers more than itself.

**Repair.** The completion mechanism is part of the loop, not a refinement of it. Put it in M1
and accept that M1 is large. In the worked case this single move retired three of five ship
gates by the second milestone, against a burn-down that previously reached the second gate only
at the fourth cycle — because the gates depended on cleanup, and cleanup depended on a terminal
run.

---

## 4. One mechanism split across two milestones

**Symptom, form A — producer and consumer separated.** One change to one contract, split by
which component it touches. In the worked case: "fetch worker emits the reference form of the
page envelope" was in the second epic; "workers resolve a records reference when they read
records" was in the fifth. If the emitter lands first, it produces something nothing can read,
and every consumer breaks.

**Symptom, form B — one worker, two settings.** A barrier polling correlated work at threshold
zero and an in-flight gate polling the same work at a non-zero threshold are one worker. They
were in two epics, each of whose size estimates assumed the other would share the worker, with
the joint decision owned by nobody. A size that is conditional on an unmade decision is a
condition, not an estimate.

**The reliable tell.** You have invented transition scaffolding — a tolerant reader that
accepts both forms, a dual-form payload, a deploy-ordering rule, a reader-before-writer
constraint, a rollback path — whose only purpose is to survive the gap you created. The
scaffolding is a symptom, not a solution. If the halves ship together, none of it is needed.

**Repair.** Merge the halves into one milestone and delete the scaffolding. Where the two
halves must genuinely be separate, the plan states the ordering as a sequencing rule with its
reason, and no story counts as done while its other half sits in another milestone.

Then ask the further question in [the bonus entry below](#bonus-transition-scaffolding-nothing-needs):
was the scaffolding ever justified at all?

---

## 5. Defaults chosen away from their mechanism

**Symptom.** A late milestone, often named for tuning or performance or hardening, owns the
choice of thresholds, batch sizes, limits, and timeouts. In the worked case the final epic
absorbed a cut performance epic and took on choosing the in-flight threshold, the destination
batch size, and the maximum pages per run — each of which parameterises a mechanism built
several milestones earlier.

**Why it is a problem.** Every mechanism ships parameterised by a guess and is re-tuned
afterwards. Worse, the guess is usually load-bearing: a limit chosen without the cost curve
that should size it is a number nobody measured, and it will be defended later as though it
had been.

**Repair.** Each default is chosen with the mechanism it parameterises, in the same milestone,
against a measurement an earlier milestone took. This makes measurement itself a deliverable:
if a later milestone needs a curve to size a limit, the milestone that can measure the curve
owns taking it. Put those measurements in the content list, not in a footnote.

---

## 6. The verification milestone at the end

**Symptom.** A final milestone verifies guarantees the earlier milestones assumed: idempotency,
duplicate handling, consistency under concurrency, ordering. It reads like diligence.

**Why it is a problem.** A guarantee is verified in the milestone that creates the need for it,
because that is the milestone whose failure it prevents. In the worked case, concurrent
duplicate writes only become a hazard once continuation exists, since a restarted segment can
re-spawn work that is still draining. Verifying the guarantee in the continuation milestone is
tight but not circular, and it means the milestone that introduces a hazard cannot be called
done while the hazard is unchecked.

**Repair.** Distribute the verifications to the milestones that create their hazards, and note
where the mechanism already exists so the work is verification rather than build. Keep the
regression proof — the pre-existing path still behaves identically — in every milestone rather
than in a final one.

---

## 7. Usage bans standing in for delivery

**Symptom.** The plan restricts a class of usage for several milestones. "Throughout cycles 1
to 3, the paginated shape is restricted to manually triggered flows. Scheduled flows become
safe when the barrier lands in cycle 4."

**Why it is a problem.** A ban is the plan admitting that its early increments are not usable
and quietly relabelling that as scope. It also hides a dependency: the ban has an expiry date,
and the thing that expires it is a mechanism the plan chose to defer.

**Repair.** Find the mechanism the ban is standing in for and move it earlier. Usually it is
the completion mechanism from entry 3, and moving it dissolves the ban. Where a restriction is
genuinely a scope decision rather than a workaround — one source type, one destination — that
belongs under "deliberately absent" with its reason, not as a temporary prohibition.

---

## 8. Non-functional work sized for the wrong volume

**Symptom, form A — too early.** A milestone carries work sized for volume it will never see.
In the worked case, an early draft put a console repair for 1,200 concurrent executions into a
milestone whose payload ceiling capped a run at a few dozen. The repair was real work for a
real problem, in the wrong milestone.

**Symptom, form B — too late.** The mirror failure, and the more damaging one. A milestone
changes what an existing surface means and leaves the repair for later. A large run's
executions flood a list, inflate a dashboard count, and skew an average duration, and the
milestone that caused it ships anyway.

**Why both matter.** Form A pads an early milestone that is already the largest in the plan.
Form B ships a regression to a surface that worked yesterday, which costs more trust than the
new capability earns.

**Repair.** Size the work to the volume the milestone actually admits, and hold this rule: **no
milestone changes what an existing surface means without repairing it in the same milestone.**
Make the check concrete rather than aspirational. In the worked case: a workspace holding one
paginated run and several ordinary flows shows unchanged counts for the ordinary flows, on both
the execution list and the landing dashboard.

The two forms resolve together. The repair lands in the milestone that creates the volume, and
that is also the milestone that breaks the surface.

---

## 9. Invented requirements from misapplied invariants

**Symptom.** A milestone item asserts a requirement drawn from a recorded invariant, and the
requirement is not real. Two from the worked case, both stated with confidence and both wrong:

- *"The page subflow needs a trigger entry task."* The recorded invariant said every flow
  declares exactly one trigger and every transpiled workflow starts with a trigger-derived
  entry task. True — of user-authored flows. The page subflow is emitted by the compiler, exists
  only inside the orchestration engine, and is never visible to a user. The invariant governs
  the compiler's input, not its output. Three elaborate failure modes were derived from it, all
  imaginary.
- *"The correlation identifier must be allocated per firing."* A real hazard, requiring two
  runs of one job to overlap. The milestone in question admitted small, manually triggered jobs
  only. The hazard could not occur under its conditions. It also turned out to be a build
  choice rather than an investigation, since the driver can write its own run-scoped value.

**Why it is a problem.** Invented requirements are expensive twice. They add work, and they
cost the plan its credibility, because a reviewer who finds one now has to check every other
invariant-derived claim by hand. In the worked case the reviewer found three, and each cost a
round trip.

**Repair.** Before an invariant becomes a milestone item, answer three questions in writing:

1. **What artifact does it govern?** User-authored input, or compiler output, or a runtime
   record? A rule about what a user may write says nothing about what a compiler may emit.
2. **Who is it visible to?** An internal artifact no persona sees does not inherit
   user-facing constraints.
3. **Can this milestone's conditions produce the hazard at all?** A hazard needing concurrency,
   or volume, or a scheduled trigger, cannot occur in a milestone that admits none of those.
   It returns as a question in the milestone that admits them, and often as a build choice
   rather than an open question.

If an invariant-derived claim survives all three, cite the recorded source. If it does not,
the plan should say the claim does not hold, especially when an earlier draft asserted it.
Correcting a claim you made is cheaper than leaving a reviewer to find it.

---

## 10. The de-risking probe as its own milestone

**Symptom.** M1 is a thin slice chosen to test the architecture's central bet as early as
possible. It ships in a week. It cannot be demonstrated, and it describes itself honestly, in
its own words, as a platform-verification slice rather than a customer-facing capability.

**Why it is genuinely tempting.** The instinct is right. The central architectural bet is the
cheapest thing to lose early, and a short probe reaches it sooner than a full milestone does.
This antipattern is the one where the plan is making a real trade rather than a mistake, and it
deserves to be treated as a trade.

**Repair.** Keep the probe, drop the milestone. Put an internal checkpoint inside M1 at the
point the bet first resolves — in the worked case, around day seven, at the moment the derived
shape first compiles, registers, deploys, spawns, and propagates its correlation value, before
the barrier work starts. Then state the cost plainly in the plan: this ordering tests the bet
later than a probe would have, the checkpoint is the mitigation, and the mitigation only works
if it is treated as a real gate rather than a status line.

If M1 turns out not to fit, the checkpoint is also where the honest split is. Say so, and say
what that split costs: the first half is then an increment that cannot report its own outcome,
which is the exact trade the plan exists to avoid. Pay it consciously and once.

---

## Bonus: transition scaffolding nothing needs

**Symptom.** The plan carries compatibility work justified by a deployment constraint: both
forms of a contract must coexist across a rollout window, the reader ships before the writer,
a rollback path must exist.

**The question nobody asked.** Is anything in production? In the worked case the recorded
product context put the system at design and planning, pre-production, with no production
deployments. There was no deployed component emitting the old form, so there was nothing to
coexist with, no deploy-ordering race between fleets, and nothing to roll back to. Two
successive versions of one sequencing rule existed to solve a problem the system did not have.

**Repair.** Establish deployment reality in Step 0 and record the answer. Then flip the
contract in one milestone, in one deploy, with the reader and the writer together.

**One caveat worth honouring.** Dropping this scaffolding is usually a deviation from an
explicit requirement in an accepted design. Record it as a scope decision with its rationale,
on the issue that carries the requirement, and say under what condition the requirement should
be reinstated — a first production deployment, in the worked case. Quietly dropping it leaves
the plan contradicting a design nobody updated.

---

## Bonus: the milestone bundled by theme

**Symptom.** One milestone holds two pieces of work that share a heading. "Observability"
holding both the rendering of a stored run summary and the detection of runs that crashed
before they finished.

**Why it is a problem.** They are different risks. Rendering a record you already store is a
read against existing data. Detecting a crashed run means writing an intent record at the start
of every run, which introduces a new persistent artifact and a false-positive mode of its own —
an intent for a run that never really started, and a sweep that cries wolf gets muted. A
milestone carrying two unlike risks reports the smaller one's progress and hides the larger
one's.

**Repair.** Split on kind of risk, not on theme. Order the halves by which is a surface for the
other. Then state the cost: splitting honestly cost about a week in the worked case, because two
medium milestones exceed one large one. And check whether the halves now have a constraint
between them that needs stating — in that case, the crash detector's lost-versus-still-draining
classification has to agree with the barrier's drain timeout, or the same work is lost according
to one and in progress according to the other.
