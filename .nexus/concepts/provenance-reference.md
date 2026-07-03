---
title: "Provenance Reference"
aliases: ["provenance hop", "issue reference form", "cross-repo reference", "page blame"]
touches: ["concept-store", "append-only-decision-log"]
last_updated_by: "bootstrap"
status: active
verification: unverified
---

# Provenance Reference

A provenance reference links a concept page or a log entry back to the issue that originated it, so an agent can hop from a compressed page to the full context it distilled away. It takes one of two search-native forms so the hop stays unambiguous across repositories.

## How It Works

A bare issue reference resolves against a single declared home repository — the terse default for the common single-repo case. A fully-qualified owner-and-repository reference overrides it and is required for any cross-repository link. This is the host's own cross-repo issue syntax, so no new resolver is needed and every reference stays plain-text searchable. The distinction matters most in the decision history, where one shared concept can accumulate entries from epics in different repositories; a bare reference there would resolve to the wrong issue. Bootstrap and manual pages use their own literal markers in place of an issue reference. The full link form is rejected as noise.

## Key Invariants

1. A reference is one of two forms: a bare issue reference, or a fully-qualified owner-and-repository reference.
2. A bare reference resolves against exactly one declared home repository.
3. Any cross-repository reference must be fully qualified.
4. References stay plain-text searchable; the full link form is rejected.

## Integration Points

- [concept-store](concept-store.md) — every page carries a provenance reference to its originating issue.
- [append-only-decision-log](append-only-decision-log.md) — each log entry is attributed by a provenance reference.

## Decision Log

### 2026-06-10 — bootstrap — 0003: two search-native reference forms

Defined provenance as either a bare issue reference against a home repository, or a fully-qualified cross-repository reference. The considered alternative — always storing the full issue link — was rejected as search-hostile noise that bloats single-repo pages, whereas the two terse forms keep references short, greppable, and unambiguous across repositories using syntax the host already resolves.
