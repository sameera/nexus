---
name: nxs-delivery-plan
description: Cut a scoped feature into an incremental delivery plan whose first milestone already runs end to end and states its own outcome, and audit an existing roadmap that does not. Use this skill whenever the work is to produce, reorder, or review a delivery plan, roadmap, milestone sequence, phase plan, sprint order, implementation plan, or "what do we build first" for a feature that already has a design or an epic breakdown — and use it even when the request sounds like ordinary sequencing ("sequence these epics", "what order should we build this in", "turn the HLD into milestones", "is this plan actually agile", "re-cut this roadmap"). Reach for it especially when a design document's component decomposition is about to be reused as the build order, because that is the mistake this skill exists to prevent. Not for decomposing a single epic into stories, which is /nxs.epic, and not for resolving open questions on a foggy initiative, which is /nxs.discover.
---

# nxs-delivery-plan — every milestone is the whole feature, narrower

## Why this skill exists

Architecture decomposition and delivery decomposition answer different questions. An
architecture document splits a feature by runtime component, because that is how the system is
built. A delivery plan splits it by what a person can observe working, because that is how risk
is retired and trust is earned. Reusing the first as the second is the single most common way a
plan stops being agile, and it is the failure this skill is built to prevent.

A plan that inherits the component split produces early milestones that cannot be run,
cannot be demonstrated, and cannot say whether they worked. It usually looks reasonable on the
page, because every milestone is real work in a sensible dependency order. The tell is not in
any single milestone. It is in the answer to one question: **what can the first milestone
claim, honestly, to a person who did not build it?** If the honest answer names a component
rather than an outcome, the plan is component-ordered and needs re-cutting.

The standard this skill holds every plan to:

> From the first milestone onward, the feature runs end to end, completes, and states its own
> outcome. Every later milestone widens what it can survive. No milestone leaves a working
> capability stranded behind a later one.

## Two modes

**Cut** — an accepted design and a scope exist, and no delivery order does yet. Produce the plan.

**Re-cut** — a delivery order exists (epics in an order, a roadmap, a phase plan) and it is
suspect. Audit it first, then produce the replacement. In this mode the plan must open by
saying why the existing order does not deliver incrementally, naming specific milestones and
specific consequences. A re-cut that does not argue against the thing it replaces cannot be
adopted, because nobody can tell what changed or why.

Default to re-cut whenever an existing order is in the inputs. Almost every real request is a
re-cut, even when it is phrased as a fresh plan.

## Step 0 — Load the inputs and the writing rules

Invoke the `nxs-prose-style` skill before drafting. This plan is a human-facing artifact whose
whole job is to force one decision: adopt this order, or don't. Prose that has to be reread
spends the reader's judgment on decoding.

Gather, and say in the plan which of these you had:

- The accepted design or high-level design, including its own component decomposition and its
  ship gates or exit criteria.
- The existing epic and story breakdown, with sizes, dependencies, success metrics, and any
  scope-reduction record. Read the success metrics closely: an epic whose metrics count
  internal artifacts rather than outcomes is a component-ordered epic announcing itself.
- The recorded product context and system concepts. These carry the invariants you will
  otherwise invent, and the deployment reality that decides how much transition work is real.
- **Deployment reality.** Is anything in production? Is there live traffic? Is there real
  customer data? A large amount of transition scaffolding — dual-form contracts, tolerant
  readers, reader-before-writer ordering, rollback paths — is only justified by a running
  system. Establish this before you plan any of it, and record the answer, because a plan that
  carries a coexistence window nothing needs is paying for a problem it does not have.

## Step 1 — Find the spine, and make it M1

This is the whole skill. Do it before writing any milestone.

1. **Name the unit of value.** One noun that the feature moves, produces, or changes for
   someone: a record arriving at a destination, a message delivered, a document rendered, a
   payment settled. Not a component, not a definition, not a schema.

2. **Trace its path end to end.** Every hop the unit must cross to be observable at the far
   end by someone who did not build it. This path is the spine. Everything on it is in M1.

3. **Add whatever lets the run state its own outcome.** This is the step most plans get wrong,
   and it is worth being blunt about why. An increment that cannot report whether it worked is
   not a smaller version of the feature. It is a different thing, one that needs a person
   standing next to it with a database query. It cannot be scheduled, it cannot be handed to a
   verifier, its evidence has to be gathered by hand, and its worst failure — reporting success
   before the work landed — is its normal behaviour rather than a bug. So the completion
   mechanism, whatever it is in this system (a barrier, a join, a reconciliation, an
   acknowledgement, a terminal status that is actually terminal), is part of the first
   milestone. It is never a later refinement of the loop. It **is** the loop.

4. **Find the natural ceiling and accept it out loud.** M1 will have a limit it cannot exceed:
   a byte budget, a payload size, a record count, one source type, one destination. Do not
   build the mechanism that lifts the ceiling. State the ceiling as the honest boundary of
   M1's claim, and give the lifting mechanism its own later milestone. A mechanism whose only
   job is to raise a ceiling belongs in the milestone that needs the ceiling raised. This is the
   move that makes a full vertical slice affordable as the first milestone at all, and skipping
   it is why plans conclude that the foundation has to come first.

5. **Write M1's claim as one sentence, in the language of the outcome.** Then test it two ways.
   If the sentence names a component, a definition, a schema, or a compiler, go back to step 2.
   And if the sentence hedges about whether the work landed, the completion mechanism is
   missing. The hedges are recognisable once you look for them: *reports that the fetching
   finished, and the drain state is unknown*; *makes no claim about whether the spawned work
   completed*; *a platform-verification slice, not a customer-facing capability*. A claim that
   has to be qualified this way is telling you what step 3 is for.

The M1 that comes out of this is usually the largest milestone in the plan, often
extra-large, and that is the honest cost of the ordering. Do not shrink it by removing the
completion mechanism. Say plainly that it is large and that it carries most of the plan's
risk, and if the architecture has one central unproven bet, put an **internal checkpoint**
inside M1 at the point that bet first resolves. A checkpoint inside a milestone gets you the
de-risking a probe milestone would have given without shipping an increment that cannot
report its own outcome. It only works if it is treated as a real gate rather than a status
line, so say that too.

## Step 2 — Order the rest by widening axis

Everything not on the spine is a way the feature can be *widened*, not a prerequisite for it.
The usual axes, and each one is a candidate milestone:

| Axis | The question it answers |
|---|---|
| Volume | How much can one run move before it breaks? |
| Size and duration | How large a job can finish at all? |
| Readability | Can a person who did not build it read what happened? |
| Crash detection | Is a job that died reported, or does it just vanish? |
| Failure behaviour | Does a configured failure policy mean what the author chose? |
| Recovery | Can one failed part be redone without redoing everything? |
| Breadth | How many source, destination, or tenant kinds are supported? |
| Configurability | Can an operator change the defaults the platform chose? |

Order them by which constraint a real user hits first, not by which is easiest. Then apply
three corrections:

- **A milestone whose output nobody can see goes after the surface that shows it**, even when
  its hard dependency is earlier. A sweep that produces correct reports nobody reads is
  delivered but not delivering. State this as a soft dependency with the reason.
- **Split on kind of risk, not on theme.** Two pieces of work under one heading — the same
  heading, the same domain — belong in separate milestones when their risk is different in
  kind. Rendering a record you already store is a read. Writing a new record at the start of
  every run adds a persistent artifact and a false-positive mode. Those are different risks
  and they deserve separate milestones even though a roadmap would happily call both
  "observability". Splitting honestly costs time, usually about a week per split, because two
  medium milestones exceed one large one. Say so rather than presenting the split as free.
- **Configurability is the last axis, and often not an axis at all.** Ship the platform
  default. A per-item configuration surface nobody asked for is speculative generation.

### Sizing and count

Aim for milestones a team can finish and review inside one cycle, five to ten working days,
and give each one a day range and a t-shirt size. The count follows from the axes the feature
actually has, which for a substantial feature is usually five to eight. A plan with three
milestones has probably bundled unlike risks together. A plan with twelve has probably split
along component lines again, so re-read the titles: if they name components, the axis slipped.

M1 is the exception and it usually breaks the range, because the spine plus the completion
mechanism is genuinely more than a cycle of work. Size it honestly at whatever it is, say it is
the largest milestone in the plan, and do not buy it back down by moving the completion
mechanism out. Shrinking M1 that way trades a real deliverable for a status report.

## Step 3 — Place every decision in the milestone that binds it

There is no decisions phase. There is no M0. If you find yourself opening the roadmap with a
milestone made of investigations, spikes, "settle the shape of X", or "confirm whether Y", stop
and redistribute every item into the milestone that contains the code depending on it.

The reason is not process purity. A decision taken before the code that depends on it is a
decision taken with the least information anyone involved will ever have. The object store's
deployment shape is decided in the milestone that builds the store. The alert's channel and
its named owner are decided in the milestone that builds the alert. The threshold is decided
in the milestone that builds the thing it throttles, against a measurement the previous
milestone took.

Distinguish two things that look alike on a list, and label them differently in the plan:

- **A decision** is a choice between viable options. It binds where the code lands.
- **A check** is a question answered by looking, not by choosing. Checks also live in the
  milestone whose safety depends on the answer, and the plan says what the answer decides.

Then collect them into a plan-level section listing every decision and the milestone that owns
it. That section is what a reviewer scans to confirm nothing was decided early.

## Step 4 — Run the antipattern sweep

Before writing, read `references/antipatterns.md` and check the draft against every entry.
Each one is a real failure with a symptom you can look for and a repair. Two deserve mention
here because they are the ones a careful planner still walks into:

- **One mechanism split across two milestones.** The producer and the consumer of one
  contract, or two settings of one worker, in different slices. The tell is that you have
  invented transition scaffolding — a tolerant reader, a dual-form payload, a deploy-ordering
  rule, a rollback path — whose only purpose is to survive the gap you created. Merge the
  halves and delete the scaffolding. Then check whether the scaffolding was justified by
  deployment reality at all (Step 0).

- **An invariant applied to an artifact it does not govern.** Recorded invariants are the
  right input and the easiest thing to over-apply. Before an invariant becomes a milestone
  item, name the artifact it governs and the actor it is visible to. A rule about
  user-authored input says nothing about what a compiler may emit. A hazard that needs two
  concurrent jobs cannot occur in a milestone that admits one. Load-bearing work invented this
  way is expensive and it makes the whole plan less trustworthy, because a reviewer who finds
  one invented requirement now has to check them all.

## Step 5 — Write it

Follow `references/plan-template.md`. It carries the full section list, the per-milestone
shape, and the definition of done that applies to every milestone. The essentials, so you know
what you are aiming at:

Each milestone gets a title that is an outcome, not a component. "Records travel by reference",
not "Payload store". "A run is readable", not "Console work". Then: what can be claimed
honestly, who it is for and who verifies it, the content, the decisions taken here and why here,
what is deliberately absent and why, where it was drawn from in the existing breakdown, the
concrete evidence that it worked, and the risk it attacks or carries.

Two of those do unusual amounts of work and are easy to skip:

- **Deliberately absent.** Naming what a milestone does not include, with the reason, is how a
  plan refuses gold-plating in writing. It also stops the review conversation where somebody
  notices the gap and assumes it was missed.
- **Evidence.** Observable pass conditions, not intentions. "The destination count equals the
  source count and the stored summary reconciles against both" is evidence. "Pagination works"
  is not. Include one negative test per milestone: the increment's own primary failure mode,
  deliberately triggered and observed.

Where a re-cut reverses a rule the previous plan held, say what the old reason was and why it
no longer applies. A reader who remembers the old rule and cannot find its refutation will
assume you forgot it.

## Honesty rules that keep the plan usable

- **A re-ordering is not a saving.** State the total, compare it to what the existing plan
  claims, and say plainly that this is the same work in a different order. A plan that arrives
  with a smaller number attached gets adopted for the wrong reason and blamed for the right one.
- **Name where the plan is most likely to be wrong**, per milestone, in its own section. The
  first milestone usually carries most of it.
- **Give each milestone a falsification.** What would this milestone reveal that kills an
  assumption in the design? That column is the point of the ordering, and it is what replaces
  a de-risking probe milestone.
- **Report the unowned work.** Scope that the existing record calls out of scope but describes
  as ship-blocking and unowned is not a scope decision. Put it back with an owner and a
  milestone, or with a named constraint on when it must land.
- **Correct the numbers before using them.** If the existing breakdown asserts a figure — a
  page count, a capacity, a duration — that turns out to be wrong or to be a different unit
  than it appears, correct it in its own section before the roadmap, and say what the
  correction changes about what the plan can promise. A roadmap built on a wrong number is
  wrong in places nobody will look.
- **Prove the re-cut still delivers every goal.** Changing the slicing axis is the easiest way
  to lose a goal, because a goal that used to be one epic's whole purpose is now spread across
  three milestones or across none. Before presenting the plan, map each recorded goal or
  success criterion to the milestones that deliver it, and put the mapping in the document. A
  goal that maps to nothing is either a gap you have to schedule or scope somebody dropped
  without deciding to.

## Output

Write to `.nexus/tmp/<feature-slug>-delivery-plan.md`, which is gitignored working space. Date
the draft, and on a revision append a short revision note at the top saying what changed and
why rather than silently rewriting, because the reader is usually someone who reviewed the
previous version.

Then present the decision, not the document. The reader needs: the slicing axis in one
sentence, the milestone titles in order, the material changes against the existing breakdown,
the total estimate against the old total, and the question — adopt this order? Anything you
added that they did not ask for gets flagged as such so they can cut it.

This plan is a working document, not a Nexus pipeline artifact. It feeds the re-scoping of
epics, the ordering of story issues, and the decision records that follow. It does not replace
the scope analysis or the accepted design, and it should say so in its own opening lines.
