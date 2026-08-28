---
title: "Template Seeding"
aliases: ["seed templates", "seed-never-clobber", "template masters", "tool-agnostic templates", "repo-bound seeding", "whole set or none"]
touches: ["nexus-setup-cli", "shipped-payload", "install-location", "durable-close-record", "checkout-only-path-gate"]
last_updated_by: "#258"
status: active
verification: verified
---

# Template Seeding

Three pipeline stages read a tool-agnostic template out of the project's own configuration, and template seeding is how those templates get there: a repo-bound step placing a first copy from masters that travel inside the release. It seeds the whole set or none of it, and never overwrites a template the project has tuned. A stage whose template is absent stops and names the seeding step as the remedy, rather than reaching for a copy that exists only inside a Nexus source checkout.

## How It Works

Seeding is repo-bound, deliberately apart from the account-scoped placement of components: the templates are a project resource one repository owns, while an account holds a single component set serving every repository. So the seed is its own step, run by the setup stage and runnable alone by an adopter who wants only the templates.

The masters travel inside the release beside the component payload, so a repository that has never been a Nexus checkout is seeded from what it installed rather than from a directory that exists only in the source tree.

Every master is read and validated before anything is written. A missing master set, or a set missing one member, stops the run naming what is absent and leaves the repository untouched: a half-seeded configuration would send a stage looking for a file nothing will ever place, which is the failure seeding exists to remove.

An existing destination is kept rather than overwritten, and reported separately from what was written, so a caller can tell already-yours from newly-placed.

## Key Invariants

1. The templates the stages read are placed by a repo-bound step, never by the account-scoped component placement.
2. The whole set is validated before anything is written; a master set that cannot be read whole leaves the repository untouched.
3. Seeding never overwrites a template already present, whatever its content.
4. What was written and what was kept are reported separately, so a silent skip cannot hide the difference.
5. On first seed a placed template is byte-identical to the master it came from.
6. The masters reach a repository through the release, never through a Nexus source checkout.
7. A stage whose template is absent stops and names the seeding step as the remedy; there is no second location to try.

## Integration Points

- [nexus-setup-cli](nexus-setup-cli.md) — carries the seeding step as its one repo-bound verb, and its judgment-owning counterpart runs it before reading a template.
- [shipped-payload](shipped-payload.md) — carries the template masters as a third part, so a seed reads what the adopter installed.
- [install-location](install-location.md) — the account-scoped placement seeding sits beside; templates belong to a repository, so they are never written there.
- [durable-close-record](durable-close-record.md) — the close stage reads a seeded template it may have tuned, and stops rather than falls back when it is absent.
- [checkout-only-path-gate](checkout-only-path-gate.md) — keeps the removed fallback from returning, by refusing any shipped body that reads the source checkout's master set.

## Decision Log

### 2026-08-28 — #258 — Seeding is its own repo-bound step, and it seeds the whole set or none of it

The templates the stages read had no way to arrive: the gap was hidden only by the Nexus checkout, where they happen to be present, so every adopter's decision-record stage had no template and the close stage reached for a master that ships in no release. Seeding became its own repo-bound step rather than part of the account-scoped component placement, because that placement writes once per account at a location no repository owns and would have to guess which repository to seed, while the templates are a project resource; making it a separate step also satisfies both readings the epic left open, since the setup stage runs it and an adopter wanting only the templates can run it directly. The set is validated whole before anything is written, and seeding an existing template is refused rather than skipped silently, with kept and written reported apart. Refuted: seed what is present and warn about the rest, which converts a loud failure into a quiet one — a half-seeded configuration leaves a stage reading a file nothing will ever place, the exact failure this work removes.
