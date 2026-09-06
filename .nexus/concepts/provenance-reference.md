---
title: "Provenance Reference"
aliases: ["provenance hop", "issue reference form", "cross-repo reference", "page blame", "reference substitution"]
touches: ["concept-store", "append-only-decision-log", "fix-lane"]
last_updated_by: "#263"
status: active
verification: verified
---

# Provenance Reference

A provenance reference links a concept page or a log entry back to the issue that originated it, so an agent can hop from a compressed page to the full context it distilled away. It takes one of two search-native forms so the hop stays unambiguous across repositories.

## How It Works

A bare issue reference resolves against a single declared home repository. This is the default for single-repo cases. A fully-qualified owner-and-repository reference overrides it and is required for any cross-repository link.

The host uses its own cross-repo syntax here. No new resolver is needed. Every reference stays plain-text searchable.

The distinction between forms matters most in decision history. When one shared concept can accumulate entries from epics in different repositories, a bare reference would resolve to the wrong issue. Bootstrap and manual pages use literal markers instead of issue references. The full link form is rejected as noise.

When a drain runs from a workspace hub, it writes every reference in the qualified form. The qualification comes from the entry's originating repository. The issue never lives in the hub's own repository. A bare reference there would resolve to the wrong issue. A single-repo drain still defaults to bare form against its home repository.

A reference may name an issue or a pull request. The two share one number namespace. Whichever the author named is what gets written. Only the qualification is added to it. The referenced artifact never changes.

## Key Invariants

1. A reference is one of two forms: a bare issue reference, or a fully-qualified owner-and-repository reference.
2. A bare reference resolves against exactly one declared home repository.
3. Any cross-repository reference must be fully qualified.
4. References stay plain-text searchable; the full link form is rejected.
5. A workspace-hub drain writes only the qualified form, resolved from the entry's recorded originating repo; the bare form is written only by a single-repo drain against its home repository.
6. A reference may name an issue or a pull request, and neither is ever substituted for the other; qualifying a reference is not substituting it.

## Integration Points

- [concept-store](concept-store.md) — every page carries a provenance reference to its originating issue.
- [append-only-decision-log](append-only-decision-log.md) — each log entry is attributed by a provenance reference.
- [fix-lane](fix-lane.md) — reads its single input in this grammar, so what resolves at the input is what reaches the page.

## Decision Log

### 2026-06-10 — bootstrap — 0003: two search-native reference forms

Defined provenance as either a bare issue reference against a home repository, or a fully-qualified cross-repository reference. The considered alternative — always storing the full issue link — was rejected as search-hostile noise that bloats single-repo pages, whereas the two terse forms keep references short, greppable, and unambiguous across repositories using syntax the host already resolves.

### 2026-07-15 — #54 — Qualified reference is the workspace-hub default

Draining from a workspace hub, the distiller now defaults every reference to the qualified owner-and-repository form, resolved from the entry's recorded originating repo, and never writes the bare form; a single-repo drain still defaults to the bare form. This inverts the earlier default only on the hub path. The reason: in a hub the issue never lives in the drain's own repo, so a bare reference resolves against the hub and points at the wrong issue. The considered alternative — keep the single-repo behavior of probing the issue in the drain's own repo and qualifying only on a title mismatch — needed no new logic, but in a hub that probe runs against a repo that does not own the issue, so a coincidental title match would emit a wrong bare reference, and it spends a lookup per entry for something the recorded repo already gives correctly.

### 2026-09-05 — #263 — A reference names an issue or a pull request, and neither is ever swapped for the other

A lane taking a single reference as its whole input made explicit what had been left unsaid: the number may identify an issue or a pull request, the two share one namespace, and distinguishing them costs effort while buying nothing. What the author named is what gets written — a pull request is never replaced by the issue it closes, nor an issue by the pull request that closed it, even when the commit range was taken from that pull request. Qualifying a bare reference with the owner and repository resolved from the recorded range is not a substitution, because the artifact referenced does not change; that is why the hub rule and this one do not conflict. The considered alternative — invent a new literal marker to sit beside the bootstrap and manual ones — reads tidily, but a bare word cannot be followed back to any context, which defeats the only job a provenance marker has, and one shared marker would match every such entry ever drained wherever whole tokens are compared.
