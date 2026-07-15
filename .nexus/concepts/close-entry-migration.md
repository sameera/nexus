---
title: "Close-Entry Migration"
aliases: ["queue-entry migration", "cross-repo close tail", "close range stamping", "hub queue migration", "migrate-verify-remove"]
touches: ["workspace-resolution", "committed-queue", "distiller", "remote-identity-normalization"]
last_updated_by: "#49"
status: active
verification: verified
---

# Close-Entry Migration

Close-entry migration is the cross-repo tail of the close stage: it puts a closed epic's queue entry where its concepts are distilled. In a workspace member repo it relocates the entry into the hub's queue and removes it locally; in every mode the close record is stamped with the exact diff range of the landed change, so it stays recomputable once the entry no longer shares history with the code.

## How It Works

Closing an epic resolves its role — single-repo, hub, or member — from the committed workspace artifacts the resolver keys on, never a fresh heuristic. Range stamping runs in every mode; member mode also arms the migration, and the hub's reachability is proven up front, so an unreachable hub blocks before any irreversible step.

At the closure checkpoint, in member mode, the move runs in a fixed order — migrate, verify, gated remove. The full entry is copied into the hub's queue and committed there; that commit is read back and confirmed identical; only then is the entry removed locally, GitHub writes last. Any earlier failure leaves the entry intact locally and the hub unchanged. Re-runs are idempotent; single-repo and hub closes are unchanged.

## Key Invariants

1. After a member close the entry exists in exactly one place — the hub queue — never the code repo.
2. Removal is gated on a verified hub commit; a failed or aborted migration leaves the entry intact locally.
3. Migration is all-or-nothing — a complete hub commit or an unchanged hub — with any partial copy cleaned up before the failure is reported.
4. The range is stamped in every mode: full-SHA, list-shaped, one entry for a single-code-repo epic, matching the close-from-diff pass.
5. Role and hub location come from the shared resolver, never the close stage's own heuristic.
6. Single-repo and hub closes attempt no hub write and never remove the entry.
7. Closure is not durable until the migrated hub commit is pushed.

## Integration Points

- [workspace-resolution](workspace-resolution.md) — supplies the role and hub location a member close acts on.
- [committed-queue](committed-queue.md) — the entry this relocates from the code repo into the hub's queue.
- [distiller](distiller.md) — receives the migrated entry beside the store and the range it recomputes from, restoring drain atomicity.
- [remote-identity-normalization](remote-identity-normalization.md) — canonicalizes the range's repo identity for a later hub-side match.

## Decision Log

### 2026-07-15 — #49 — Safe-failure ordering, gated at the closure checkpoint

There is no cross-repo transaction, so the hub commit and the local removal cannot be atomic; the order is chosen by failure-cost asymmetry — migrate and verify first, remove only on that confirmation, GitHub writes last — so the worst case is a recoverable local duplicate, never a lost entry, and the epic is never declared done over an unrelocated entry. The whole move is gated by the existing closure checkpoint because mutating a second repository on disk is exactly the consequential action that gate exists for, and the hub's reachability is already proven before the checkpoint so the move cannot surprise-fail there. Refuted alternative: close the GitHub issue first, then migrate — viable, since the close tolerates an already-closed issue on re-run, but it declares the epic done before the entry is safely relocated, so a later migration failure leaves a closed issue standing over an un-migrated entry.
