---
title: "Focus Marking"
aliases: ["learner or handoff", "slice mark", "recorded focus", "whole roadmap in focus", "focus verdict", "no focus means every slice"]
touches: ["story-concept-extraction", "plan-draft", "learner-folder", "handoff-prompt"]
last_updated_by: "#456"
status: active
verification: verified
---

# Focus Marking

Every slice a planning pass writes carries exactly one mark: the learner builds it, or it is handed to a coding-agent session the learner runs separately. The mark is judged against the focus the learner recorded in their own words at the interview, and the pass asks the learner nothing. A learner who named no focus has the whole roadmap in focus, so none of their slices is handed off.

## How It Works

Whether a story serves what someone came to learn is a question about what that story builds. A concept list only approximates it, and a focus stated as something to build cannot be judged from concepts at all, so the verdict comes from the same single read that produced the story's concepts rather than from a second judgement over the lists.

The no-focus case is decided in code, from the interview's explicit statement that the whole roadmap is in focus — never from the story list the interview wrote out. That list goes stale when the roadmap is re-resolved, so a story added afterwards would be handed off for that reason alone. A missing interview stops the pass before any story is read, because the pass cannot repair one by asking.

A named focus that matches no story still writes the draft and says so; whether the boundary is right is the reviewer's call at approval.

## Key Invariants

1. Every slice carries exactly one mark, learner or handoff, and the write refuses any other value.
2. When the interview puts the whole roadmap in focus, every slice is marked learner and no verdict is requested.
3. The pass takes focus only from the recorded interview and asks the learner nothing.
4. A missing or unreadable interview stops the pass before any story is read.
5. The no-focus case is read from the interview's explicit statement, never from the story list it wrote out.
6. The focus words and any verdict reason appear on no stub and in no committed file.
7. A handoff mark builds nothing: no handoff is recorded, no prompt written and no session started.

## Integration Points

- [story-concept-extraction](story-concept-extraction.md) — the single read that returns this verdict alongside the story's concepts.
- [plan-draft](plan-draft.md) — the stub the mark lands on, which carries nothing besides its story once the mark is handoff.
- [learner-folder](learner-folder.md) — where a verdict's reason is filed, because the reason a slice was handed off is a personal record.
- [handoff-prompt](handoff-prompt.md) — what a handoff mark eventually produces when the approved plan is taught, never here.

## Decision Log

### 2026-09-11 — #456 — The mark is judged in the same read as the concepts

The pass reads each story once, and only the unit reading it holds its text, so the verdict is returned from that read rather than decided afterwards from the lists. What a story builds is what the question is about, and a concept list is a lossy stand-in for it — a focus phrased as something to build could not be judged from concepts at all. Verdicts spread across units can be inconsistent, which is accepted because two later checks catch a wrongly drawn boundary before anything is taught: the coverage check fails a learner slice that assumes a concept only a handed-off slice introduces, and a person reviews every mark at approval. The no-focus case is kept out of judgement entirely and read from the interview's explicit statement, because a reader that treats "no focus" as "nothing in focus" hands off the whole roadmap, and reading the recorded story list instead would hand off every story added after the interview. Refuted alternative: after the merge, have the planning session mark every slice itself by judging the concept lists against the focus. One judge seeing the whole roadmap draws one boundary and can revise a mark without re-reading a story, but the stage's most consequential decision would then rest on the stand-in rather than on the story.
