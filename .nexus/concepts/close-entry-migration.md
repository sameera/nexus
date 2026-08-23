---
title: "Close-Entry Migration"
aliases: ["queue-entry migration", "cross-repo close tail", "close range stamping", "hub queue migration", "migrate-verify-remove"]
touches: ["workspace-resolution", "committed-queue", "distiller", "remote-identity-normalization", "ephemeral-handoff-entry", "scratch-capture", "verb-reachability"]
last_updated_by: "#247"
status: active
verification: verified
---

# Close-Entry Migration

Close-entry migration is the cross-repo tail of the close stage: it puts a closed epic where its concepts are distilled. In a member repo it relocates the epic into the hub's queue and removes it locally; in every mode the close record is stamped with the landed change's exact diff range, so it stays recomputable once the entry no longer shares history with the code.

## How It Works

Closing an epic resolves its role — single-repo, hub, or member — from the committed workspace artifacts the resolver keys on. Range stamping runs in every mode; member mode also arms the migration, and the hub's reachability is proven up front, so an unreachable hub blocks before any irreversible step.

At the closure checkpoint, in member mode, the move runs in a fixed order — migrate, verify, gated remove. The unit is the epic, not whichever directory the stage was handed: where the close wrote to the ephemeral area, the hub entry is the union of those artifacts and the epic's committed scratch, copied scratch-first so the entry's own files win a collision. That union is committed, read back, and confirmed identical; only then are both local copies removed, GitHub writes last. Re-runs are idempotent.

## Key Invariants

1. After a member close the epic exists in exactly one place — one hub entry holding its artifacts and scratch — never the code repo.
2. Removal is gated on a verified hub commit; a failed or aborted migration leaves the entry intact locally.
3. Migration is all-or-nothing, any partial copy cleaned up before the failure is reported; source- and destination-relative paths are derived separately.
4. The range is stamped in every mode: full-SHA, list-shaped, one entry per code repo, matching the close-from-diff pass.
5. Role and hub location come from the shared resolver.
6. Single-repo and hub closes attempt no hub write and never remove it.
7. Closure is not durable until the migrated hub commit is pushed.

## Integration Points

- [workspace-resolution](workspace-resolution.md) — supplies the role and hub location.
- [committed-queue](committed-queue.md) — the surface this relocates into on the hub.
- [distiller](distiller.md) — receives the migrated entry and its range.
- [remote-identity-normalization](remote-identity-normalization.md) — canonicalizes the range's repo identity for a hub-side match.
- [ephemeral-handoff-entry](ephemeral-handoff-entry.md) — one of the two sources the union is drawn from.
- [scratch-capture](scratch-capture.md) — the committed half of that union, not stranded.
- [verb-reachability](verb-reachability.md) — this migration capability is now also reachable as a verb on the shared executable, under the same byte-identical parity guarantee as its script form.

## Decision Log

### 2026-07-15 — #49 — Safe-failure ordering, gated at the closure checkpoint

There is no cross-repo transaction, so the hub commit and the local removal cannot be atomic; the order is chosen by failure-cost asymmetry — migrate and verify first, remove only on that confirmation, GitHub writes last — so the worst case is a recoverable local duplicate, never a lost entry, and the epic is never declared done over an unrelocated entry. The whole move is gated by the existing closure checkpoint because mutating a second repository on disk is exactly the consequential action that gate exists for, and the hub's reachability is already proven before the checkpoint so the move cannot surprise-fail there. Refuted alternative: close the GitHub issue first, then migrate — viable, since the close tolerates an already-closed issue on re-run, but it declares the epic done before the entry is safely relocated, so a later migration failure leaves a closed issue standing over an un-migrated entry.

### 2026-07-31 — #170 — The migration's unit is the epic, not the directory it was handed

Once a member close began writing its artifacts to the ephemeral area, migrating only what sat in that directory stranded the epic's committed scratch in the member repo where nothing would ever delete it, and dropped it from the hub entry a drain would have cleaned up — so the unit became the epic, and the hub entry is the union of both sources. The same change separated two path derivations that had been one: reusing the destination-relative path for the code repo's tracked-file check read a same-named committed scratch directory as tracked, then tried to commit the removal of a path that was never deleted, failing after the irreversible hub commit had already landed. Copy order is fixed scratch-first so the entry's own artifacts win any collision and the byte-for-byte verify stays deterministic. Refuted alternative: hard-error on any colliding relative path — safer-looking, but scratch lives under per-user subdirectories so a collision is practically impossible, and the error would turn a cosmetic overlap into a blocked close.

### 2026-08-23 — #247 — Reciprocal link from verb-reachability

Mechanical reciprocity fan-out: the verb-reachability page names this migration capability as one of the ten now reachable as a verb on the shared executable, under the same byte-identical parity guarantee as its script form.
