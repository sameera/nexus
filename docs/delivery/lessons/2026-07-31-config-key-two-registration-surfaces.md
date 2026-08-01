---
date: 2026-07-31
epic: "Configurable Worktree Location for the --pr Flow"
source: "#178"
---

# Lesson: a "single schema" claim is worth verifying before it sizes an epic

The epic's Notes asserted that the `github:` block is a single key map that both the settings reader
and the hub-defaults layer translate through — which made story #180 (hub declares the key) look
almost free, a thin layer on top of #179. It was not true. The hub manifest validator carries its own
independent allowlist, and it had *already* drifted: four keys existed in the resolver map and not in
the allowlist, so a hub declaring any of them failed validation before this epic started.

The design stage caught it and named it as an ADDRESS risk, which is why the epic landed clean rather
than shipping #179 green and #180 silently broken. The cost of the catch was one extra registration
point and one extra test; the cost of missing it would have been a story whose acceptance criterion
("validation passes rather than reporting the key as unknown") fails at the very end of the epic,
after both stories were called done.

**For the next epic in this area:** when planning notes claim two consumers share one schema, one
registry, or one parser, treat that as a claim to check during design, not a premise to estimate
from. The check is cheap — grep both surfaces for a key that exists in one of them. In this codebase
specifically, the `github:` block has **two** registration surfaces (`_GITHUB_KEY_TO_NORMALIZED` in
`delivery_config.py` and `GITHUB_DEFAULT_KEYS` in `manifest.ts`), and adding a key to only one leaves
either the repo-level or the hub-level behaviour silently failing. The pre-existing four-key gap is
now on the feature backlog.

## Estimate vs. actual

Sized M on three drivers — the cross-language config seam, path semantics and safety, and the
byte-identical no-config default. All three held, and the sequencing (#179 first, #180 and #181 both
depending on it and independent of each other) was right: the base-resolution seam had to exist
before either the hub layer or the safety gate had anything to attach to. Three stories, one commit
each, no re-decomposition.

The one place estimation was optimistic was verification altitude, not implementation. The hub story
is verified at the resolver seam plus the manifest allowlist, one hop short of an opened worktree
path, because reaching end to end needs a fixture workspace with a real hub — infrastructure this
epic did not have and did not budget for. Worth pricing in explicitly next time a story's value is
"the hub layer works", since the layering is exactly what a seam-level test cannot demonstrate.

## Decomposition note

Value normalization (quote stripping, `~` expansion) came out of the decision record's own reasoning
and shipped with no acceptance criterion attached to any story — planned scope the stories never
surfaced. It is small and correct here, but the general shape is worth watching: when the design
stage introduces behaviour the stories do not mention, either the story gains a criterion or the
behaviour ships unverified by the epic's own gate.
