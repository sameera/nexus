---
title: "Inert Declaration Removal"
aliases: ["inert declaration", "delete don't null", "dead requirement removal", "scaffolding teardown", "closing pass", "declared but unenforced"]
touches: ["delegating-port", "published-package", "environment-guard", "release-identity", "shipped-payload", "component-invocation-gate"]
last_updated_by: "#354"
status: active
verification: verified
---

# Inert Declaration Removal

When a dependency leaves a release, every declaration that described it is deleted rather than emptied, nulled, or softened to an advisory. An inert declaration is read by a human and by tooling as a live requirement, and a contract emptied of meaning is harder for a consumer to detect than an absent one.

## How It Works

Removing a dependency leaves scaffolding of several shapes, and one rule settles each. A declared requirement goes even where nothing enforced it — being read is its entire effect, by a person evaluating the package and by tooling that reports declared requirements as real. A reported key goes rather than reporting an empty value, because a consumer reading it would treat its presence as meaningful. A diagnostic naming a defect the product can no longer have goes too: reporting on something the product neither uses nor is responsible for is a claim it has no standing to make. A gate's recogniser goes even though the gate then rejects strictly less, once what it recognised can only be the adopting project's own business.

The one thing that may stay is a mechanism whose entries are emptied — a filter, a stated exclusion point — kept so the next category of its kind is named where one already exists. Its entries still go, so no pattern that can never match again reads as live.

## Key Invariants

1. A declaration describing a departed dependency is deleted, never retained empty, null, or advisory.
2. A declared requirement with no enforcement behind it is removed on the same grounds as an enforced one: being read is the effect.
3. A published output key is dropped rather than nulled — an absent key is a signal a consumer already knows how to read, an empty one is not.
4. A diagnostic is removed with the thing it diagnosed, so nothing reports a defect the product can no longer have.
5. A gate's recogniser for a departed form is removed even though the gate then rejects strictly less, provided the enforcement that gate exists for is demonstrably untouched.
6. A mechanism outlives its entries only where a successor category will be named in it; the entries are emptied in the same change.
7. Frozen fixtures and historical records are exempt: their byte-identity, or their accuracy about the past, is the property under test.

## Integration Points

- [delegating-port](delegating-port.md) — the pattern whose closing pass this is: the scaffolding a port leaves standing once its last delegating row has flipped.
- [published-package](published-package.md) — the declared runtime floor removed here, unenforced by any installer and therefore read rather than acted on.
- [environment-guard](environment-guard.md) — the diagnostic removed with the dependency it named, rather than left reporting on something the release no longer has.
- [release-identity](release-identity.md) — the reported key dropped rather than nulled, because an emptied contract is harder to detect than an absent one.
- [shipped-payload](shipped-payload.md) — the filter whose mechanism stays while its entries empty, the one shape that survives this rule.
- [component-invocation-gate](component-invocation-gate.md) — the recogniser removed here, and the demonstration that the enforcement the gate exists for is untouched by removing it.

## Decision Log

### 2026-08-31 — #354 — Inert declarations are deleted, not emptied, and one mechanism survives its entries

Retaining each inert declaration for a release as a soft deprecation was the viable alternative, argued separately for each shape: the runtime floor as a manifest shape adopters' tooling diffs, the reported key as a null-valued soft deprecation, the filter's patterns as a record of what was once excluded. All were refuted on one ground — inertness is the defect, not the mitigation. A declared floor and a present key are read as live requirements, and a deprecation signal implies a requirement that returns or is being phased down, when there is nothing left to phase down. The gate recogniser was the hardest case, because removing it is a genuine reduction in what the gate rejects; it was accepted only once the enforcement the gate exists for — no shipped body reaching a capability by path — was shown untouched. The filter is the deliberate exception: its mechanism stays so the next incidental category is named where one already exists.
