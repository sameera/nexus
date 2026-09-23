---
date: 2026-09-21
epic: "The Epic Receipt Accepts and Ranks Published Story Verdicts"
source: "#747"
---

# Lesson: a guard that cannot pass reads exactly like a guard that works

This epic existed because two readers of the same published verdict disagreed and each
reader's own tests encoded its own side of the disagreement, so neither suite could see
the split. The epic then shipped the same shape of defect in the code that fixed it.

The new command's handler stripped one argument too many before parsing, so every
well-formed invocation exited with its usage line. Two tests covered it: one asserting it
refuses without a pull request number, one asserting it refuses without a repository. Both
passed. Both would have passed if the handler read no arguments at all, because each
asserted only a refusal. Nothing invoked the command the way a caller does, with every
argument present, so nothing could observe a command that rejects its own correct use.

Conformance then certified the defect. The analyze pass cited the argument guard that
always fired as evidence that the invariant "every caller names the repository it is
reading" holds. That reading is not careless. A guard that refuses is genuinely what the
invariant asks for, and the only thing separating it from a guard that works is whether
anything gets past it — which is precisely what no test asked.

Two things follow for the next epic in this area.

First, when an invariant says a stage must refuse something, the test that proves it needs
a sibling that proves the stage still accepts the good case. A refusal test alone is
satisfied by a stage that refuses everything. This is the same unstated-is-unknown
reasoning the epic applied to the repository stamp and the author association: absence of
a signal is not evidence of the signal's opposite.

Second, a stage that moves a rule from prose into a command has not finished when the
command exists and the prose is deleted. It has finished when something has run the
command the way the stage will. The defect was found in under a minute by invoking the
command once, by hand, after the merge — and that single invocation was not part of any
gate the pipeline runs. The gap between "the code is tested" and "the thing works" was
one command line wide.
