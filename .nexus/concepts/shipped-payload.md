---
title: "Shipped Payload"
aliases: ["defined payload", "payload filter", "payload fingerprint", "stated set", "byte-code suppression", "payload manifest", "what ships"]
touches: ["component-invocation-gate", "published-package", "portable-tooling", "release-gate", "verb-reachability", "authored-component-root", "template-seeding", "checkout-only-path-gate"]
last_updated_by: "#258"
status: active
verification: verified
---

# Shipped Payload

The payload is a stated set of files rather than whatever happens to be on disk, so its fingerprint means something and nothing incidental reaches an adopter. Two clean checkouts of the same commit fingerprint it identically, whatever either machine has cached. Interpreter byte-code is suppressed at the one place every capability passes through, so a stage leaves nothing behind in the repository it ran against.

## How It Works

Two mechanisms answer two different questions. Which component files ship stays the structural composition check over whole subtrees. Which entries are incidental became a named denylist of categories — interpreter byte-code and the toolkit's own tests — applied during the walk. Naming categories is what lets a new capability ship the moment it is written while a new test file never does.

The fingerprint is taken over a canonical manifest of that set: one record per file, its staged position and its content digest, sorted by code-unit comparison rather than a locale-aware one. A locale-sensitive sort would make the order, and so the fingerprint, a property of the machine.

Filtering byte-code out would fix the fingerprint but not the adopter's repository, where a stage would still drop cache directories the package's own removal does not know about. Suppression is set at the single declared entry point instead, before anything is imported.

The pin carries one entry for the executable and one for the payload, and stays the sole pass or fail authority. A per-file manifest written beside it by the same step names which file moved.

## Key Invariants

1. The payload contains no interpreter byte-code and no test file.
2. Its fingerprint is equal across two clean checkouts of the same commit on machines with different interpreter versions and no cached byte-code.
3. Ordering and hashing depend on nothing outside the stated set — no locale, no enumeration order, no timestamps.
4. Byte-code suppression is set at the single declared entry point; a direct invocation of a capability bypasses it.
5. A stage run against a repository writes nothing into it that the package's own removal does not account for.
6. The pin has exactly two entries and is the sole pass or fail authority; the per-file manifest is diagnostic only.
7. The pin and its manifest are written by the same step, so the two can never describe different runs.

## Integration Points

- [component-invocation-gate](component-invocation-gate.md) — the same stated set decides which component bodies that gate reads, so no shipped body escapes it.
- [published-package](published-package.md) — the allowlist that admits this set, and the release tree it is staged into at a fixed depth beneath the version declaration.
- [portable-tooling](portable-tooling.md) — shares the two-entry fingerprint pin: one entry for the built executable, one for this payload.
- [release-gate](release-gate.md) — reads what this payload carries to decide whether a shipped body's path reference still resolves after an install.
- [verb-reachability](verb-reachability.md) — the single dispatcher where byte-code suppression is set, so no capability of that toolkit can forget it.
- [authored-component-root](authored-component-root.md) — the tree this payload's component half is assembled from, whose relocation this manifest is the before-image for.
- [template-seeding](template-seeding.md) — carries the template masters as a third part, so a repository is seeded from the release rather than a source tree.
- [checkout-only-path-gate](checkout-only-path-gate.md) — this stated set decides exactly which bodies that gate scans for a checkout-only location.

## Decision Log

### 2026-08-27 — #252 — The payload becomes a stated set, hashed in code-unit order

The walk applied no filter, so gitignored byte-code and the toolkit's own tests rode along: the fingerprint was a property of the machine that produced it, and adopters received tests they will never run. The filter is a denylist of incidental categories rather than an allowlist of files, because a new capability module must ship the moment it is written and a new test file must never ship — naming categories gives both properties without an edit per file, while the existing structural check keeps answering the different question of what is checkout-bound. Byte-code is suppressed at the entry point rather than merely filtered, because filtering fixes the fingerprint but leaves a stage dropping cache directories into the repository it ran against. Refuted: an explicit manifest of shipped files, the most auditable definition, but it silently omits any module someone forgot to add — a failure that surfaces as a broken adopter install rather than as a red gate.

### 2026-08-27 — #250 — Reciprocal link from component-invocation-gate

Mechanical reciprocity fan-out: the component-invocation-gate page names this stated set as the definition of which bodies it reads, so a body cannot ship ungated.

### 2026-08-28 — #256 — Reciprocal link from authored-component-root

Mechanical reciprocity fan-out: the authored-component-root page names this stated set as what proves relocating the authored tree changed nothing about what ships, so the manifest is the move's regression check rather than a coincidence.

### 2026-08-28 — #258 — Reciprocal link from template-seeding and checkout-only-path-gate

Mechanical reciprocity fan-out, two edges in one entry. The template-seeding page names this stated set as what carries the template masters, which is what lets a repository outside the source tree be seeded from what it installed. The checkout-only-path-gate page names the same set as the definition of which bodies it scans, so no shipped body can name a checkout-only location ungated.
