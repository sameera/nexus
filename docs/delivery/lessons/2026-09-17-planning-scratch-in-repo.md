---
date: 2026-09-17
epic: "Planning Drafts Live in the Repository's Scratch Folder"
source: "#638"
---

# Lesson: A relocation still needs every prose reference to the old location swept, not just the code

The epic was sized M, five stories, one location contract read by several phases of one command. The build itself landed clean — `/nxs.analyze` found every acceptance criterion met and every invariant holding on the first full-scope pass. The one thing that slipped through was prose: a skill file (`nxs-razor` SKILL.md §2) kept describing `source.md` as living in "harness session scratch" for several commits after the relocation to `RUN_DIR` had already shipped and been tested. `/nxs.analyze` caught the contradiction as a high finding, and it took a follow-up commit to fix.

The record itself also carried an inaccuracy that only implementation surfaced: it named the run-folder identifier for discovery mode as "the source issue number," but discovery mode drafts before anything is filed to GitHub — there is no issue to key on at that point. The record's authors reasoned from the pattern that held for promotion mode without checking whether discovery mode has the same input available.

What the next epic in this area should do differently:

- When a decision record's chosen approach names a rule that spans several files (a location, a variable name, a canonicalisation), treat "every file that states the rule" as part of the epic's own acceptance criteria, not something the conformance gate discovers afterward.
- Before writing a record clause that says "X in mode A and mode B," check that mode B actually produces X. A record written by generalizing from one mode to a structurally different one is a likely source of a close-time deviation.
