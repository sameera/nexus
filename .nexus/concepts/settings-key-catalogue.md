---
title: "Settings Key Catalogue"
aliases: ["key catalogue", "github-block key catalogue", "the key map", "one declaration per key", "derived inverse", "catalogue membership"]
touches: ["publishing-config-resolution", "config-write-back"]
last_updated_by: "#351"
status: active
verification: verified
---

# Settings Key Catalogue

One table declares every publishing settings key exactly once: the name it is written under, the name the resolver carries it under, and the built-in it falls back to. Every derivation reads that one table, so adding a key there makes it readable from settings, layerable from workspace-wide defaults, resolvable by name and writable by the settings writer, with no second edit inside the resolver.

## How It Works

The predecessor kept a read map and, beside it, a hand-written inverse for the writer. The inverse had already drifted — missing every key added since it was written — so a key could be resolvable by a consumer and silently unwritable by the producer meant to seed it. Enumerating the keys again in the reader had the same failure shape: a key readable by a resolver but never populated, losing a declared value to a built-in with no signal.

One declaration removes the class. Four things derive from it: the settings reader, the workspace-defaults normalizer, the argument that names a key on the command line, and the writer's translation back to written names. The inverse is derived, never maintained.

Membership is the lookup itself, never a comparison of a key's two spellings. A row whose two names happen to coincide is as declared as any other, and testing whether they differ silently drops exactly those rows from whichever derivation does it.

Keys carrying a built-in the general precedence path does not know about are rows in the same table rather than a branch chain in the command layer.

## Key Invariants

1. Every key is declared exactly once, carrying its written name, the resolver's name for it, and its built-in where it has one.
2. Adding a key to the catalogue makes it readable, layerable, resolvable by name and writable, with no second edit inside the resolver.
3. The translation back to written names is derived, never hand-maintained.
4. Membership is decided by lookup, never by comparing a key's two spellings; a row whose spellings coincide is as declared as any other.
5. A key without a built-in resolves to nothing rather than an invented value, which is how an absent target keeps meaning the current repository.
6. A specific key names the general key it falls back to in the table itself, so the fallback is data rather than a branch.

## Integration Points

- [publishing-config-resolution](publishing-config-resolution.md) — the precedence chain this catalogue supplies keys and built-ins to; that concept owns what a key resolves to, this one which keys exist at all.
- [config-write-back](config-write-back.md) — its two producers write through this catalogue's derived inverse, so a key they can resolve is a key they can seed.

## Decision Log

### 2026-08-28 — #351 — One catalogue is the schema, split out from the resolution chain

Split from publishing-config-resolution, whose own content had reached its cap: which keys exist is loadable on its own, separately from what any given key resolves to. The catalogue became the single schema declaration during the port because the predecessor's hand-written inverse had already drifted and was missing every key added since it was written; deriving the inverse makes "a key added once is honoured end to end" a structural property rather than a test result. A late fix made membership the catalogue lookup rather than a spelling comparison, which had been silently dropping the two rows whose names coincide out of the workspace-defaults layer — caught by the conformance pass rather than by a test, because the tests asserted the layer and not its coverage of the catalogue. **Refuted alternative:** transliterate the existing shape — one read map, a separate hand-written inverse, and the per-key branch chain — the most literal reading of a behaviour-preserving port, but it carries a known drift across the boundary.
