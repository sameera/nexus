---
date: 2026-09-10
epic: "Drain an Entry Whose Range Is a List"
source: "#214"
---

# Lesson: A story whose acceptance criterion spans two surfaces gets built on one of them

Epic #214 was estimated M across three stories and shipped close to that estimate. Two stories came
out clean. The third, story #507, came out half built, and the half that is missing is the half the
epic's own success metric depends on for concept pages.

Story #507 asked that every anchor and every provenance line name the pull request it came from.
Record #513 answered that question on two separate surfaces. Per-path attribution would ride the
anchor sidecar's role text. Per-delta attribution would ride the body of the concept page's
decision log entry. Those are two different files, written by two different steps of the drain,
under two different sections of `nxs.distill.md`. The anchor half landed with tests. The decision
log half was never written into the command body at all. Nothing caught it, because each of the
story's three acceptance criteria reads as satisfiable on its own, and two of the three describe
anchors.

The decomposition lesson is that a story whose criteria span two output surfaces should be split
along those surfaces, not along the question it answers. Story #507 answered one question, so it
looked like one story. It wrote to two places, so it was two. Had it been split, the unbuilt half
would have been an open issue at the close gate rather than a deviation discovered by diffing the
shipped code against the record.

There is a second, cheaper lesson about reviewability. The implementation put a literal NUL byte
into a TypeScript source file as a key separator. Git then classified the epic's main
implementation file as binary, so the file that carried almost all of the epic's behaviour showed
in its own pull request as a byte count rather than a diff. Any review that read the pull request
as presented saw nothing of the change. A later epic rewrote the same bytes as Unicode escapes,
which keeps the key value identical and restores the diff. The next epic in this area should treat
a file that turns binary in a diff as a blocking review defect rather than a curiosity, because it
silently removes the main artifact a reviewer and the conformance gate both read.
