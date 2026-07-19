---
date: 2026-07-19
epic: "Planning Surfaces Follow the Docs Root"
source: "#81"
---

# Lesson: for a "replace this path literal everywhere" epic, count the text a command *emits* as its own surface

The M estimate held for the direct work. Four stories shipped in four commits
(`c1b30c8`, `f1c31bb`, `7aa4dcc`, `37b3dec`) and matched the decision record — every
command, skill, and agent that *writes* a feature/product/system/delivery path now prefixes
the resolved docs root, and `/nxs.analyze` found all fourteen acceptance criteria met.

Two surfaces the four stories' command list did not name still had to move, and they split
cleanly into "caught in time" and "caught by the gate":

- **Caught during implementation (good):** `/nxs.council` was never one of the four named
  surfaces, but it invokes the same nxs-pm and nxs-architect agents Story 4 rerouted. The
  engineer traced "who calls these agents" and folded council into Story 4's commit. Without
  that, council would have silently defaulted to `docs` on a hub — the exact bug Story 4 kills.
- **Caught by analyze, a commit late (the slip):** `/nxs.epic` doesn't just *write* paths — it
  *emits an epic template* whose example paths carried a `docs/` literal, and its skill
  description did too. Those aren't runtime write paths, so the "sweep every write site" mental
  model walked right past them. `/nxs.analyze` on the story-complete head (`37b3dec`) flagged it
  high, and it took a fifth commit (`72f0a3f`) plus a re-vendor to route the emitted template and
  fix the description.

**What the next "move a literal across surfaces" epic should do differently:** when scoping,
enumerate surfaces by *who reaches the changed thing*, not by the command list you first write
down. That reach has two edges the naive list misses — a shared sub-agent pulls in **every**
command that invokes it (council, here), and a command that **emits templates or example text**
carries the literal in that emitted text, not only in the paths it writes at runtime. Both belong
in Story 1's scope. Applying the shared-agent reasoning (which the engineer *did* apply to
council) to emitted templates at plan time would have folded the fifth commit into a story and
kept the analyze gate green across every intermediate head.
