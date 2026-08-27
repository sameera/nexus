---
title: "Release Identity"
aliases: ["release version", "one version identity", "version verb", "single version declaration", "no per-repository version pin"]
touches: ["portable-tooling", "verb-reachability", "toolkit-location", "writer-stamp", "environment-guard"]
last_updated_by: "#251"
status: active
verification: verified
---

# Release Identity

One semantic version identifies the whole release — both toolkits and the component payload together — because they ship as one artifact and cannot be at different versions. That version is declared exactly once at the release root, and a verb reports it alongside the payload fingerprint and the resolved interpreter.

## How It Works

The declaration is a single file at the release root. Neither toolkit carries a version literal, and neither is generated at build time: each reaches the one declaration by walking up from its own file position until it appears. That walk is what lets one declaration serve both postures without a build step — in a source checkout it lands on the repository root, in a distributable on the package root the halves are installed under, with neither layout written down anywhere.

A verb reports the release as one object on standard output: the version, the component payload's fingerprint, and the interpreter the other half runs on with its version. The payload it fingerprints is the one that would actually be installed — the copy vendored beside the artifact when it exists, the live component tree otherwise — rather than a committed pin that does not travel with the distributable. Because this is the verb a user runs when something is already broken, an environment it cannot resolve is reported as unresolved and the verb still succeeds.

An unresolved declaration reads as absent, never as a default: a reader already knows how to treat an absent version, and a fabricated one asserts something untrue.

## Key Invariants

1. One version covers both toolkits and the component payload together; neither half carries a version of its own.
2. The version is declared exactly once, at the release root, with no build step and no second copy to keep in step.
3. Each half finds that declaration by walking up from its own file position, so no layout is written down anywhere.
4. An unresolved version is reported as absent, never as a guessed or default value.
5. The version verb reports the payload that would actually be installed, not a committed fingerprint pin.
6. The version verb still reports and still succeeds when part of the environment cannot be resolved.
7. No adopter repository carries a Nexus version pin of its own.

## Integration Points

- [portable-tooling](portable-tooling.md) — the one distributable this version identifies, whose vendored payload the verb fingerprints.
- [verb-reachability](verb-reachability.md) — the registry on each toolkit that this reporting verb is declared in, under the one-JSON-object verb contract it inherits.
- [toolkit-location](toolkit-location.md) — the same self-locating rule, applied to the declaration rather than the entry point: walk up from your own position, assume no layout.
- [writer-stamp](writer-stamp.md) — the identity a stamp records; an unresolved version is what makes a writer unknown rather than wrong.
- [environment-guard](environment-guard.md) — shares the interpreter resolution the verb reports, and fires on defects rather than on any difference between two versions.

## Decision Log

### 2026-08-26 — #251 — One declaration at the release root, found by walking up

The release's version is declared in a single file at the release root and reached by walking up from each toolkit's own file position. One declaration serves the source checkout and the distributable with no build step and no second copy to keep in step, which is exactly what "neither half carries a version of its own" asks for. The verb fingerprints the vendored payload when it exists and the live component tree otherwise, so both postures report the components that would actually be installed. An unresolved version is absent rather than a default, because a fabricated version in a stamp is worse than a missing one. Refuted: declaring the version in the package manifest and inlining it at build time — the Python half cannot read a bundler define, and a walk-up for a manifest has to match on package name, which writes the layout down twice; and reading the committed fingerprint pin, which does not travel with the distributable and so reports nothing in the posture that matters most.
