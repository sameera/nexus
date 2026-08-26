---
date: 2026-08-26
epic: "Make the Python toolkit reachable by name and let it find the executable by name"
source: "#249"
---

# Lesson: an epic that breaks the caller has to say where the interval is recorded

Size held. A complexity-S epic — four stories, three Python files repackaged, resolution replaced in
both directions — landed in one PR of 28 files with zero critical or high conformance findings and no
re-decomposition. The decomposition itself was the reason: #300 ("the toolkit's own callers reach the
Python resolver by name") was carved out as a fourth class of invocation the epic's other goals did
not cover, and giving it its own story with `blocked_by: #297, #298` is what let the intermediate
commits leave the TypeScript suite red on purpose instead of accidentally.

**The lesson is about the interval, not the size.** This epic renames a thing 31 call sites still
address by its old path, and it deliberately ships no shims. That is the right call — a shim could
only have reached the moved package through the repository-relative hop #298 exists to delete — but it
means `main` carries a knowingly broken state until #252. The epic *did* record one such interval:
#299's Notes carry an explicit "Known interval, accepted", with the affected population named as zero.
It recorded nothing for the interval whose affected population is Nexus's own pipeline. `/nxs.analyze`
caught the gap and asked for it to be put on a durable surface before merge; the PR merged without it,
and the note is being filed at close instead.

Two things follow for the next epic in this area.

**When a story ships a rename ahead of its callers, the accepted interval belongs in the epic body, on
the issue that closes it, or on both — never only in a PR comment or the queue scratch.** Both of those
are deleted by the distiller. The failure mode that makes this expensive here is that the broken call
sites are `$(…)` substitutions: they yield empty strings rather than errors, so repo targets and labels
silently resolve to nothing and the pipeline appears to run. An interval whose symptom is silence needs
a louder record than one whose symptom is a stack trace.

**Name the issue that actually closes the interval, not the next one in the sequence.** The obvious
answer here was #250, which rewrites the invocation strings. The real answer is #252, which puts the
name on `PATH` — rewriting a body to say `nexus-gh` fixes nothing while nothing resolves `nexus-gh`.
That correction was made twice during this epic, once in the PR body and once in the analyze re-run.
Sequencing an epic behind "the next story that touches these files" rather than "the story that makes
the new address resolve" is the mistake worth watching for in #250, #252, #253 and #256, which are the
same shape.

**Estimation note for the next one:** the S rollup was accurate for the code, and the work that was
*not* estimated was all of the ratification — capturing a pre-change baseline from `main` and diffing
it across 15 config keys and three query forms, then recording that on #297 to discharge a path-
dependent AC before the mechanism that makes the path work exists. Stories whose ACs are written as
"and #252 declares the binary" carry a demonstration cost that the story-size rollup does not see.
