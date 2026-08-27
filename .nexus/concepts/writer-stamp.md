---
title: "Writer Stamp"
aliases: ["writer stamp", "toolkit version stamp", "which toolkit wrote this", "unknown writer", "nexus_version field"]
touches: ["release-identity", "conformance-gate", "durable-close-record", "record-digest"]
last_updated_by: "#251"
status: active
verification: verified
---

# Writer Stamp

Every artifact the toolkit writes that a later stage reads back records which release wrote it. The stamp exists so a change in how that data is written becomes detectable instead of silently invalidating work already in flight. It is a fact recorded for later, never a gate.

## How It Works

Four artifacts carry data a later stage reads and checks: the conformance receipt, the close record, and the machine blocks in the close comment and the published review. Each now carries the writing release under one field name.

Three of the four are written by prose commands that cannot import a shared constant, so a constant alone would not stop the name drifting. The name is declared once and pinned by a test that enumerates every writing and reading surface — the enumeration is the mechanism, not the constant.

An artifact written before the stamp existed carries none, and a reader treats that as a writer it cannot name and proceeds. So does a reader whose own release differs from the stamp: this introduces no refusal, no waiver and no block. Deciding what to do about a detected difference can follow the evidence.

The stamp stays outside every hash a stage verifies by placement rather than by an exclusion rule. It sits beside the digests, in the key-value fields, never inside the bytes any digest covers — so stamping an artifact cannot change a value a later stage compares, and no canonicalisation rule had to gain a permanent exception. Where the release cannot be resolved the field is omitted entirely, because an absent stamp already means an unknown writer and a fabricated version would assert something untrue about work in flight.

## Key Invariants

1. Every artifact the toolkit writes that a later stage reads back carries the release that wrote it.
2. One field name is used by every writing and reading surface, pinned by a test that names those surfaces.
3. An absent stamp means an unknown writer and is never a failure.
4. A stamp differing from the reader's own release changes nothing: no refusal, no waiver, no block.
5. The stamp sits outside every verified hash by placement, never by an exclusion rule, so no digest changes.
6. An unresolved release omits the field rather than writing a version that is not true.

## Integration Points

- [release-identity](release-identity.md) — the version a stamp records, and the unresolved case that makes a writer unknown rather than wrong.
- [conformance-gate](conformance-gate.md) — the receipt and its published-review form both carry the stamp; an unstamped receipt still gates normally.
- [durable-close-record](durable-close-record.md) — the close comment's machine block and the mirrored close-record file both carry the stamp beside the record hash.
- [record-digest](record-digest.md) — the digest whose covered bytes the stamp is placed outside of, which is why no canonicalisation rule changed.

## Decision Log

### 2026-08-26 — #251 — One field name pinned by surface enumeration; the stamp placed outside every hash

The stamp's field name lives in one module, and every writing and reading surface is pinned against it by a test that names those surfaces — because three of the four stamped artifacts are written by prose commands that cannot import a constant, so a shared constant alone would not prevent drift. The stamp stays outside every verified hash by placement rather than by an exclusion rule: it sits beside the digests, never inside the bytes a digest covers, pinned by a test asserting a stamped artifact parses to the same values as an unstamped one. Refuted: a separate library depended on by both writing packages to deduplicate one string literal the prose writers still could not import; and teaching the record canonicalisation to strip stamp lines — a forever-carried change to a rule stated as covering everything, made for a stamp that is never written into that body.
