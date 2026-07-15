---
title: "Provenance Reference"
aliases: ["provenance hop", "issue reference form", "cross-repo reference", "page blame"]
touches: ["concept-store", "append-only-decision-log"]
last_updated_by: "#54"
status: active
verification: verified
---

# Provenance Reference

A provenance reference links a concept page or a log entry back to the issue that originated it, so an agent can hop from a compressed page to the full context it distilled away. It takes one of two search-native forms so the hop stays unambiguous across repositories.

## How It Works

A bare issue reference resolves against a single declared home repository — the terse default for the common single-repo case. A fully-qualified owner-and-repository reference overrides it and is required for any cross-repository link. This is the host's own cross-repo issue syntax, so no new resolver is needed and every reference stays plain-text searchable. The distinction matters most in the decision history, where one shared concept can accumulate entries from epics in different repositories; a bare reference there would resolve to the wrong issue. Bootstrap and manual pages use their own literal markers in place of an issue reference. The full link form is rejected as noise. When a drain runs from a multi-repo workspace hub, every reference it writes is the qualified form, resolved from the entry's recorded originating repo — because the issue never lives in the hub's own repo, a bare reference there would resolve to the wrong one. A single-repo drain still defaults to the bare form against its home repository.

## Key Invariants

1. A reference is one of two forms: a bare issue reference, or a fully-qualified owner-and-repository reference.
2. A bare reference resolves against exactly one declared home repository.
3. Any cross-repository reference must be fully qualified.
4. References stay plain-text searchable; the full link form is rejected.
5. A workspace-hub drain writes only the qualified form, resolved from the entry's recorded originating repo; the bare form is written only by a single-repo drain against its home repository.

## Integration Points

- [concept-store](concept-store.md) — every page carries a provenance reference to its originating issue.
- [append-only-decision-log](append-only-decision-log.md) — each log entry is attributed by a provenance reference.

## Decision Log

### 2026-06-10 — bootstrap — 0003: two search-native reference forms

Defined provenance as either a bare issue reference against a home repository, or a fully-qualified cross-repository reference. The considered alternative — always storing the full issue link — was rejected as search-hostile noise that bloats single-repo pages, whereas the two terse forms keep references short, greppable, and unambiguous across repositories using syntax the host already resolves.

### 2026-07-15 — #54 — Qualified reference is the workspace-hub default

Draining from a workspace hub, the distiller now defaults every reference to the qualified owner-and-repository form, resolved from the entry's recorded originating repo, and never writes the bare form; a single-repo drain still defaults to the bare form. This inverts the earlier default only on the hub path. The reason: in a hub the issue never lives in the drain's own repo, so a bare reference resolves against the hub and points at the wrong issue. The considered alternative — keep the single-repo behavior of probing the issue in the drain's own repo and qualifying only on a title mismatch — needed no new logic, but in a hub that probe runs against a repo that does not own the issue, so a coincidental title match would emit a wrong bare reference, and it spends a lookup per entry for something the recorded repo already gives correctly.
