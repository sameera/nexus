---
title: "Published Package"
aliases: ["one package", "published manifest", "release package", "release tree", "one binary", "install from the registry", "files allowlist"]
touches: ["release-identity", "shipped-payload", "portable-tooling", "release-changelog", "release-gate", "toolkit-location", "environment-guard", "install-location", "delegating-port", "inert-declaration-removal", "additive-surface-fold"]
last_updated_by: "#354"
status: active
verification: verified
---

# Published Package

Nexus reaches an adopter as one package on the public registry, carrying the executable and the component payload together under a single version. The repository's own root manifest is the published manifest: the release is not a separate artifact assembled beside the project, it is the project. Nothing is fetched after install, and the package declares no runtime dependencies at all. Installing the package places no component set; an explicit verb does that.

## How It Works

The root manifest stops being private, takes an owner-scoped name it will keep, and declares one binary. A second name and its runtime floor were removed by deletion. The application's runtime dependencies move down into the application's own manifest, so an adopter installing a planning toolkit fetches no user-interface framework.

The three published parts are staged into one directory at the package root rather than published where they sit. Every part resolves the release version by walking up from its own position, so staging them at a known depth under one root is what makes every walk land on one declaration.

What ships is defined solely by the published-files allowlist. The staged tree is a build output, so source control ignores it; a deliberate, empty package-level ignore file exists only to stop the packer inheriting that rule and shipping an archive with no payload. Staging re-runs as part of packing, so a stale tree cannot ship.

An entry point decides whether it was run directly by comparing fully resolved real paths, because a package manager links a declared binary onto the caller's path and the two names never match as strings.

## Key Invariants

1. The package declares zero runtime dependencies; whatever an adopter needs after install travels inside it.
2. Exactly one binary is declared, and it runs from a directory that is not a Nexus checkout.
3. Every published part sits at a fixed depth beneath the single version declaration, so every walk finds one answer.
4. The published-files allowlist is the sole definition of what ships; source-control ignore rules never subtract from it.
5. Staging re-runs as part of packing, so neither a stale tree nor an empty one can ship.
6. A direct-run test compares fully resolved real paths, so an installed binary behaves as a checkout run does.
7. Supported platforms are declared, and a release targets POSIX-like environments only. ~~The interpreter floor is declared.~~

## Integration Points

- [release-identity](release-identity.md) — the single version this package carries; its staged layout is what both toolkits walk up to find that declaration.
- [shipped-payload](shipped-payload.md) — the stated set this package's allowlist admits, staged into the release tree rather than published where it sits.
- [portable-tooling](portable-tooling.md) — the built executable this package declares as a binary, reaching a machine through an install rather than a committed copy.
- [release-changelog](release-changelog.md) — the entry every release of this package carries, replacing the diff an adopter no longer sees.
- [release-gate](release-gate.md) — the precondition that must pass before this package is tagged and published, though not before it is packed locally.
- [toolkit-location](toolkit-location.md) — the declared binary is how the executable is found by name once a package manager links it onto the caller's path.
- [environment-guard](environment-guard.md) — the floor this package declared and the defect that guard named for it went together; nothing checked either at install.
- [install-location](install-location.md) — where the payload this package delivers is placed, by an explicit second step rather than by installation itself.
- [delegating-port](delegating-port.md) — carries the new entry point and the retained one together, which is what lets a delegating row resolve at all.
- [inert-declaration-removal](inert-declaration-removal.md) — the runtime floor this manifest declared was deleted rather than relaxed, having never had enforcement to lose.
- [additive-surface-fold](additive-surface-fold.md) — the binary names this manifest declares are what a fold adds to and a withdrawal removes from, one release apart.

## Decision Log


### 2026-08-27 — #252 — The repository's own manifest becomes the published package

The manifest that was private, unversioned and binary-less is the thing the epic names as broken, so it is fixed in place rather than shadowed: one manifest keeps one version identity, and the application's dependencies move down so a planning toolkit does not drag a user-interface framework onto every adopter. The name is owner-scoped and permanent rather than a placeholder, because the bare project name is taken and a rename after adopters have installed costs every one of them a reinstall. The three parts are staged under one root because both toolkits find their version by walking up from their own position, and a layout putting the halves at different depths would give them different answers — or none. Refuted: a second, publish-only manifest beside the libraries, which isolates the publish surface but creates a second version declaration to keep in step, the exact failure the one-package decision exists to rule out.

### 2026-08-27 — #253 — Getting installed is two steps, and the second is an explicit verb

Installing the package delivers both toolkits and the payload, but placing the component set is a separate verb the adopter runs. A package-manager lifecycle script was refuted: such scripts are blocked by default in this project's package manager and are commonly disabled in continuous integration, so a share of installs would end silently with no component set and no error — and the second step has to print permission text the user must act on regardless, which a silent hook cannot deliver. Recording it here because this page otherwise reads as though installation alone leaves a working Nexus.

### 2026-08-28 — #351 — Reciprocal link from delegating-port

Delegation only resolves if the package ships both halves, so the retained entry point stays a published part for as long as any capability delegates to it — and the older runtime stays a declared floor alongside it.

### 2026-08-31 — #354 — One binary and one runtime floor, both reduced by deletion

The second binary name and the second runtime's floor were removed outright rather than left in place as inert manifest keys. Leaving them is what a competent engineer might choose, since a published manifest's shape is something adopters' tooling diffs and neither key cost anything to keep — and it was refuted because inertness is the problem rather than the mitigation: a declared engine floor is read by humans and by supply-chain tooling as a real requirement, and a declared binary name promises a command the release no longer installs. The surviving floor's stated version was carried across untouched: the block is reduced by deletion, never re-derived or re-tightened while it is open. The published permission grant tracked the binary count down with it, held byte-identical across the install verb, the install documentation and the upgrade notes by the check that already fails the build on divergence.
