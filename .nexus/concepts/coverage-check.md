---
title: "Coverage Check"
aliases: ["coverage verdict", "coverage gap", "clean verdict", "focus boundary gap", "gap names the handed-off story", "plan with gaps"]
touches: ["plan-rewrite", "plan-draft", "scaffold-slice", "prior-knowledge-declaration", "focus-marking", "story-concept-extraction", "plan-approval-gate"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Coverage Check

Coverage Check is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

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

- [plan-rewrite](plan-rewrite.md) — the pass sequence this check ends, run over the order it produced.
- [plan-draft](plan-draft.md) — where the verdict is recorded, beside the slices it judges.
- [scaffold-slice](scaffold-slice.md) — removes late-introduction gaps, and never covers a gap this check must report.
- [prior-knowledge-declaration](prior-knowledge-declaration.md) — the declared concepts this check counts as satisfied wherever a slice assumes them.
- [focus-marking](focus-marking.md) — the boundary a gap naming a handed-off story says is drawn in the wrong place.
- [story-concept-extraction](story-concept-extraction.md) — the handed-off story's checked list, the only record of what that story would introduce.
- [plan-approval-gate](plan-approval-gate.md) — runs this check again over the draft's slices before printing and again before writing, and names every gap in its refusal.

## Decision Log

### 2026-09-12 — #457 — Every gap is named, the plan is still written, and the command fails

A gap is diagnosed by reading the plan, because the reviewer needs to see which slice assumes what and where its introducer went. So the rewritten plan is written with its verdict, and the command then fails so the session stops without relying on its instructions. A gap from a handed-off story is reported rather than scaffolded, because it means the focus boundary is wrong, and a scaffold would teach theory for work the learner is not building. The check keeps looking for concepts no earlier slice introduces, even though scaffolds remove that case whenever dependency edges are supplied, because the check must not depend on the scaffold pass having run. Refuted alternative: write nothing when coverage fails, as the draft write does for incomplete input. That keeps one rule for writes, but here the input is complete and the plan itself is the finding, so discarding the plan discards the evidence.

### 2026-09-13 — #458 — The refusal is code that recomputes, at the gate and again at the write

A recorded verdict was the only thing standing between a plan with a gap and a reviewer, and the draft is a file an agent can write — so a hand-set clean verdict was the cheapest way around the gate. The refusal now recomputes coverage over the draft's own slices, in the step that prints the gate and again in the step that writes the approval, and refuses three cases the same way: no verdict at all, a verdict naming a gap, and a recorded verdict a fresh check contradicts. Every gap is named, and nothing in the committed workbook is written. Refuted alternative: trust the recorded verdict alone, which is simpler and keeps one source of truth; it lost because a code refusal that a hand edit defeats is an instruction with extra steps. This entry also records the reciprocal link from plan-approval-gate.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
