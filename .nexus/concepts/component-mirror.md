---
title: "Component Mirror"
aliases: ["component-mirror primitive", "convergent mirror", "declared empty payload", "empty payload mode", "namespace predicate", "removable veto", "one primitive three call sites"]
touches: ["install-location", "component-migration", "nexus-setup-cli"]
last_updated_by: "#253"
status: active
verification: verified
---

# Component Mirror

One convergent operation places a component payload at a component root and drops the Nexus-owned files that payload no longer carries; it is the only thing in Nexus that writes or deletes a component. Installing an account's set, emptying it, and emptying a repository's committed set are three callers of that operation, not three implementations. Emptiness is declared by the caller and never inferred from a payload that resolved to nothing.

## How It Works

The operation takes the component root itself, not a repository whose component-directory name it would append — that name is exactly what an account's configuration variable exists to override. It mirrors the payload in, then walks the managed subtrees and drops every Nexus-owned file the payload no longer carries, so a second run with no upstream change produces an identical set.

Ownership is one predicate, asked about the first path segment beneath a managed subtree and shared by every caller and the duplicate diagnostic alike, so nothing can disagree about which files Nexus owns.

A payload that cannot be resolved aborts the run. That abort is the only barrier between a failed release lookup and deleting every component on the account, so removal declares emptiness explicitly instead of handing over a location that happens to contain nothing; the two states would otherwise be indistinguishable at the boundary.

A caller may veto individual removals. Vetoed files come back reported as retained rather than being silently kept.

## Key Invariants

1. A payload that cannot be resolved aborts the run; only an explicitly declared empty mode produces removal semantics.
2. One definition of Nexus ownership — the first path segment beneath a managed subtree — is shared by every caller and by the duplicate diagnostic.
3. Nothing outside the component root it was given is removed, and no file that is not Nexus-owned is removed.
4. No caller traverses a pointer out of the root it was given; a pointer is removed as an entry and the file it names is never read for deletion.
5. Re-running with an unchanged payload converges: the resulting set is identical.
6. A caller's veto on a removal is surfaced as retained, never dropped silently.

## Integration Points

- [install-location](install-location.md) — the account-scoped component root this operation writes into and empties.
- [component-migration](component-migration.md) — a caller supplying an empty payload against a repository and vetoing every removal git does not track.
- [nexus-setup-cli](nexus-setup-cli.md) — exposes this one operation as the install, removal and migration verbs.

## Decision Log

### 2026-08-27 — #253 — Emptiness is declared, never inferred

Removal tells the mirror it is deliberately empty rather than handing it a payload location that happens to contain nothing. The abort on an unresolvable payload is the only thing standing between "the release could not find what it ships" and "delete every component this account has"; conflating the two at the boundary would turn any later regression in payload resolution into a silent uninstall. Refuted: create a temporary empty location and run the ordinary path — the smallest possible change, needing no edit to a tested operation; it loses on exactly that conflation, and it makes removal depend on scratch creation succeeding.
