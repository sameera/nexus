---
date: 2026-08-28
epic: "Port the toolkit shell and the shared delivery-config resolver to TypeScript"
source: "#351"
---

# Lesson: a behaviour-preserving port needs a coverage assertion, not just a behaviour suite

Estimated L (1–2 weeks) across seven stories, four of them M. It landed in a single day at 66 files
and +2431/−397. The estimate was wrong in a way worth naming: the epic read as large because it
counted four consumers, a live entry-point switch and an existing test suite to carry across, but
every one of those was mechanical once the key catalogue existed. What actually drives cost in a
port is the number of *decisions*, and the decisions had all been taken at the design gate — ten of
them, two of which resolved the open clarifications before a line was written. The next port in
this line (#352, #353) should be estimated on decisions outstanding, not on files touched.

The one real defect the epic produced is the lesson for the suite. The hub-defaults normalizer
guarded on `normalized !== githubKey`, which silently dropped the two catalogue rows whose
normalized name equals their github spelling from the hub layer. Every spec passed: they asserted
that the hub layer resolves a key, and it did — for the thirteen keys they named. The bug was
invisible to a suite that tests behaviour key by key, and it was caught by the conformance pass
reading invariant 8 against the diff, one commit before close.

The structural fix is cheap and general. When a decision record declares a single catalogue to be
the schema, the suite needs one test that iterates the catalogue itself and asserts the property
holds for **every** row — readable, layerable, resolvable, writable — rather than N tests naming N
keys. That test fails the moment a derivation grows a condition the catalogue does not know about,
which is exactly the drift the catalogue exists to prevent. Any future epic whose record contains a
"one declaration is the schema" decision should carry that coverage assertion as an acceptance
criterion, not leave it to the analyze gate to notice.

Two smaller sequencing notes. First, decomposing so the dispatcher lands before its handlers worked
only because the dispatcher could delegate to the implementation it was replacing — the retained
Python entry made a seven-commit port safe at every commit. A port with no such fallback cannot be
sliced this way and should be estimated accordingly. Second, the D5 and D6 scope edits were ratified
at the design gate but never written back to the epic issue, so the materialized epic read against
superseded acceptance-criteria wording for the whole of implementation. The record was right and the
issue was stale; a design gate that edits a story's acceptance criteria should write the edit back to
the issue at the same moment it records it.
