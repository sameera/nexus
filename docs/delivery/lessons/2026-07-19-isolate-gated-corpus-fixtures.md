---
date: 2026-07-19
epic: "Domain Taxonomy for the Concept Store"
source: "#89"
---

# Lesson: Sequence shared-corpus fixtures to the story that isolates them, not the story that introduces the grammar

The plan put Story 1's fixture-suite acceptance criterion (one well-formed registry, one
fixture per malformation) against the shared parity corpus, since that is where the corpus
already lives for every other check. In practice, adding any `domains.md` to the corpus's
docs root — even a well-formed one — activates the new registry pass for every existing
corpus case, and a malformed one would additionally pull in Story 2's per-page `domain:`
requirement before Story 2 existed. Story 1 ended up keeping its fixtures as inline template
strings in `domain-registry.spec.ts` / `validate-concepts.spec.ts`, and the shared-corpus
cases (well-formed registry-mode, preserved no-registry fallback) landed with Story 3 inside
an isolated `corpus/registry/` subtree instead.

**Estimation takeaway for the next epic that gates new behavior on a shared fixture (a
corpus, a golden file, a snapshot suite):** a new activation switch on a shared corpus
couples every story that touches that corpus to every other consumer of it, whether or not
that story intended to. Plan the shared-corpus addition into whichever story defines the
final activation surface (here, the atlas story that also proved the no-registry
byte-identity guarantee), not the story that first introduces the underlying grammar — and
budget an isolated subtree/namespace for the new cases up front rather than discovering the
blast radius mid-story.
