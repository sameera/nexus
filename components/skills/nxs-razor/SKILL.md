---
name: nxs-razor
description: The razor — the one normative statement of the provenance rule, the counted limits, the content rules and the necessity question that every Nexus drafting stage authors under. Load it before drafting an epic, a decision record, or a discovery ticket; the mechanical half of it is enforced by `nexus razor-check`, whose constants are pinned to this file's numbers by a conformance test.
---

# nxs-razor

Every other gate in this pipeline measures effort or testability. None of them asks whether anyone
asked for the scope. The razor is that missing axis, and this file is its **one normative home**
(epic #284). Three drafting stages load it — `/nxs.epic`, `/nxs.decision-record`, `/nxs.discover` —
and each of their templates restates only the short phrase that bounds the heading it sits beside.
**Where a restatement and this file disagree, this file governs**, and the checker enforces this
file's numbers.

This is a guidance skill. It is loaded into the context that is *writing*, because the razor has to
shape the draft as it is written; a rule that could only be applied to a finished draft would belong
in an agent instead.

## 1. The provenance rule

Every **acceptance criterion**, **assumption** and **out-of-scope item** in a drafted epic carries
exactly one of two labels, written inline immediately after the item it labels:

    - <the item> `[asked: "<verbatim fragment of the source text>"]`
    - <the item> `[inferred]`

- **`asked`** — the lead asked for this. The fragment is quoted from the run's source text.
- **`inferred`** — the drafting model added this. Not a confession; a fact a reviewer needs.

**The vocabulary is two-valued and stays that way.** No "partly asked", no confidence score, no
third state anywhere the razor reaches. A third value restores the judgment call the rule exists to
remove: the model then labels its own additions with the softest value that survives review.

The labels are **drafting-time only**. They serve three readers — the author writing, the gate
comparing, the digest building its cut list — and none of them is the durable reader of a filed
issue. See §4.

## 2. The run's source text is materialized once, before any item is labelled

Before labelling anything, write the text the run was given, **verbatim**, into a single file beside
the draft in the same session-scratch folder:

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
location, so it cannot see what the lead typed. Typed intent has no durable home at all, so there is
nothing to re-fetch in the mode that needs it most. And a stub body edited between drafting and the
gate would otherwise let the gate check against a source the draft was never written from.

`source.md` is session scratch. It is never committed, never enters the queue, and never written
under the documentation tree — and it may contain anything the lead typed, including a credential
pasted into an intent, so **no part of it is ever posted to an issue, a comment or a report.**

## 3. What makes a citation hold

The comparison is **normalized substring containment**, run by `nexus razor-check` and never by eye:

1. Normalize the fragment and the source text identically — collapse whitespace runs to one space,
   fold case, map typographic quotes (`" " ' '`) and dashes (`— –`) to their plain forms, trim.
2. The fragment holds if the normalized source text **contains** the normalized fragment.
3. A fragment shorter than **four words** fails as if it were absent.

Normalization is deliberate slack, and the word floor is the counterweight. A model re-typing a
quote substitutes typographic quotes and trims whitespace as a matter of course; blocking on that
teaches the lead to reword until the gate relents, which is how an enforced rule becomes a
negotiated one. Without the floor, citing one common word would satisfy the rule for every item and
the citation would mean nothing.

There is no fuzzy or semantic comparison. It would catch a real gaming case, but it reintroduces the
judgment this rule exists to remove and makes the verdict irreproducible run to run.

**What the check proves is that the quote exists — not that it licenses the item.** A reviewer who
wants to see whether a fragment actually supports what it is attached to reads the fragment; the
gate cannot decide that for them.

## 4. No drafting-time token reaches a filed body

Three vocabularies exist only while a draft is being written, and none of them is a filed body's to
carry:

| Token | Written by | Form |
|---|---|---|
| provenance label | the drafting stage (§1) | `[inferred]`, `[asked: "…"]` |
| template placeholder | the template the draft was started from | `{{…}}` |
| observation marker | a gate's advisory render (§6, §9) | `⚠️ razor:` |

When filing begins, the stage derives a **clean body** from the labelled draft by removing every
label and fragment, and then runs the checker in assertion mode over that derived body. **A
surviving token of any of the three kinds fails the run before any issue is created or updated.**

Only the label is derived away. A surviving placeholder is a question nobody answered and a
surviving marker is a verdict the body was never meant to state, so the assertion **reports** those
two for a human to resolve rather than deleting them.

The observation marker is a distinct sentinel rather than a bare warning symbol on purpose: a filed
body may legitimately carry a warning callout of its own — the epic's utilization-risk banner is one
— and a rule that banned the symbol would ban the body's own content with it. Every advisory render
in the pipeline prefixes its observation with `⚠️ razor:` so there is exactly one string to assert.

The assertion is the point. "Remember to strip the labels" is an instruction a model can drop, and
"replace every placeholder" is one a template can only ask for; this is a condition that is checked,
at the cost of one more invocation of a tool that already ran.

## 5. The counted limits

**This table is the normative statement of the numbers.** A drafting template may restate one as a
short phrase beside the heading it bounds; that restatement is a pointer, never a source. The
checker holds the one implementation of them, and a conformance test pins its constants to this
table — so the two cannot drift apart without failing a build, and where a restatement disagrees
with this page, this page governs.

| What is counted | Limit | Escape |
|---|---|---|
| acceptance criteria on one story | three to five | above five: one stated reason for the story |
| items under `## Assumptions` | no more than five | none — the section may be empty |
| items under `## Out of Scope` | no more than five | none — the section may be empty |

**Only the ceiling blocks.** The lower bound of three is drafting guidance and is never checked:
**no minimum-count check exists anywhere in the razor**, and no rule may require an item to be
generated to satisfy a floor. A blocking floor is a generation mandate — a story with two genuinely
sufficient criteria would be held until a third is manufactured, which is the padding the razor
exists to remove.

A story above the ceiling carries **one** labelled line beside its acceptance-criteria heading:

    **Reason for six:** <why the sixth criterion is not a merge of two others>

The reason is per story, not per criterion — the overage is a property of the story, not of the
sixth item. The checker tests only that the reason is **present**; whether it is adequate is the
reviewer's call at the digest, and the digest renders it so they can make it.

## 6. The content rules

**No personas table.** Personas are canonical in the product context. An epic whose personas match
it writes the path and nothing else; a table is written only for a persona specific to this epic or
a deviation from the canonical set. The presence of a table under the personas heading is a
structural test, so it **blocks**.

**No acceptance criterion names a mechanism.** A mechanism is a named product, protocol, data
format, configuration file, or internal component of the system being built. A user-facing surface
the lead interacts with — a command, a gate, a digest — is not a mechanism. A criterion that names
one is decision-record content promoted into binding scope: it fixes the how before anyone has
approved the what.

Mechanism-naming is a judgment and not a count, so it is **prevented here, at drafting time**, and
surfaced downstream only as a non-blocking observation for the reviewer, carrying the `⚠️ razor:`
marker (§4). It never blocks.

**A refuted alternative is offered, not required.** See §9.

## 7. The necessity question

Before the draft is finished, answer: **which of these stories does the smallest usable version of
this capability need?**

The answer is one line in the epic body, under its own heading, and it reaches the filed issue:

    ## Smallest Usable Version

    <the stories the smallest usable version needs, named by title, and nothing else>

This is the one razor rule whose answer a later reader genuinely consumes — it is scope reasoning,
not planning bookkeeping — so unlike the labels it earns a durable home. It is also a lever rather
than a statement: the approval digest sorts the stories it excludes to the top of the cut list, so
the reviewer's eye lands first on what the smallest usable version does not need.

## 8. The cut-gate convention

A gate that shows a reviewer what the model added must also let them delete it, or the labels are
decoration. The only route to less scope otherwise is revise, hand-edit, re-run — expensive enough
that approving as drafted is always the cheaper action, which is the opposite of what the razor is
for.

Two gates render a cut list — the epic approval digest and the decision-record stage's pre-filing
checkpoint. They share this convention and **no implementation**: what is mechanically decidable in
either already lives in `nexus razor-check`, and what is left is prose one stage generates and a
selection it parses.

1. **Numbered prose, grouped by parent.** Stably numbered entries, grouped under the story (or the
   decision) each belongs to. Not one interactive control per item: five stories easily yield twenty
   cuttable items, and paginating them into batches turns one action into several rounds — which is
   no longer cheaper than approving as drafted.
2. **Three coarse actions**, plus any exit that gate already owes: **approve as drafted**, **approve
   with cuts**, **revise**.
3. **Selection is a list of the numbers**, typed. Not a click per item.
4. **An empty selection is identical to plain approval** — no re-derivation, no re-render, no second
   confirmation.
5. **Cuts apply only to content not yet filed.** A cut naming something a prior partial run already
   filed is refused, with the reason stated, never silently ignored.

What the list holds, at the epic digest: every `inferred` item, every wholly inferred story, and each
fully asked-for story the necessity answer (§7) leaves outside the smallest usable version. Those
excluded asked-for stories sort first, and each is **rendered as asked-for** — cutting one removes
something the lead requested, and the reviewer has to be able to see that. An asked-for story is
never offered as an inferred addition.

**At least one story must survive.** An all-stories cut is a revise, not an approval.

## 9. A refuted alternative is offered, not required

The fourth content rule, and the razor's second judgment rule.

**Write a refuted alternative only where a competent engineer might genuinely have chosen it**, and
state the **trade-off it lost on**. A decision with no viable alternative carries no
refuted-alternative line, and **no template may carry a standing slot, placeholder or fixed line for
one**. The line exists only where an alternative was written.

Removing the slot is the point. A fixed line with permission-to-omit in an adjacent comment is
structurally identical to a personas heading with a deviations-only rule beside it, and it produces
the same outcome: the slot gets filled. Removing it removes the generation pressure at its source
rather than asking a model to resist it.

**The provenance rule does not reach here.** A refuted alternative is the model's own by
construction, so `asked` versus `inferred` discriminates nothing, and a third label value would
break the two-valued vocabulary while restoring the self-judgment the razor removes. The question
that discriminates is **viability**, and viability is a judgment — so, like mechanism-naming, it is
prevented at drafting time and reported as a **non-blocking observation** for the reviewer.

Two conditions on that observation:

- It is produced by a party **other than the one that wrote the alternative**. A model asked to
  judge its own additions answers in its own favour, and the author is precisely the party motivated
  to keep them.
- It lives **only in the gate's render**, prefixed with the `⚠️ razor:` marker (§4). It is never
  written into the draft body — and because the marker is one asserted string, a render that leaked
  into a body is caught at filing rather than trusted not to happen.
