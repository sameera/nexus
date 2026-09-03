---
name: nxs-razor
description: The razor — the one normative statement of the provenance rule, the counted limits, the content rules and the necessity question that every Nexus drafting stage authors under. Load it before drafting an epic, a decision record, or a discovery ticket; the mechanical half of it is enforced by `nexus razor-check`, which reads this file's numbers and nothing else.
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

When filing begins, the stage derives a **clean body** from the labelled draft by removing every
label and fragment, and then runs the checker in assertion mode over that derived body. **A
surviving token fails the run before any issue is created or updated.**

The assertion is the point. "Remember to strip the labels" is an instruction a model can drop; this
is a condition that is checked, at the cost of one more invocation of a tool that already ran.
