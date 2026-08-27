---
title: "Release Changelog"
aliases: ["changelog", "adopter-language changelog", "release notes", "release entry", "no-change statement", "breaking in words"]
touches: ["release-identity", "published-package"]
last_updated_by: "#252"
status: active
verification: verified
---

# Release Changelog

Once the components leave every repository, an adopter no longer sees a component change in their own diff, and the changelog is what replaces that review surface. Its content rules are executed by the test suite against the live entry rather than left to release-day discipline. Every item says what a lead running a pipeline stage will now experience differently.

## How It Works

Of the failure classes a release can carry to an adopter, the one that fails silently is a change in what a stage decides — no version check detects it. So the rules govern what an entry says, not how it is formatted, and the suite enforces them against the entry itself.

An item may not be a commit subject, a file path or a library version, because none of those is something an adopter runs. A release that touched a component body must name the stage a lead will experience differently. A release that changed no stage behaviour still carries an entry, saying so in exact words rather than going absent. Below 1.0 the version number carries no compatibility signal, so a breaking change to stage behaviour is said in words.

What the suite checks is language, not coverage: nothing derives from the release's own diff which bodies actually moved, so an entry naming some stage passes even when it omits the change this release made. That gap is accepted in writing, and the procedure hands the author the diff to read first.

The entry is authored in the repository and its section is published on the project's releases page, which is the changelog's home.

## Key Invariants

1. Every published release carries an entry; one that changed no stage behaviour says so explicitly rather than being absent.
2. No item is a commit subject, a file path or a library version.
3. When a release touched a component body, an item names the pipeline stage a lead will experience differently.
4. Below 1.0, an entry describing a breaking change to stage behaviour says so in words.
5. The rules are enforced by the suite against the live entry, never stated in the procedure alone.
6. The suite checks language, never coverage; accounting for the release's own component diff is the author's stated judgement.
7. The entry is authored in the repository and published on the project's releases page.

## Integration Points

- [release-identity](release-identity.md) — the newest entry names the release's one version, and is one of the four declarations the identity check compares.
- [published-package](published-package.md) — every release of that package carries an entry here, which is what an adopter reviews instead of their own diff.

## Decision Log

### 2026-08-27 — #252 — The changelog's rules are executed, not documented

The story exists because a release-day habit fails silently, so stating the rules in the procedure would be the very habit it replaces; the suite runs them against the live entry instead, and a release cannot be cut past a red suite. The releases page is the changelog's home because the registry listing is the weaker surface and the two are not exclusive. The suite's coverage gap — it checks what an entry says, never whether the entry accounts for the release's actual component diff — is written down and handed to the author with the diff command to run, rather than left implied. Refuted: deriving the release's context facts from its own diff and failing when the entry does not account for them; stronger, but it needs a tag history the project does not have yet and would fail on a shallow or tagless checkout over a fact a human still has to judge.
