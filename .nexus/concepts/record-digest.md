---
title: "Canonical Record Digest"
aliases: ["record hash", "record digest", "record staleness axis", "approved-body hash"]
touches: ["decision-record", "committed-queue", "distiller", "conformance-gate"]
last_updated_by: "#139"
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

- [decision-record](decision-record.md) — the approved sub-issue body is the artifact the digest is taken over.
- [committed-queue](committed-queue.md) — the entry's close record stamps the record reference and approved-body hash the drain verifies against.
- [distiller](distiller.md) — re-verifies the stamp before draining and hard-errors on a mismatch.
- [conformance-gate](conformance-gate.md) — the receipt this digest is stamped into, detecting record staleness independent of code-conformance findings.

## Decision Log

### 2026-07-26 — #139 — One digest program, two staleness axes, no drain-side waiver

A digest described in prose is not reproducible, and the stamping and verifying stages are prose commands executed by a model — so the value comes from one deterministic program all of them invoke, with the canonicalisation rule stated once. Record staleness is named separately from code staleness because neither implies the other, and both take the same explicit close-side waiver; the drain alone has none, because it writes permanently into the knowledge store and a waived mismatch would file rationale for a design nobody approved. Refuted alternatives: per-stage shell one-liners, which drift on the first canonicalisation divergence and report a design that did not change as changed; and a broader rule collapsing interior blank lines or Unicode form, which forgives editor churn but also hides genuine edits.

### 2026-07-28 — manual — Reciprocal link from conformance-gate

Mechanical reciprocity fan-out: the conformance-gate page names this digest as the value its
receipt stamps to detect record staleness.
