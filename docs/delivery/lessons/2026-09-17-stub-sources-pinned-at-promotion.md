---
date: 2026-09-17
epic: "A stub's sources are pinned when its epic is promoted"
source: "#459"
---

# Lesson: Place a pipeline step by when its output is read, not by what its input needs

The epic was sized S with two stories. The main feature landed in two commits. Two more fix commits followed, and the pinning step moved from `/nxs.close` to `/nxs.decision-record`.

The epic placed pinning at "promotion", where the decision record and the diff are both available. That placement served the step's inputs. It ignored when the output is read. A lesson is written before the learner builds the story, and close runs only after every story merges. Close-time pinning would therefore always land after the lessons it grounds. The analyze run on PR #626 found this, not planning.

The move also invalidated #625 AC3 ("Given the slice's story is implemented"). The exemplar became a file already in the tree, because the story's own code does not exist yet at approval.

What the next epic in this area should do differently:

- When an epic adds a step that feeds another stage, state in the epic when that consumer reads the output. Then check the proposed placement against that read time before filing stories.
- Write acceptance-criteria preconditions only after the placement is fixed. A precondition such as "the story is implemented" carries a timing assumption.
- An S estimate for a cross-stage mechanism should allow for one placement revision.
