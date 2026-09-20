---
name: nxs-razor
description: The one normative statement of the provenance rule, the counted limits, the content rules and the necessity question every Nexus drafting stage authors under. Load it before drafting an epic, a decision record, or a discovery ticket. `nexus razor-check` enforces its mechanical half; a conformance test pins that checker's constants to this file's numbers.
---

# nxs-razor

Other gates in this pipeline measure effort or testability. None asks whether anyone asked for the
scope. The razor is that missing axis, and this file is its **one normative home** (epic #284).
Three drafting stages load it: `/nxs.epic`, `/nxs.decision-record` and `/nxs.discover`. Each of
their templates restates only the short phrase that bounds the heading it sits beside.
**Where a restatement and this file disagree, this file governs.**

This is a guidance skill. It loads into the context that is *writing*, because the razor has to
shape the draft as it is written. A rule that applies only to a finished draft belongs in an agent
instead.

## 1. The provenance rule

Every **acceptance criterion**, **assumption** and **out-of-scope item** in a drafted epic carries
exactly one of two labels. So does **the story heading itself**. The label sits inline, right after
the item it labels:

    - <the item> `[asked: "<verbatim fragment of the source text>"]`
    - <the item> `[inferred]`

- **`asked`**: the lead asked for this. The fragment is quoted from the run's source text.
- **`inferred`**: the drafting model added this. Not a confession; a fact a reviewer needs.

A story's label decides what the approval gate files by default (§8), so it is a claim the reviewer
must be able to reject. The gate therefore renders each asked story's fragment verbatim beside it.
The citation rule (§3) applies unchanged: the check proves the quote exists, not that it licenses the
story.

**The vocabulary is two-valued and stays that way**, at every granularity it reaches, the story
heading included. No "partly asked", no confidence score. No third value anywhere. A third value
restores the judgment call the rule exists to remove: the model then labels its own additions with
the softest value that survives review.

The labels are **drafting-time only**. They serve three readers: the author writing, the gate
comparing, and the digest building its cut list. None of them is the durable reader of a filed
issue. See §4.

## 2. The run's source text is materialized once, before any item is labelled

Before labelling anything, write the text the run was given, **verbatim**, into one file beside the
draft, in the same run folder (`RUN_DIR`) — a folder **inside the checkout**, under the gitignored
`.nexus/tmp/planning/<run-name>/`:

    ${DRAFT_DIR}/source.md

What goes in it, by entry mode:

| Mode | The source text is |
|---|---|
| intent | the capability description the lead typed, verbatim |
| promotion | the stub issue's body, verbatim |
| discovery | the discovery document plus every resolved ticket, concatenated verbatim |

Every citation check in that run compares against **that file and nothing else**. No check re-reads
a live stub issue, a discovery folder, or a command argument.

Three reasons this is a file and not a re-read. The gate is a separate agent handed only a draft
location, so it cannot see what the lead typed. Typed intent has no durable home, so there is nothing
to re-fetch in the mode that needs it most. And a stub body edited between drafting and the gate
would let the gate check against a source the draft was never written from.

`source.md` lives in `RUN_DIR`, inside the checkout. It is never committed, never enters the queue,
and is never written under the documentation tree. It may contain anything the lead typed, including a pasted credential,
so **no part of it is ever posted to an issue, a comment or a report.**

## 3. What makes a citation hold

The comparison is **normalized substring containment**, run by `nexus razor-check` and never by eye:

1. Normalize the fragment and the source text identically: collapse whitespace runs to one space,
   fold case, map typographic quotes (`" " ' '`) and dashes (`— –`) to their plain forms, trim.
2. The fragment holds if the normalized source text **contains** the normalized fragment.
3. A fragment shorter than **four words** fails as if it were absent.

Normalization is deliberate slack; the word floor is its counterweight. A model re-typing a quote
routinely changes quote marks and whitespace. Blocking on that teaches the lead to reword until the
gate relents, so the rule becomes negotiated. Without the floor, one common word would satisfy the
rule for every item.

There is no fuzzy or semantic comparison. It would catch a real gaming case, but it restores the
judgment this rule removes and makes the verdict differ from run to run.

**What the check proves is that the quote exists, not that it licenses the item.** A reviewer who
wants to know whether a fragment supports its item reads the fragment. The gate cannot decide that
for them.

## 4. No drafting-time token reaches a filed body

Three vocabularies exist only while a draft is being written. None belongs in a filed body:

| Token | Written by | Form |
|---|---|---|
| provenance label | the drafting stage (§1) | `[inferred]`, `[asked: "…"]` |
| template placeholder | the template the draft was started from | `{{…}}` |
| observation marker | a gate's advisory render (§6, §9) | `⚠️ razor:` |

When filing begins, the stage derives a **clean body** from the labelled draft by removing every
label and fragment. It then runs the checker in assertion mode over that derived body. **A
surviving token of any of the three kinds fails the run before any issue is created or updated.**

Only the label is derived away. A surviving placeholder is a question nobody answered. A surviving
marker is a verdict the body was never meant to state. So the assertion **reports** those two for a
human to resolve rather than deleting them.

The observation marker is a distinct sentinel, not a bare warning symbol, on purpose. A filed body
may carry a warning callout of its own (the epic's utilization-risk banner is one), and a ban on the
symbol would ban that content too. Every advisory render in the pipeline prefixes its observation
with `⚠️ razor:` so there is exactly one string to assert.

The assertion is the point. "Remember to strip the labels" is an instruction a model can drop, and
"replace every placeholder" is one a template can only ask for. A checked condition costs one more
run of a tool that already ran.

## 5. The counted limits

**This table is the normative statement of the numbers.** A drafting template may restate one as a
short phrase beside the heading it bounds; that restatement is a pointer, never a source. The
checker holds the one implementation, and a conformance test pins its constants to this table, so
the two cannot drift without failing a build.

| What is counted | Limit | Escape |
|---|---|---|
| acceptance criteria on one story | three to five | above five: one stated reason for the story |
| items under `## Assumptions` | no more than five | none; the section may be empty |
| items under `## Out of Scope` | no more than five | none; the section may be empty |

**Only the ceiling blocks.** The lower bound of three is drafting guidance and is never checked:
**no minimum-count check exists anywhere in the razor**, and no rule may require an item to be
generated to satisfy a floor. A blocking floor is a generation mandate: a story with two sufficient
criteria would be held until a third is manufactured, which is the padding the razor exists to
remove.

A story above the ceiling carries **one** labelled line beside its acceptance-criteria heading:

    **Reason for six:** <why the sixth criterion is not a merge of two others>

The reason is per story, not per criterion, because the overage is a property of the story and not
of the sixth item. The checker tests only that the reason is **present**. Whether it is adequate is
the reviewer's call at the digest, which renders the reason for that purpose.

## 6. The content rules

**No personas table.** Personas are canonical in the product context. An epic whose personas match
the canonical set writes the path and nothing else. A table is written only for a persona specific
to this epic or a deviation from the canonical set. A table under the personas heading is a
structural test, so it **blocks**.

**No acceptance criterion names a mechanism.** A mechanism is a named product, protocol, data
format, configuration file, or internal component of the system being built. A user-facing surface
the lead interacts with (a command, a gate, a digest) is not a mechanism. A criterion that names a
mechanism is decision-record content promoted into binding scope: it fixes the how before anyone has
approved the what.

Mechanism-naming is a judgment, not a count, so it is **prevented here, at drafting time**.
Downstream it surfaces only as a non-blocking observation for the reviewer, carrying the
`⚠️ razor:` marker (§4). It never blocks.

**A refuted alternative is offered, not required.** See §9.

## 7. The necessity question

Before the draft is finished, answer: **which of these stories does the smallest usable version of
this capability need?**

The answer is one line in the epic body, under its own heading, and it reaches the filed issue:

    ## Smallest Usable Version

    <the stories the smallest usable version needs, named by title, and nothing else>

This is the one razor rule whose answer a later reader consumes, because it is scope reasoning and
not planning bookkeeping. So unlike the labels it earns a durable home. It is also a lever: the
approval digest sorts the stories the answer excludes to the top of the cut list, so the reviewer
sees first what the smallest usable version does not need.

## 8. The gate conventions

A gate that shows a reviewer what the model added must also let them act on it, or the labels are
decoration. Otherwise the only route to different scope is revise, hand-edit, re-run. That costs
enough that approving as drafted is always cheaper, which is the opposite of what the razor is for.

Two gates render such a list: the epic approval digest and the decision-record stage's pre-filing
checkpoint. They share a **shape** and **no implementation**. What is mechanically decidable in
either already lives in `nexus razor-check`; the rest is prose one stage generates and a selection
it parses. **They no longer share a convention.** One offers addition and the other removal,
because a refuted alternative is not scope and there is nothing at that gate to add it to.

**This page governs where a stage's own wording disagrees with it**, here as everywhere else in this
file. A stage's restatement of either convention is a pointer, never a source.

### The shared shape

1. **Numbered prose, grouped by parent.** Stably numbered entries, grouped under the story (or the
   decision) each belongs to. Not one control per item: five stories yield twenty listed items, and
   paginating them into batches turns one action into several rounds, which is no longer cheaper
   than approving as drafted. A checkbox widget per item is the same failure in another shape — the
   host's question control takes a handful of options and cannot arrive pre-ticked, so the default
   the list exists to state would be unrenderable and an untouched box would read as *drop it*. The
   ticks are therefore **written into the prose**, and the reviewer types what they flip.
2. **Three coarse actions**, plus any exit that gate already owes: two approvals (one plain, one
   naming a selection) and **revise**.
3. **Selection is a list of the numbers**, typed. Not a click per item. One selection covers every
   group the list holds.
4. **An empty selection is identical to plain approval**: no re-derivation, no re-render, no second
   confirmation.
5. **Nothing is applied to content a prior partial run already filed.** A number naming such content
   is refused, with the reason stated, never silently ignored.
6. **The list reaches the reviewer verbatim, inside a fenced code block.** The reviewer reads it in a
   client that renders markdown, and **the tick and the number are the two things the selection
   names** — which are exactly the two a renderer rewrites. Written as markdown list syntax, `- [x]`
   is consumed as a task-list control and the numbers are re-sequenced from the list's own position,
   so the reviewer is shown an unnumbered, untickable list and cannot name anything at all. A fence
   suspends the rendering, so what the gate computed is what the reviewer reads. **The list carries
   no markdown list syntax of its own** either: a block that escapes its fence must still be legible.
   This holds however the list was produced — a stage that renders it by hand is under the same rule
   as one that transcribes a checker's output.

### The planning gate's convention: addition

**The default is **addition**.** A plain approval files the smallest usable version, and nothing
else. Everything the necessity answer (§7) excludes is *offered*, and reaches an issue only if the
reviewer names its number. So scope nobody asked for takes an act of will to acquire rather than an
act of vigilance to avoid.

**The list is that default, written out and pre-ticked.** One numbered checklist holds every story,
every model-added acceptance criterion on a story the default files, and every assumption and
out-of-scope item. A ticked line is what a plain approval files; an unticked one is offered. **A
number flips the line it names** — untick to drop it, tick to add it — so one typed selection
carries both directions and the reviewer reads the filed set rather than assembling it.

Rendering the default *as* the list is the point. A gate that names the filed set in one place and
offers the rest in another makes the reviewer hold two sets in their head and diff them, and what
they approve is then a set they reconstructed rather than one they read.

**Ordering.** Stories come first: the smallest usable version, then the stories it excludes, with
the asked-for ones **sorted ahead** of the model-added ones and each rendered with its story-level
`asked` fragment verbatim — a claim on the lead's authority must be rejectable where the reviewer is
already deciding. Within each band the order follows the ordering block (§10): **what each item
unlocks, and never a ranking by predicted value**. Ranking additions by usefulness would have the
drafting model scoring its own additions, which §9 forbids for the same reason.

**What a tick governs, by kind:**

- **A story.** Opt-in where the necessity answer excludes it, opt-out where it includes it — both
  are one flip of the same list, because a story is a unit of scope that can stand alone.
- **A model-added acceptance criterion**, listed under the story it belongs to and ticked, for the
  stories the default files and no others. A criterion on a story nobody has taken has nothing to be
  ticked against; it arrives with its story. An **asked-for** criterion is not listed at all: it is
  the story's own definition, and striking it is a revise. Making criteria opt-in would let an
  asked-for story file with no criteria at all, which is unverifiable, and §5 admits no
  minimum-count rule to patch that.
- **An assumption or an out-of-scope item**, listed whatever its provenance and ticked. Neither adds
  scope. An assumption states a condition the stories were sized under; an out-of-scope item names
  something the epic will not do. Together they are the boundary the smallest usable version (§7)
  was drawn inside, so removing one does not make the epic smaller — it hides why the epic is the
  size it is, and a later reader fills the gap with scope nobody approved. **Both provenances are
  listed** because the boundary the reviewer approves is the whole of it; the fragment beside each
  line is what tells an inferred one from a stated one, and an inferred boundary is a decision the
  lead never made, which the gate is where they accept or strike.

**What the reviewer does not take is treated by where it came from.** An unticked **asked-for** story
**defers**: it leaves as one unplanned epic issue, so declining costs nothing and forgets nothing. An
unticked **model-added** story is **discarded** and leaves no trace — no issue, no note, no later
triage. Regenerating it later is cheaper than carrying it as an open item somebody has to answer for.

**At least one story is always filed.** A selection leaving none is a revise, not an approval.

### The design-record checkpoint's convention: removal

**The action is **removal**.** The list holds what the model added to the record: every `inferred`
invariant and risk, and every refuted alternative. A plain approval files the record as drafted,
minus nothing.

**This gate has nothing to add to.** Its list is not scope. A refuted alternative is the model's own
by construction (§9), and an invariant or a risk describes an epic whose scope the planning gate has
already settled. There is no smaller usable record to default to and no deferred remainder to file,
so inverting here would invert nothing. It would only turn the cheap deletion of something from a
record into a revise-and-re-run.

## 9. A refuted alternative is offered, not required

The fourth content rule, and the razor's second judgment rule.

**Write a refuted alternative only where a competent engineer might genuinely have chosen it**, and
state the **trade-off it lost on**. A decision with no viable alternative carries no
refuted-alternative line, and **no template may carry a standing slot, placeholder or fixed line for
one**. The line exists only where an alternative was written.

Removing the slot is the point. A fixed line with permission-to-omit in a comment beside it is
structurally identical to a personas heading with a deviations-only rule, and has the same outcome:
the slot gets filled. Removing the slot removes the generation pressure at its source instead of
asking a model to resist it.

**The provenance rule does not reach here.** A refuted alternative is the model's own by
construction, so `asked` versus `inferred` discriminates nothing. A third label value would break the
two-valued vocabulary and restore the self-judgment the razor removes. The question that
discriminates is **viability**, and viability is a judgment. So, like mechanism-naming, it is
prevented at drafting time and reported as a **non-blocking observation** for the reviewer.

Two conditions on that observation:

- It is produced by a party **other than the one that wrote the alternative**. A model asked to
  judge its own additions answers in its own favour, and the author is the party most motivated to
  keep them.
- It lives **only in the gate's render**, prefixed with the `⚠️ razor:` marker (§4). It is never
  written into the draft body. Because the marker is one asserted string, a render that leaked into a
  body is caught at filing rather than trusted not to happen.

## 10. The draft-time ordering block

The necessity answer (§7) names a set of stories. Whether that set can run depends on what each
story waits on, so the dependency graph has to exist **while the draft is being written**. It must
not be assigned after approval, when the reviewer has already decided.

A drafted epic therefore carries one epic-level block, above `## User Stories`:

    ## Implementation Order

    - **<Story Title>** — blocked by: none
    - **<Story Title>** — blocked by: <Story Title>; <Story Title>

**Keyed on titles, never on positions.** Titles are the only stable name a story has before its
issue number exists. A positional reference shifts exactly when the story set is re-scoped at the
gate, the one moment anything relies on it.

**One block, not a line per story.** Each story's section is transcribed verbatim into its issue
body. A blockers line inside a story would therefore land on that story's issue as a second,
never-updated statement of a graph the platform's native edges own.

Matching between this block, the `## Smallest Usable Version` line and the story headings uses the
normalization §3 compares citations with, and **an unmatched name blocks**: a story with no row, a
row naming no story, a blocker naming no story, and a cycle are each a blocking finding of
`nexus razor-check`.

**It dies at filing.** The block is derived away with the provenance labels when the filing body is
derived (§4), and the assertion against surviving drafting-time tokens covers it. After filing, the
platform's native dependency edges are the only authoritative ordering and the block is **never read
again**.

## 11. The closure rule

**A set of stories that cannot run without a story it excludes is not a usable version.** The named
smallest usable version, and the set actually approved for filing, are each closed under the
blockers §10 records.

One rule, applied twice, both times in `nexus razor-check` rather than in a gate's prose, because a
model can drop a gate instruction:

1. **At drafting time**, over the `## Smallest Usable Version` line. A name matching no story blocks.
   A story in the set waiting on a story outside it blocks, and the finding **names both stories and
   the draft it is in**. It blocks *before the gate renders*, so the reviewer is never shown a set
   that cannot run.
2. **At apply time**, over the approved set after any addition, before any issue is created, and
   **before the draft's graph is edited at all**. The arm reads the ordering block as the drafter
   wrote it. A gate that first deletes a dropped story's row, or re-parents its dependents onto that
   story's own blockers, leaves every approved set closed by construction: the edge the rule exists
   to catch has been rewritten, and the arm can no longer fire in the direction the addition
   convention (§8) added it for.

**A set that fails the apply-time arm returns to the gate's choice.** Nothing is re-parented and
nothing is added on the reviewer's behalf. The selection names exactly what joins the filed set, so a
set silently re-wired to run is a set nobody approved. The reviewer takes the blocker too, or drops
the addition.

A draft that carries no `## Smallest Usable Version` section raises **no finding** here, and this
rule adds no minimum-count check of any kind. §5's ban is not narrowed by it.
