---
title: "Canonical Record Digest"
aliases: ["record hash", "record digest", "record staleness axis", "approved-body hash"]
touches: ["decision-record", "committed-queue", "distiller", "conformance-gate", "durable-close-record", "verb-reachability", "writer-stamp"]
last_updated_by: "#251"
status: active
verification: verified
---

# Canonical Record Digest

One digest implementation computes the canonical hash of a decision-record body, and every stage that stamps or verifies the value invokes it. The hash turns "the design changed after it was analysed" into a detectable condition — a record staleness axis independent of the code axis the gates already track.

## How It Works

The canonicalisation rule is stated, not incidental, and fixed for the lifetime of any stamped value: line endings normalise, trailing whitespace strips from each line, trailing blank lines strip from the end — and nothing else, because a rule that forgave interior churn would also hide genuine edits. The digest is a lowercase hexadecimal hash, never truncated on any surface, and always computed over the body as fetched back from the platform, never locally submitted text, so storage normalisation cannot make a fresh record read stale. Conformance stamps the record reference and hash into its receipt beside the analysed commit. Close re-hashes the current body and names a mismatch as record staleness, separate from code staleness; both axes take the same explicit waiver. The drain re-verifies before writing the knowledge store and hard-errors on a mismatch with no waiver — the softest control must not sit on the most durable write; the remedy is upstream re-approval and a re-stamp. The fetch-and-hash step is read-only against the record issue.

## Key Invariants

1. Exactly one digest implementation exists; every stamping or verifying stage obtains its value from it.
2. Canonicalisation is exactly line endings, per-line trailing whitespace, and trailing blank lines — nothing else.
3. The value is full lowercase hexadecimal, never truncated on any surface.
4. The digest is computed over the body as fetched back, never over locally submitted text.
5. Record staleness and code staleness are independent axes, named separately, each taking the same explicit waiver.
6. The drain has no waiver: a mismatch hard-errors and writes nothing for that entry.
7. Verification is read-only: it fetches and hashes, never edits, closes, or comments.

## Integration Points

- [decision-record](decision-record.md) — the approved sub-issue body the digest is taken over.
- [committed-queue](committed-queue.md) — an entry's close record stamps the value the drain verifies.
- [durable-close-record](durable-close-record.md) — the close comment where the stamp survives the entry.
- [distiller](distiller.md) — re-verifies the stamp before draining and hard-errors on a mismatch.
- [conformance-gate](conformance-gate.md) — the receipt this digest is stamped into.
- [verb-reachability](verb-reachability.md) — this capability is now also reachable as a verb on the shared executable, matched byte-for-byte against its script form.
- [writer-stamp](writer-stamp.md) — sits beside this digest, outside the bytes it covers, so stamping changes no hash and this rule needed no exception.

## Decision Log

### 2026-07-26 — #139 — One digest program, two staleness axes, no drain-side waiver

A digest described in prose is not reproducible, and the stamping and verifying stages are prose commands executed by a model — so the value comes from one deterministic program all of them invoke, with the canonicalisation rule stated once. Record staleness is named separately from code staleness because neither implies the other, and both take the same explicit close-side waiver; the drain alone has none, because it writes permanently into the knowledge store and a waived mismatch would file rationale for a design nobody approved. Refuted alternatives: per-stage shell one-liners, which drift on the first canonicalisation divergence and report a design that did not change as changed; and a broader rule collapsing interior blank lines or Unicode form, which forgives editor churn but also hides genuine edits.

### 2026-07-28 — manual — Reciprocal link from conformance-gate

Mechanical reciprocity fan-out: the conformance-gate page names this digest as the value its
receipt stamps to detect record staleness.

### 2026-07-31 — #170 — The stamp's durable home is the close comment

Both surfaces that carried this value — the conformance receipt and the close record — became disposable for a local close, so the reference and hash are now stamped onto the epic issue's close comment as well, where they survive the entry being consumed. Nothing about the digest itself changed: the same one program computes it, over the body as fetched back, in full. What changed is that a drain recovering an entry from GitHub reads the stamp from that comment rather than a file, which is why the value has to be carried in a structured position and never truncated on any surface.

### 2026-08-23 — #247 — Reciprocal link from verb-reachability

Mechanical reciprocity fan-out: the verb-reachability page names this digest capability as one of the ten now reachable as a verb on the shared executable, matched byte-for-byte against its script form by the migration-axis parity check.

### 2026-08-26 — #251 — Reciprocal link from writer-stamp

The writer stamp is placed outside the bytes this digest covers, so the canonicalisation rule gained no permanent exception. Recorded here as the reciprocal edge.
