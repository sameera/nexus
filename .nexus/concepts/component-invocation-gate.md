---
title: "Component Invocation Gate"
aliases: ["code-span invocation scan", "addressing-form classification", "declared-surface check", "pending migration register", "no silent regression to a path"]
touches: ["verb-reachability", "toolkit-location", "shipped-payload", "release-gate", "portable-tooling", "checkout-only-path-gate", "inert-declaration-removal", "additive-surface-fold"]
last_updated_by: "#354"
status: active
verification: verified
---

# Component Invocation Gate

Every invocation written in a shipped component body must name the executable and a dispatch name it declares, checked by the source repository's own gate. The gated unit is the code span — fenced or inline — so a repository-bound path one backtick away is caught while a toolkit name in running prose is not. A failure names the body, the line and the offending name, and a migrated body cannot silently regress.

## How It Works

One scanner walks the same set of shipped bodies the payload boundary defines, reads every code span, and classifies each invocation against a closed set of addressing forms: the named-executable form and the repository-bound ones — a transpiler run against a script, a runtime run against a bundle, and a workspace script alias. Being unrecognised is itself reportable: a repository-bound artifact named with no command still fails.

A named form is resolved against the executable's own declared surface, obtained from it and never from a copy; a surface that cannot be obtained fails the gate rather than falling back to an assumed list. It is read as a value, never executed.

The span reader tracks the length of the marker opening a fenced block, because bodies nest longer markers around shorter ones and a reader toggling on any marker stops gating everything after an unbalanced inner fence.

## Key Invariants

1. The gated unit is a code span, fenced or inline; a toolkit name in running prose is never gated.
2. The gated set of bodies is the set that ships, so no shipped body can escape the gate.
3. The declared surface is never duplicated for the gate's benefit; a surface that cannot be obtained fails the gate, which never assumes a list.
4. The gate executes nothing — it reads the declared surface as a value — and needs no network access, no credentials, and never a string read from a body.
5. Every failure names the offending body, its line, and the offending name.
6. The gate checks dispatch names only; flags and argument shapes have no declared surface to check against.
7. Enforcement is unconditional: the register of not-yet-migrated bodies reached empty and was removed, so a reintroduced path fails at once. Narrowing the form set never narrows that: a script under the component tree, a bundle by filename, or a workspace alias still fails.

## Integration Points

- [verb-reachability](verb-reachability.md) — supplies the declared dispatch names, further names included, that a named invocation in a body is resolved against.
- [toolkit-location](toolkit-location.md) — the addressing rule this gate enforces in every shipped body, and the guard that stops a migrated body regressing.
- [inert-declaration-removal](inert-declaration-removal.md) — why a recogniser for a departed form is deleted rather than reclassified, once what it caught can only be the adopting project's own tooling.
- [additive-surface-fold](additive-surface-fold.md) — resolving against the live surface is what forces a fold's order: names first, bodies next, and this gate's memory of the old name last.
- [shipped-payload](shipped-payload.md) — defines which bodies ship, and so exactly which bodies this gate reads.
- [release-gate](release-gate.md) — the narrower release-time path precondition this build-time check now keeps green ahead of it.
- [portable-tooling](portable-tooling.md) — the source-repo gate this check was added to, beside the parity and fingerprint checks already run there.
- [checkout-only-path-gate](checkout-only-path-gate.md) — the sibling scan over the same shipped bodies, checking the locations they name where this one checks invocations.

## Decision Log


### 2026-08-27 — #250 — The gated unit is a code span, and the check rides the gate that already reads the payload

The check was added to the gate that already enforces bundle parity, the payload fingerprint and the payload composition boundary rather than shipping as its own step: that gate already reads the payload and already fails the source repository's test run, and with no continuous-integration runner a standalone step becomes the thing people forget to run. The gated unit is a code span of any kind rather than a fenced block only, which corrects the epic — measured against the live bodies, four real instructions sat in inline spans, and a fenced-only rule would have built in exactly the blind spot the rule exists to close, letting a body be certified migrated with a repository-bound path one backtick away. Being unrecognised was made reportable for the same reason: four sites named a repository-bound artifact with no command around it. An explicit register of not-yet-migrated bodies carried the migration, so the gate could land ahead of the rewrites and still guard every body already migrated; it reached empty when the last body was rewritten, which was this epic's recorded completion condition for it, and it was removed with its parameter so no unused exemption channel survives. Refuted: deriving migrated as "this body currently contains no repository-bound form", which needs no bookkeeping but makes the regression guard a tautology — reintroducing a path merely reclassifies the body and the build stays green.

### 2026-08-28 — #258 — Reciprocal link from checkout-only-path-gate

Mechanical reciprocity fan-out: a second build-time scan now reads the same shipped bodies this gate reads, checking the locations a body sends a stage to rather than the toolkit names it invokes. The two are siblings over one payload boundary; nothing about this gate changed.

### 2026-08-28 — #351 — Both declared surfaces are read as values, so the gate spawns nothing

The second toolkit's capability listing used to be obtained by executing its entry point under the other runtime and reading the machine listing it emits. Once both surfaces were the same language the gate read the registry directly instead: executing a process to ask a question the compiler can already answer buys no extra fidelity, and this was the only remaining reason a build step would spawn anything. The property that mattered is preserved, because the registry is still the surface itself — the same declaration the usage text is rendered from — so the gate still never scrapes human prose and still keeps no duplicate list. The machine-readable listing stays published on the toolkit, being a declared part of its capability surface for readers outside this build. **Refuted alternative:** keep executing the entry point, now under the new runtime; it preserves reading the surface by exercising it, but makes the gate depend on a build artifact or a source runner.

### 2026-08-31 — #354 — The form set narrows with the runtime, as an accepted bounded reduction

The leader tokens naming a departed runtime, the addressing form for a script run under it, and the form recognising the withdrawn second name were all removed from the closed set and the legacy list. Keeping the leader tokens but reclassifying them under the catch-all form, which preserves the current rejection set exactly, was the viable alternative — refuted because it retains a rule whose only surviving effect is to fail a body for naming a language the product no longer has an opinion about, and because the story's own criterion was that no leader token name an interpreter. The reduction is real and was accepted on a scoped claim rather than a denial: the gate exists so that no shipped body reaches a capability by path, and the recogniser for repository-bound artifacts is untouched. Removing this form last, after the body rewrite and the name withdrawal, is what kept every intermediate commit green.
