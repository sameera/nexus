---
date: 2026-10-01
epic: "Complete, error-aware evidence from stories to pull requests for close"
source: "#827"
---

# Lesson: test a new report against the epic that ships it

Estimated M. Shipped as one pull request with one commit per story, carrying three releases (0.80.0–0.82.0). Analyze found 0 critical, 0 high and 1 low finding. The three stories landed as planned. The first story commit also had to fix two failures already on main.

What to do differently:

- **Run the new report on its own epic before close.** The evidence report's first live run was the close of this epic. It reported "no receipt" for all three stories, although the receipt named them. The pull request body named only the epic. The stories were closed by `Closes #<story>` lines in commit messages, which GitHub does not turn into closing links. Every acceptance test used fixtures. A story for a report that reads the issue graph should include one acceptance criterion run against a real merged pull request of the shape the pipeline itself produces.
- **Keep main green between epics.** The suite was red on main when this branch started, because the previous release grew `/nxs.distill` past a recorded ceiling. This epic absorbed the fix in an unrelated stage. A release that changes a stage's size should re-record its ceilings in the same commit.
