---
title: "Focus Marking"
aliases: ["learner or handoff", "slice mark", "recorded focus", "whole roadmap in focus", "focus verdict", "no focus means every slice"]
touches: ["story-concept-extraction", "plan-draft", "learner-folder", "handoff-prompt", "plan-rewrite", "coverage-check", "plan-approval-gate"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Focus Marking

Focus Marking is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

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

- [story-concept-extraction](story-concept-extraction.md) — the single read that returns this verdict alongside the story's concepts.
- [plan-draft](plan-draft.md) — the stub the mark lands on, which carries nothing besides its story once the mark is handoff.
- [learner-folder](learner-folder.md) — where a verdict's reason is filed, because the reason a slice was handed off is a personal record.
- [handoff-prompt](handoff-prompt.md) — what a handoff mark eventually produces when the approved plan is taught, never here.
- [plan-rewrite](plan-rewrite.md) — orders only the slices marked learner, and places each handoff before the learner slice it unblocks.
- [coverage-check](coverage-check.md) — names the handed-off story when a learner slice assumes a concept only that story introduces.
- [plan-approval-gate](plan-approval-gate.md) — where a reviewer overrides a mark, and the only judgement the gate lets them change.

## Decision Log

### 2026-09-11 — #456 — The mark is judged in the same read as the concepts

The pass reads each story once, and only the unit reading it holds its text, so the verdict is returned from that read rather than decided afterwards from the lists. What a story builds is what the question is about, and a concept list is a lossy stand-in for it — a focus phrased as something to build could not be judged from concepts at all. Verdicts spread across units can be inconsistent, which is accepted because two later checks catch a wrongly drawn boundary before anything is taught: the coverage check fails a learner slice that assumes a concept only a handed-off slice introduces, and a person reviews every mark at approval. The no-focus case is kept out of judgement entirely and read from the interview's explicit statement, because a reader that treats "no focus" as "nothing in focus" hands off the whole roadmap, and reading the recorded story list instead would hand off every story added after the interview. Refuted alternative: after the merge, have the planning session mark every slice itself by judging the concept lists against the focus. One judge seeing the whole roadmap draws one boundary and can revise a mark without re-reading a story, but the stage's most consequential decision would then rest on the stand-in rather than on the story.

### 2026-09-12 — #457 — Reciprocal link from plan-rewrite and coverage-check

The mark now decides where a slice sits as well as who builds it. The rewrite orders learner slices and places each handoff immediately before the earliest learner slice it unblocks. The coverage check this page already relied on to catch a wrongly drawn boundary now exists, and it names the handed-off story behind each such gap.

### 2026-09-13 — #458 — A reviewer's mark override is recorded per story and survives later re-plans

The mark was the extraction's verdict and nothing else, so a reviewer who disagreed with where the focus boundary fell had no way to move it. A mark is now the one judgement the approval gate lets a reviewer change: the override is recorded per story beside the draft, and the draft is rebuilt from the checked lists under the recorded merge, the recorded declaration and the overrides — so no story is read again and no judgement is asked for twice. An override stays in force through later re-plans until the reviewer clears it, because one that lapsed would quietly undo the reviewer's boundary the first time the plan drifted. Whether a named focus matched no story is still read from the extraction's verdicts rather than from the marks, so an override never changes what the gate reports about the focus. Refuted alternative: re-run extraction with a corrected focus statement, which fixes the boundary at its source so later re-plans agree with no override list; it lost because it re-reads every story and rewrites the learner's own words to express the reviewer's decision. This entry also records the reciprocal link from plan-approval-gate.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
