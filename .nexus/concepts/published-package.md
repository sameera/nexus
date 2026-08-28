---
title: "Published Package"
aliases: ["one package", "published manifest", "release package", "release tree", "two binaries", "install from the registry", "files allowlist"]
touches: ["release-identity", "shipped-payload", "portable-tooling", "release-changelog", "release-gate", "toolkit-location", "environment-guard", "install-location"]
last_updated_by: "#253"
status: active
verification: verified
---

# Published Package

Nexus reaches an adopter as one package on the public registry, carrying both toolkits and the component payload together under a single version. The repository's own root manifest is the published manifest: the release is not a separate artifact assembled beside the project, it is the project. Nothing is fetched after install, and the package declares no runtime dependencies at all. Installing the package places no component set; an explicit verb does that.

## How It Works

The root manifest stops being private, takes an owner-scoped name it will keep, and declares two binaries — one per named toolkit. The application's runtime dependencies move down into the application's own manifest, so an adopter installing a planning toolkit fetches no user-interface framework.

The three published parts are staged into one directory at the package root rather than published where they sit. Both toolkits resolve the release version by walking up from their own position, so staging them at a known depth under one root is what makes both walks land on the same declaration.

What ships is defined solely by the published-files allowlist. The staged tree is a build output, so source control ignores it; a deliberate, empty package-level ignore file exists only to stop the packer inheriting that rule and shipping an archive with no payload. Staging re-runs as part of packing, so a stale tree cannot ship.

An entry point decides whether it was run directly by comparing fully resolved real paths, because a package manager links a declared binary onto the caller's path and the two names never match as strings.

## Key Invariants

1. The package declares zero runtime dependencies; whatever an adopter needs after install travels inside it.
2. Exactly two binaries are declared, one per named toolkit, and both run from a directory that is not a Nexus checkout.
3. Every published part sits at a fixed depth beneath the single version declaration, so both toolkits' walks find one answer.
4. The published-files allowlist is the sole definition of what ships; source-control ignore rules never subtract from it.
5. Staging re-runs as part of packing, so neither a stale tree nor an empty one can ship.
6. A direct-run test compares fully resolved real paths, so an installed binary behaves as a checkout run does.
7. Supported platforms and the interpreter floor are declared, and a release targets POSIX-like environments only.

## Integration Points

- [release-identity](release-identity.md) — the single version this package carries; its staged layout is what both toolkits walk up to find that declaration.
- [shipped-payload](shipped-payload.md) — the stated set this package's allowlist admits, staged into the release tree rather than published where it sits.
- [portable-tooling](portable-tooling.md) — the built executable this package declares as a binary, reaching a machine through an install rather than a committed copy.
- [release-changelog](release-changelog.md) — the entry every release of this package carries, replacing the diff an adopter no longer sees.
- [release-gate](release-gate.md) — the precondition that must pass before this package is tagged and published, though not before it is packed locally.
- [toolkit-location](toolkit-location.md) — the two declared binaries are how each toolkit is found by name once a package manager links them onto the caller's path.
- [environment-guard](environment-guard.md) — this package declares the interpreter floor; the guard names a missing interpreter at run time, since nothing checks it at install.
- [install-location](install-location.md) — where the payload this package delivers is placed, by an explicit second step rather than by installation itself.

## Decision Log

### 2026-08-27 — #252 — The repository's own manifest becomes the published package

The manifest that was private, unversioned and binary-less is the thing the epic names as broken, so it is fixed in place rather than shadowed: one manifest keeps one version identity, and the application's dependencies move down so a planning toolkit does not drag a user-interface framework onto every adopter. The name is owner-scoped and permanent rather than a placeholder, because the bare project name is taken and a rename after adopters have installed costs every one of them a reinstall. The three parts are staged under one root because both toolkits find their version by walking up from their own position, and a layout putting the halves at different depths would give them different answers — or none. Refuted: a second, publish-only manifest beside the libraries, which isolates the publish surface but creates a second version declaration to keep in step, the exact failure the one-package decision exists to rule out.

### 2026-08-27 — #253 — Getting installed is two steps, and the second is an explicit verb

Installing the package delivers both toolkits and the payload, but placing the component set is a separate verb the adopter runs. A package-manager lifecycle script was refuted: such scripts are blocked by default in this project's package manager and are commonly disabled in continuous integration, so a share of installs would end silently with no component set and no error — and the second step has to print permission text the user must act on regardless, which a silent hook cannot deliver. Recording it here because this page otherwise reads as though installation alone leaves a working Nexus.
