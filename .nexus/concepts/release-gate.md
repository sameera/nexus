---
title: "Release Gate"
aliases: ["release tail precondition", "invocation gate", "publish precondition", "in-repository path check"]
touches: ["component-invocation-gate", "toolkit-location", "published-package", "shipped-payload"]
last_updated_by: "#250"
status: active
verification: verified
---

# Release Gate

The tag and the public publish are blocked while any shipped component body reaches a toolkit capability by an in-repository path the payload does not carry. Such a path exists in no installed package, so a body naming one cannot work outside a source checkout. The gate is a runnable check standing ahead of the release tail, not a line of prose within the procedure.

## How It Works

The rule is narrow enough to check mechanically: a shipped body may name a path under the component tree only when the payload itself carries that file. A path the payload carries resolves wherever the components are deployed; a path it does not carry names a capability that has moved into a toolkit and is now reachable only by that toolkit's declared name. So a component-internal script passes and a moved capability fails — which is what keeps the rule from being one that can never go green.

A failure names every offending body, the line, and the path referenced. The remedy is never to add the path back to the payload: it is to rewrite the body to invoke the capability by its declared toolkit name, which resolves from any directory once the package is installed. The gate therefore goes green by itself when the invocation rewrite lands, and nobody has to remember to delete it.

Packing and installing locally is unaffected, and is the intended way to consume the package definition while the gate is still red.

## Key Invariants

1. The tag and the public publish must not run while any shipped body reaches a capability by a path the payload does not carry.
2. The rule is what the payload carries, not whether an in-repository path appears at all; a component-internal script passes.
3. A failure names every offending body, its line, and the path referenced.
4. The remedy is rewriting the body to a declared toolkit name, never adding the path back to the payload.
5. Packing and installing locally is unaffected by the gate.
6. The gate is a runnable step ahead of the tag and the publish, never a precondition stated only in prose.

## Integration Points

- [component-invocation-gate](component-invocation-gate.md) — the build-time check that keeps this release precondition green, catching a path long before the release tail runs.
- [toolkit-location](toolkit-location.md) — the addressing rule this gate enforces at release time: a capability is reached by its toolkit's declared name, not by a path.
- [published-package](published-package.md) — blocks that package's tag and publish while any offending body remains; packing and installing locally stays unaffected.
- [shipped-payload](shipped-payload.md) — the set the rule is measured against: a path the payload carries passes, a path it does not carry fails.

## Decision Log

### 2026-08-27 — #252 — Invariant 15 becomes a runnable gate rather than a written precondition

The conformance pass found a releaser walking straight from re-pin to publish with nothing between them but prose, so the record's constraint acquired an executable check it had not specified. A check that names the offending lines stops a release where prose would not, and — unlike a procedural note — it goes green on its own once the invocation rewrite lands, so nobody has to remember to remove it. Its rule is "the payload does not carry this path" rather than "no in-repository path appears", because a component-internal script works fine after deployment and flagging every such reference would produce a gate that can never pass. Refuted: a prose precondition in the release procedure — cheaper, but precisely the release-day habit the executed-changelog decision had already rejected once.

### 2026-08-27 — #250 — Reciprocal link from component-invocation-gate

Mechanical reciprocity fan-out: the component-invocation-gate page names this release precondition as the narrower check it now stands ahead of.
