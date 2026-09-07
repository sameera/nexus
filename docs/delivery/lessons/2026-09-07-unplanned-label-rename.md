---
date: 2026-09-07
epic: "Rename the Unplanned-Epic Label to needs-refinement"
source: "#466"
---

# Lesson: an enumerated acceptance criterion undercounts a vocabulary rename

## Estimate versus actual

Assessed **S** on three drivers: a single-concern rename, a change spanning two libs plus docs, and
one live GitHub state mutation. The shipped change is 33 files, 78 insertions / 70 deletions across
two stories, landing in three commits with no rework of one story by a later one. The S held —
neither story needed to widen its own boundary, and the epic closed on the first pass with only
low-severity findings.

## What to do differently

**Story #468's acceptance criteria named six files a vocabulary rename must touch. The shipped diff
touched nineteen more.** The AC enumerated the files the author could see at planning time — the
three docs and three code comments that were top of mind — but the actual scope of "reword every
place that names this object" was every prose surface using the term, including command definitions,
templates, and the top-level README and CLAUDE.md that were not in view when the story was written.
The implementer caught this at build time and reworded the full set, correctly, but had to justify it
as a deviation at close rather than the AC simply covering it.

**When a story's acceptance criterion is a rename or terminology change, state it as a property
("every prose surface naming X now says Y") rather than an enumerated file list.** An enumerated list
reads as complete at planning and is almost never complete in practice for a term used in
documentation — new files, and files the planner didn't have loaded, get missed. The property form
also gives the close-from-diff pass something to verify directly, instead of forcing a rationale for
"why more files than listed."
