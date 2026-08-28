---
title: "Component Invocation Gate"
aliases: ["code-span invocation scan", "addressing-form classification", "declared-surface check", "pending migration register", "no silent regression to a path"]
touches: ["verb-reachability", "toolkit-location", "shipped-payload", "release-gate", "portable-tooling", "checkout-only-path-gate"]
last_updated_by: "#258"
status: active
verification: verified
---

# Component Invocation Gate

Every toolkit invocation written in a shipped component body must name a toolkit and a dispatch name that toolkit declares, checked by the source repository's own gate. The gated unit is the code span — fenced or inline — so a repository-bound path one backtick away is caught while a toolkit name in running prose is not. A failure names the body, the line and the offending name, and a migrated body cannot silently regress.

## How It Works

One scanner walks the same set of shipped bodies the payload boundary defines, reads every code span, and classifies each invocation against a closed set of addressing forms: the two named-toolkit forms, and the repository-bound ones — a transpiler or an interpreter run against a script, a runtime run against a bundle, and a workspace script alias. Being unrecognised is itself reportable, so a repository-bound artifact named with no command around it still fails.

A named form is resolved against the toolkit's own declared surface, obtained from that surface and never from a copy; a surface that cannot be obtained fails the gate rather than falling back to an assumed list. The gate runs only the two toolkit entry points, with arguments it composes itself, never a string read from a body.

The span reader tracks the length of the marker that opened a fenced block, because bodies nest longer markers around shorter ones and a reader toggling on any marker stops gating everything after an unbalanced inner fence.

## Key Invariants

1. The gated unit is a code span, fenced or inline; a toolkit name in running prose is never gated.
2. The gated set of bodies is the set that ships, so no shipped body can escape the gate.
3. Neither toolkit's declared surface is duplicated for the gate's benefit; a surface that cannot be obtained fails the gate, which never assumes a list.
4. The gate runs only the two toolkit entry points, never a string read from a body, and needs no network access and no credentials.
5. Every failure names the offending body, its line, and the offending name.
6. The gate checks dispatch names only; flags and argument shapes have no declared surface to check against.
7. Enforcement is unconditional: the register of not-yet-migrated bodies reached empty and was removed, so a reintroduced path or inherited interpreter fails at once.

## Integration Points

- [verb-reachability](verb-reachability.md) — supplies the declared dispatch names, further names included, that a named invocation in a body is resolved against.
- [toolkit-location](toolkit-location.md) — the addressing rule this gate enforces in every shipped body, and the guard that stops a migrated body regressing.
- [shipped-payload](shipped-payload.md) — defines which bodies ship, and so exactly which bodies this gate reads.
- [release-gate](release-gate.md) — the narrower release-time path precondition this build-time check now keeps green ahead of it.
- [portable-tooling](portable-tooling.md) — the source-repo gate this check was added to, beside the parity and fingerprint checks already run there.
- [checkout-only-path-gate](checkout-only-path-gate.md) — the sibling scan over the same shipped bodies, checking the locations they name where this one checks invocations.

## Decision Log

### 2026-08-27 — #250 — The gated unit is a code span, and the check rides the gate that already reads the payload

The check was added to the gate that already enforces bundle parity, the payload fingerprint and the payload composition boundary rather than shipping as its own step: that gate already reads the payload and already fails the source repository's test run, and with no continuous-integration runner a standalone step becomes the thing people forget to run. The gated unit is a code span of any kind rather than a fenced block only, which corrects the epic — measured against the live bodies, four real instructions sat in inline spans, and a fenced-only rule would have built in exactly the blind spot the rule exists to close, letting a body be certified migrated with a repository-bound path one backtick away. Being unrecognised was made reportable for the same reason: four sites named a repository-bound artifact with no command around it. An explicit register of not-yet-migrated bodies carried the migration, so the gate could land ahead of the rewrites and still guard every body already migrated; it reached empty when the last body was rewritten, which was this epic's recorded completion condition for it, and it was removed with its parameter so no unused exemption channel survives. Refuted: deriving migrated as "this body currently contains no repository-bound form", which needs no bookkeeping but makes the regression guard a tautology — reintroducing a path merely reclassifies the body and the build stays green.

### 2026-08-28 — #258 — Reciprocal link from checkout-only-path-gate

Mechanical reciprocity fan-out: a second build-time scan now reads the same shipped bodies this gate reads, checking the locations a body sends a stage to rather than the toolkit names it invokes. The two are siblings over one payload boundary; nothing about this gate changed.
