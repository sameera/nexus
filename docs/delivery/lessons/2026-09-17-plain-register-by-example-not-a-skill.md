---
date: 2026-09-17
epic: "Plain register by example and by lint, not by a resident skill"
source: "#634"
---

# Lesson: a 200-word rule list cannot outweigh 35,000 words of counter-example

The epic's own diagnosis held up in practice: the stage files themselves, not the rules
telling a model how to write them, set the register the model writes in. Deleting the
nxs-prose-style skill and rewriting the five stage files plain, with a short rule block
placed at the point of drafting instead of at stage load, produced the wanted effect. The
skill's removal is a small, mechanical change; the file rewrite is where the actual cost
sat, and it sat there because five large files had to be edited by hand while keeping
every heading, gate name, and command line unchanged.

Two things the next epic in this area should carry forward. First, "the existing tests
pass without being edited" is too strong a bar for a rewrite that deletes something the
tests assert against — a test checking for the deleted thing has to change or it can never
pass again, and that is not a regression. State that exception in the record next time
instead of finding it at close. Second, a wording sweep this wide missed three instances
of banned words on the first pass ("load-bearing" once, "governs" twice); the epic closed
with that gap waived rather than fixed at close, on purpose, to keep the fix separate from
the close itself. The mechanical lint that was deferred out of this epic (em-dash counts,
the banned-word list, long-sentence and pronoun-opening checks in the razor checker) is the
right next step so a leftover instance like this, or a future edit to these same files,
cannot drift further without a gate catching it.
