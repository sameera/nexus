---
title: "Additive Surface Fold"
aliases: ["additive fold", "surface overlap", "expand-migrate-contract", "two declaration tables one handler", "name withdrawal", "additive rename"]
touches: ["verb-reachability", "component-invocation-gate", "toolkit-location", "published-package", "delegating-port"]
last_updated_by: "#354"
status: active
verification: verified
---

# Additive Surface Fold

Moving a capability from one published name to another lands additively: the new name is declared first, both names resolve one shared set of handlers, callers are rewritten under that overlap, and the old name is withdrawn once nothing points at it. The overlap makes the declaration, the rewrite and the withdrawal three separately shippable changes rather than one unreviewable commit, and is bounded to a single release, so no adopter meets two names for one capability.

## How It Works

A build-time gate resolves a caller's invocation against the live declared surface, so a name must exist before any caller may write it. Without an overlap the declaration, the rewrite and the withdrawal land together — one commit carrying a behaviour regression and a caller typo at once, where revert is all-or-nothing.

So the new declarations go in first while the old name goes on declaring the same capabilities. Both reach one shared handler set, so the names cannot diverge; what is duplicated is a few declaration rows carrying a summary and usage text, never behaviour. The rewrite is then a mechanical substitution against names that already resolve. The withdrawal deletes the second declaration table, its entry point and its build artifact once no shipped caller names it, and the gate rule recognising the withdrawn name is removed after that, never before.

## Key Invariants

1. The new name is declared before any caller is rewritten onto it, because the gate resolves a caller against the live declared surface.
2. Both names reach one shared handler set throughout the overlap; only declaration rows are duplicated, never behaviour.
3. Each step — declare, rewrite, withdraw — leaves the suite green and every gate passing on its own, relying on no later step to repair a check it breaks.
4. The overlap ships inside one release, so the interval in which two names resolve is never adopter-visible.
5. The old name is withdrawn only once no shipped caller names it, and the gate rule recognising it is removed only after that withdrawal.
6. Program-name text flips to the surviving name at the fold; the invoked name is never threaded through an invocation to stay correct during a transient state.
7. A folded capability's arguments, flags, output shape, exit codes and failure signalling are exactly what they were; only the reported program name changes.

## Integration Points

- [verb-reachability](verb-reachability.md) — the registry the new declarations are added to, and the second registry the withdrawal deletes once nothing reaches it.
- [component-invocation-gate](component-invocation-gate.md) — resolves a caller against the live surface, which is why the new names must exist before the rewrite and the old rule must go after it.
- [toolkit-location](toolkit-location.md) — the addressing rule that makes a name the contract, so a caller rewrite is a substitution of that name and never a path.
- [published-package](published-package.md) — declares the binary names, so the withdrawal is the point at which the old name stops reaching an adopter at all.
- [delegating-port](delegating-port.md) — the complement: that pattern holds the name fixed and moves the implementation, this one holds the implementation fixed and moves the name.

## Decision Log

### 2026-08-31 — #354 — The fold ships additively, so declaring, rewriting and withdrawing are three shippable changes

Landing the declaration change, the thirty-seven-reference caller rewrite and the name withdrawal atomically is what a competent engineer would choose to avoid ever shipping two names for one capability. It was refuted because those changes ship inside one release, so the transient duplication reaches no adopter, while the single commit puts a behaviour regression and a caller typo into one all-or-nothing revert. Deriving the new declarations from the old table, so exactly one table exists during the overlap, was refuted for a second reason: the withdrawal would then have to perform the fold again to sever the last importer of the table it deletes — the same work twice, with a harder intermediate state.
