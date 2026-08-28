---
title: "Release Identity"
aliases: ["release version", "one version identity", "version verb", "single version declaration", "no per-repository version pin"]
touches: ["portable-tooling", "verb-reachability", "toolkit-location", "writer-stamp", "environment-guard", "release-changelog", "published-package", "install-location"]
last_updated_by: "#351"
status: active
verification: verified
---

# Release Identity

One semantic version identifies the whole release — both toolkits and the component payload together — because they ship as one artifact and cannot be at different versions. That version is declared exactly once at the release root, and a verb reports it alongside the payload fingerprint and the resolved interpreter.

## How It Works

The declaration is a single file at the release root. Neither toolkit carries a version literal, nor is generated at build time: both reach it through one shared reader walking up from its own position until the declaration appears. That walk is what lets one declaration serve both postures without a build step — in a source checkout it lands on the repository root, in a distributable on the package root the halves are installed under, with neither layout written down anywhere.

A verb reports the release as one object on standard output: the version, the component payload's fingerprint, and the interpreter the other half runs on with its version. The payload it fingerprints is the one that would actually be installed, not a committed pin that does not travel with the release. Because this is the verb a user runs when something is already broken, an environment it cannot resolve is reported as unresolved and the verb still succeeds.

A release-time check compares that declaration against the published manifest, the newest changelog entry and the tag, naming each divergence.

An unresolved declaration reads as absent, never as a default: a reader already knows how to treat an absent version, and a fabricated one asserts something untrue.

## Key Invariants

1. One version covers both toolkits and the component payload together; neither half carries a version of its own.
2. The version is declared exactly once, at the release root; the published manifest, the newest changelog entry and the release tag must all name it.
3. One shared reader both halves depend on walks up from its own position to that declaration, so they cannot disagree and no layout is recorded.
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
- [release-changelog](release-changelog.md) — its newest entry names this version, and carries in words the breaking-change signal a below-1.0 number cannot.
- [published-package](published-package.md) — the package whose staged layout puts both toolkits at a fixed depth beneath this one declaration.
- [install-location](install-location.md) — the account-scoped location this read-out reports beside the release, naming which content is present and, when it holds pointers, the checkout they resolve into.

## Decision Log

### 2026-08-26 — #251 — One declaration at the release root, found by walking up

The release's version is declared in a single file at the release root and reached by walking up from each toolkit's own file position. One declaration serves the source checkout and the distributable with no build step and no second copy to keep in step, which is exactly what "neither half carries a version of its own" asks for. The verb fingerprints the vendored payload when it exists and the live component tree otherwise, so both postures report the components that would actually be installed. An unresolved version is absent rather than a default, because a fabricated version in a stamp is worse than a missing one. Refuted: declaring the version in the package manifest and inlining it at build time — the Python half cannot read a bundler define, and a walk-up for a manifest has to match on package name, which writes the layout down twice; and reading the committed fingerprint pin, which does not travel with the distributable and so reports nothing in the posture that matters most.

### 2026-08-27 — #252 — Four declarations, one check, and a number that stops signalling breakage

A release now has four places that name its version, so agreement between them became something to check rather than to assume: the check compares all four against the one declaration and names each divergence, which is what an author needs on release day rather than a single pass or fail. Releases stay below 1.0 while the package shape, the install surface and the invocation contract are still moving, and the cost of that is explicit — a minor bump may break a pipeline, so the signal moves into the changelog's words rather than disappearing. Refuted: cutting the first published version at 1.0, which gives adopters the strongest contract from day one but commits to compatibility guarantees before the invocation contract and the install verbs have shipped.

### 2026-08-28 — #256 — Reciprocal link from install-location

Mechanical reciprocity fan-out: the install-location page names this read-out as where an owner learns which content is present, so the release report and the account's component set are reachable from each other.

### 2026-08-28 — #351 — One shared reader, placed as a leaf, so the two names cannot disagree

The version reader lived inside the part that also builds the release and runs the build gates. When the second toolkit became a library in the same workspace, reaching into that part would have made it both depend on and be depended on by the toolkit — a cycle — so the reader was relocated into a leaf both bundles depend on. That placement is also what makes both names report the same value by construction rather than by agreement: there is one reader, not two walks that happen to land on the same file. **Refuted alternative:** give the toolkit its own version reader — cheap and cycle-free, but it recreates the exact duplication the single version declaration exists to prevent, in the one place where a divergence stays invisible until someone reads a stale stamp.
