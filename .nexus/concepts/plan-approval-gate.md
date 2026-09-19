---
title: "Plan Approval Gate"
aliases: ["approval gate", "gate digest", "mark override", "draft fingerprint", "one gate for the whole roadmap", "declining writes nothing"]
touches: ["plan-draft", "coverage-check", "teaching-plan", "plan-field-ownership", "plan-re-approval", "focus-marking"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Plan Approval Gate

Plan Approval Gate is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

## How It Works

Nothing here asserts the concept any more. The teaching stage left Nexus as its own package,
and its knowledge left with it — one page, one decision log, one place it can be wrong. What
stayed is this stub, because two things still need the name. A reader who greps an old slug
gets an answer instead of silence. And the pages here that name this one keep a live edge: an
edge whose other end is gone is a dead edge, which reads as though the interaction lapsed when
in fact it only moved.

The bullets below are the interactions as they stood when the page left. They are a map to
follow, not a claim about today; the page in the teaching repository is what is current.

## Key Invariants

1. This entry asserts nothing about behaviour; the page in the teaching repository is the one that does.
2. The name keeps resolving here, so a reader who searches the old slug is told where it went.
3. Edges from pages that stayed keep resolving, so no page here carries an edge whose other end is gone.

## Integration Points

- [plan-draft](plan-draft.md) — the uncommitted draft this gate reads, prints and turns into the committed plan on approval.
- [coverage-check](coverage-check.md) — the verdict this gate recomputes rather than trusts, and the gaps a refusal names.
- [teaching-plan](teaching-plan.md) — what approval writes: the committed plan the shipped session teaches from.
- [plan-field-ownership](plan-field-ownership.md) — which fields approval itself fills, and which it leaves for the reviewer and the session.
- [plan-re-approval](plan-re-approval.md) — the second and later passes through this same gate, after a story has drifted.
- [focus-marking](focus-marking.md) — the mark a reviewer overrides here, recorded per story and surviving later re-plans.

## Decision Log

### 2026-09-13 — #458 — The gate is a digest printed by code, and the coverage refusal recomputes rather than trusts

The draft is a file an agent can write, so a recorded clean verdict is the cheapest way around the gate: the refusal recomputes coverage over the draft's slices and refuses a recorded verdict the fresh check contradicts, in the step that prints the gate and again in the step that writes the approval. The digest is printed by code because an agent's summary can drop a slice and nothing can check that it did not. Showing story titles breaks the earlier rule that a planning session holds no story text; a sequence of bare issue numbers cannot be reviewed, so titles are printed one line each and quoted as data while bodies stay out. Approval is bound to what was printed by a fingerprint of the printed text, because the alternative — re-printing the gate inside approval and approving whatever it shows — approves a draft nobody read. Refuted alternative: render the gate as a workbook page, which reads better for a long roadmap and could draw the graph. It lost because workbook pages are committed and the gate carries the learner's own words, and a page outside the store would be a second rendered output with a different lifetime. Refuted alternative: let the agent summarise the draft in its own prose, which lets it stress what matters for this plan — refuted for the same reason the code print exists.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
