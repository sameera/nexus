---
date: 2026-09-13
epic: "Planning Defaults to the Smallest Usable Version"
source: "#576"
---

# Lesson: a rule can ship inert, and the assertion that pins its wording will not notice

This epic moved the closure rule into the shared mechanical checker precisely because a gate
instruction is something a model can drop — the lesson recorded when this feature's first epic closed
named that failure mode, and the decision record cited it. Story #578 shipped the rule, story #579
shipped the apply-time call site, and the conformance test that pins the rule set's prose to the
checker's constants passed throughout.

The apply-time arm could not fire. The gate's own step order re-parented a dropped story's dependents
onto its blockers **before** calling the checker, which left every approved set closed by
construction. The rule was present, enforced, tested, and unreachable in the one direction the
addition convention added it for. It took a later reading of the shipped stage — after all six
stories were closed — to catch it, and the fix (`762fff1`) is a stage-behaviour change large enough to
be its own release, 0.43.0.

**What the next epic in this area should do differently:** when a rule moves into the shared checker
and a stage calls it, the story that ships the call site owes an assertion about the call's
**position**, not only about the rule's text. "The checker blocks X" and "the stage reaches the
checker while X is still true" are two claims, and this feature's whole premise is that the second one
is the fragile one. The existing conformance test asserts wording against constants; nothing asserted
a precondition survived the steps ahead of it.

Two smaller notes, both about the same shape:

- Two modules (`offerList`, `deriveFilingBody`) shipped with no consumer and were caught by the
  analyze gate as scope drift. They were wired rather than deleted, because both are the executable
  statement of a record decision. A story that ships a module the stage only *describes* using has
  not finished; wire it or cut it in the same story.
- Sizing held. Assessed **L** against six stories (four in the smallest usable version, #581 and
  #582 outside it), landed as 23 files and five releases, 0.39.0 through 0.43.0. The record's ADDRESS
  risk — six stories at L, in the area whose last epic overran on this shape — did not materialise;
  no story was added after the record was approved, so the mitigation was never tested. The overrun
  that did occur was a correction round after analyze, not a sizing miss.
