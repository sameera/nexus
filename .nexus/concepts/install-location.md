---
title: "Install Location"
aliases: ["one component set per account", "configuration directory", "account-scoped install", "install location resolution", "explicit placement verb"]
touches: ["component-mirror", "component-migration", "environment-guard", "nexus-setup-cli", "published-package", "pointing-install", "release-identity"]
last_updated_by: "#256"
status: active
verification: verified
---

# Install Location

Exactly one Nexus component set exists per user account, at the account's resolved configuration directory. Placing a set there is an explicit step its owner runs, never something installing the package does on their behalf. Resolution never silently substitutes a default for an explicit value it cannot use.

## How It Works

The location comes from a configuration-directory environment variable, falling back to a conventional directory under the account's home when that variable is unset. A value that is set but unusable — empty, or not absolute — is an error naming the variable and the remedy, never quietly replaced by the default. Reverting to the default would install the components somewhere the harness is not reading: an outcome that looks like success and produces an account where nothing works and nothing reports an error. A location that is absent but resolvable is created.

The location holds one of two contents. The ordinary one is a copy of the release; the other places pointers at an authored checkout and is described separately. Every verb acting on the location says which of the two it found before it changes anything, so an owner is never guessing what they are about to replace.

Placement is a deliberate verb rather than a package lifecycle step, because such steps are blocked by default in this package manager and commonly disabled in continuous integration — a share of installs would otherwise end silently with no component set and no error.

## Key Invariants

1. Exactly one component set exists per account, at the resolved configuration directory.
2. Resolution accepts an absolute environment value or the home-based default and errors on anything else, naming the variable and the remedy; it never substitutes the default for an unusable explicit value.
3. Every verb acting on the location reports the location it resolved, and which of the two contents it holds, before it changes anything.
4. Only the managed subtrees are touched, never recursively beyond them and never the location's top level, which holds the account's own harness state.
5. Placing the set is an explicit verb, never a package-installation side effect.
6. No shipped component body instructs an adopter into a per-repository arrangement; a build check fails when one does.

## Integration Points

- [component-mirror](component-mirror.md) — the one operation that writes and empties this location, taking the component root directly rather than deriving it from a repository.
- [component-migration](component-migration.md) — refuses to run until this location resolves and holds a set, so no repository is emptied with nothing to replace it.
- [environment-guard](environment-guard.md) — reports a second component set by comparing this location's resolved files against the invoking repository's.
- [nexus-setup-cli](nexus-setup-cli.md) — exposes the verbs that place and empty the set at this location.
- [published-package](published-package.md) — installing the package delivers the payload; this location is where the explicit second step puts it.
- [pointing-install](pointing-install.md) — the second of this location's two contents, split out from this page: pointers at a maintainer's checkout rather than a copied release.
- [release-identity](release-identity.md) — the release read-out that reports this location and its content, so an owner sees what is present without inspecting the files.

## Decision Log

### 2026-08-27 — #253 — One account-scoped install location, resolved strictly

The location became a first-class input resolved once and handed to the mirror, rather than a value reverse-engineered from a repository root. The fixed component-directory name a repository-rooted mirror appends is exactly what the configuration variable exists to override, so an install expressed against that variable's parent writes to a sibling of the real location the moment the variable names anything unconventional. Refuted: pass the configuration directory's parent as a pseudo-repository root — a one-line change needing no edit to a tested operation, and correct in the default case; it loses because its failure mode is a silent write to the wrong directory rather than an error.

### 2026-08-28 — #256 — The pointing content splits out to its own page

This page reached its capacity on its own content, and the half under pressure was the maintainer's arrangement: the epic that moved the authored tree made the pointing content the mechanism by which Nexus itself is developed, with its own derivation, its own read-out and its own relationship to the duplicate diagnostic. The seam holds because an adopter's question about where a set lives never needs the pointing half, and a maintainer's question about the edit-and-rerun loop never needs the resolution rules. What moved is the pointing content's mechanics and the checkout clause of the reporting invariant; the resolution rules, the explicit-placement rule and the managed-subtree bound stayed. Refuted: keep one page and compress the resolution prose to make room — it reads as the cheaper option and loses because the compressed half is still-true content that no delta here supersedes.
