---
title: "Focus Marking"
aliases: ["learner or handoff", "slice mark", "recorded focus", "whole roadmap in focus", "focus verdict", "no focus means every slice"]
touches: ["story-concept-extraction", "plan-draft", "learner-folder", "handoff-prompt", "plan-rewrite", "coverage-check", "plan-approval-gate"]
last_updated_by: "#458"
status: active
verification: verified
---

# Focus Marking

Every slice a planning pass writes carries exactly one mark: the learner builds it, or it is handed to a coding-agent session the learner runs separately. The mark is judged against the focus the learner recorded in their own words at the interview, and the pass asks the learner nothing. A learner who named no focus has the whole roadmap in focus, so none of their slices is handed off.

## How It Works

Whether a story serves what someone came to learn is a question about what that story builds. A concept list only approximates it, and a focus stated as something to build cannot be judged from concepts at all, so the verdict comes from the same single read that produced the story's concepts rather than from a second judgement over the lists.

The no-focus case is decided in code, from the interview's explicit statement that the whole roadmap is in focus — never from the story list the interview wrote out. That list goes stale when the roadmap is re-resolved, so a story added afterwards would be handed off for that reason alone. A missing interview stops the pass before any story is read, because the pass cannot repair one by asking.

A named focus that matches no story still writes the draft and says so; whether the boundary is right is the reviewer's call at approval. A reviewer may override a story's mark at the gate, and the override survives later re-plans until cleared, so a hand-set boundary is not undone by drift.

## Key Invariants

1. Every slice carries exactly one mark, learner or handoff, and the write refuses any other value.
2. When the interview puts the whole roadmap in focus, every slice is marked learner and no verdict is requested.
3. ~~The pass takes focus only from the recorded interview and asks the learner nothing.~~ It takes focus from the recorded interview and the reviewer's recorded overrides, and asks the learner nothing.
4. A missing or unreadable interview stops the pass before any story is read.
5. The no-focus case is read from the interview's explicit statement, never from the story list it wrote out.
6. The focus words and any verdict reason appear on no stub and in no committed file.
7. A handoff mark builds nothing: no handoff is recorded, no prompt written and no session started.

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
