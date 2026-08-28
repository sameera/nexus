---
title: "Authored Component Root"
aliases: ["authoring separated from loading", "authored tree", "one definition of the authored root", "derived inventory of authoring sites", "no component at a loaded path", "authoring-source waiver set"]
touches: ["pointing-install", "shipped-payload", "component-migration"]
last_updated_by: "#256"
status: active
verification: verified
---

# Authored Component Root

The directory a repository authors its components in is not the directory the harness loads. One definition names the authored root and every consumer derives from it, so relocating the tree is a single edit rather than an inventory of sites to chase. The repository that develops Nexus keeps nothing tracked under the loaded path, so the only components that can run are the ones its account's install location resolves.

## How It Works

Authoring and loading were the same place while that repository kept its component tree where the harness reads. A file there is not the file that runs unless the maintainer has pointed their install location at the checkout — a false affordance in the repository whose maintainer most needs to know which copy is running.

The remedy relocates the root and nothing beneath it. Preserving the internal shape turns "the move must not change what ships" into a byte-level comparison against the committed payload manifest rather than a file-list review.

What the tree's position used to guarantee, standing checks now assert. One fails when anything the repository tracks appears under the loaded path. Another searches every production source for the loaded directory's name and fails on any site outside a short waiver set; each waiver carries a written reason and itself fails once it stops applying. The inventory is derived rather than enumerated, because a hand-measured list of reach-through sites is stale again by the next epic.

## Key Invariants

1. The authored root is an ordinary tracked directory at the repository root — never one the harness loads, nor nested beneath one.
2. Exactly one definition names that root; every consumer derives from it rather than spelling it out.
3. No production source outside a short, individually justified waiver set names the loaded directory as an authoring source, and a stale waiver fails as loudly as a missing one.
4. Nothing the repository tracks sits under the loaded path, so a fresh clone carries no component set.
5. Relocating the root leaves the tree's internal shape untouched, so the payload manifest proves what ships is unchanged.
6. The derivation a pointing install uses to find a checkout's authored tree changes in the same landing as the tree itself, never a later one.
7. The contributor guide and the release procedure's component diff are asserted by the suite, not by diligence.

## Integration Points

- [pointing-install](pointing-install.md) — resolves this root inside a maintainer's checkout, through the same one definition rather than a name repeated at the install verb.
- [shipped-payload](shipped-payload.md) — the payload's component half is assembled from this root, and the committed manifest is what proves relocating the root changed nothing about what ships.
- [component-migration](component-migration.md) — never pointed at this repository: that verb removes a mirrored copy, whereas this root holds the authored original.

## Decision Log

### 2026-08-28 — #256 — Separate authoring from loading, and derive the site inventory

The authored tree left the loaded directory so the one-set-per-account rule holds without depending on the harness at all, and the repository that develops Nexus consumes the shared install exactly as an adopter does. The inventory of sites reaching that tree is derived by a standing check rather than carried as a list, because the list filed at planning was already stale — sites it named had gone, and sites it did not name had appeared. Refuted: exempt this repository, keep the tree where it is, and let the loader deduplicate a linked install by resolved real path — genuinely cheaper and coherent, but it makes the invariant depend on undocumented collision behaviour and leaves the duplicate check carrying an exemption forever.
