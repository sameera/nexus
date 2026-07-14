# Parity corpus

Committed fixtures for the parity gate (`src/parity.spec.ts`, STORY-44.03). These are **not**
this repo's concept pages — they are a fixed, representative corpus the parity check runs the
in-repo TypeScript source and a freshly built bundle over, asserting the two produce identical
validator findings, identical exit codes, and byte-identical atlas output.

They live inside the project (not under a shared fixtures root) so the cached nx `test` target
invalidates whenever the corpus, the bundler config, or the fingerprint pin changes
(decision-record Invariant 10).

- `clean/` — well-formed pages; the validator exits 0 with no findings.
- `findings/` — one page per validator finding category; the validator exits non-zero.
- `atlas/` — a clustering graph exercising multiple components, singleton/Standalone handling,
  and degree-then-slug ordering with ties.
- `base/` + `head/` — base-state and head-state pairs for the validator's `--base` append-only
  mode; the spec builds a scratch git repo from them at runtime (commit `base/`, overlay
  `head/`, validate `--base <sha>`).
