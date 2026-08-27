---
title: "Verb Reachability"
aliases: ["component-invoked capability", "verb registry", "one executable many verbs", "reachability rather than size", "process-boundary hoisting", "migration-axis parity"]
touches: ["portable-tooling", "nexus-setup-cli", "pr-worktree", "close-entry-migration", "record-digest", "distiller", "issue-sourced-planning", "target-root-convention", "toolkit-location", "release-identity", "environment-guard"]
last_updated_by: "#251"
status: active
verification: verified
---

# Verb Reachability

A capability becomes reachable by name, a verb on one named executable, exactly when a Nexus component body invokes it. A capability that only the build or release process invokes stays source-only and never ships.

## How It Works

Every reachable capability is declared once in its toolkit's single registry, mapping a name to its summary, usage text, and a runnable; the rule is per toolkit, not per language, so a second toolkit answers to one name the same way. The registry is imported eagerly, so the same object composes the usage text and supplies the verb set a later build-time gate checks invocation strings against. No capability keeps import-time behavior of its own; the one place a process reads its arguments and exits is the dispatcher built from the registry, once per runnable artifact, because a module inlined beside others loses any private sense of which file was invoked. Two parity axes keep a verb honest while its legacy form still exists: a durable axis compares un-built source against a fresh build, and a temporary migration axis compares the legacy form against the verb, extended even to capabilities already believed migrated, which is how a real behavioral divergence surfaced. A capability driving an external program is compared through a hermetic, committed stand-in on both sides, covering the arguments the program received and the file tree left behind, not console output alone.

## Key Invariants

1. A capability's reachability is decided by who invokes it: a component body earns a verb; a build- or release-only invoker keeps the capability source-only.
2. Every reachable capability is declared in exactly one registry; the dispatcher composes its own usage text from that registry, so an undocumented verb cannot exist.
3. No capability may execute anything at import time; the process boundary exists exactly once per runnable artifact, in the dispatcher — which hands each capability its arguments directly, never through a process-global.
4. Parity runs two axes while a legacy form exists: source-vs-build (durable) and legacy-vs-verb (temporary, retired once the legacy form is deleted); the migration axis covers every reachable capability, not only the ones moving in a given change.
5. A capability that drives an external program is compared through a hermetic, committed stand-in on both sides, covering the exact arguments it received and any file tree it left, not console output alone.

## Integration Points

- [portable-tooling](portable-tooling.md) — hosts this registry's built executable, under its parity and fingerprint discipline, alongside the five distiller capabilities' own standalone builds.
- [nexus-setup-cli](nexus-setup-cli.md) — the deploy and workspace verbs already reachable on this same executable, now dispatched from the shared registry alongside the newly reachable capabilities.
- [pr-worktree](pr-worktree.md) — the worktree-management capability now reachable as a verb, held to byte-identical output and matching spawned-process arguments against its script form.
- [close-entry-migration](close-entry-migration.md) — the migration capability now reachable as a verb, under the same byte-identical parity guarantee as its script form.
- [record-digest](record-digest.md) — now reachable as a verb, matched byte-for-byte against its script form by the migration-axis parity check.
- [distiller](distiller.md) — its atlas, validator, entry-diff, drift-advisory and registry-seeding steps are now reachable as verbs, alongside their standalone forms through the duplication window.
- [issue-sourced-planning](issue-sourced-planning.md) — its epic resolver is now reachable as a verb, matched byte-for-byte against its script form.
- [target-root-convention](target-root-convention.md) — every reachable verb touching project state now parses this same argument before its own dispatch.
- [toolkit-location](toolkit-location.md) — how a named toolkit is found once a capability has earned a name, and the second toolkit that rule now spans.
- [release-identity](release-identity.md) — reported by a verb declared in each toolkit's registry, under the same one-object-on-standard-output contract every verb keeps.
- [environment-guard](environment-guard.md) — cross-cutting behavior placed in the dispatcher rather than in each verb, which is what makes a later-added verb covered by it.

## Decision Log

### 2026-08-23 — #247 — Ten more component-invoked capabilities become verbs on one shared, eagerly-dispatched registry

Ten capabilities a Nexus component body invokes — three read-only resolvers, two that drive git worktrees, and five the distiller invokes — became verbs on the executable two of them (deploy, workspace) already lived on, dispatched from a single declarative registry rather than a hand-maintained if/else, so a verb cannot exist without appearing in the composed usage text a later build-time gate reads. A measured build eagerly importing every capability came to 410 KB and started in the same order of magnitude as the executable already did, so lazy dispatch was refused: a self-contained artifact inlines a deferred import into the same bytes anyway, and only a static registry can be scanned at build time for the declared verb set the later gate needs. Hoisting the process boundary out of every capability into that one dispatcher was forced by a measured hazard, not a hypothetical one — a probe build that statically imported every capability found two capabilities executing their own main routine on import and exiting before the dispatcher ever saw its arguments, because inlining collapses every module's private sense of which file was invoked down to one shared value; the prior mitigation, a guard keyed on the artifact's filename, expires silently the moment the artifact is renamed, which is exactly what the next stage of this work does. Parity gained a second, temporary axis — comparing each legacy script or bundle against its verb — extended to capabilities already believed migrated, which is how a real divergence surfaced: one capability sent its failure diagnostic to standard output in script form and standard error in verb form, and a component body already named both forms as interchangeable. For a capability driving an external program, both sides of a comparison run against the same hermetic, committed stand-in, and the comparison was meant to cover five facets rather than three — adding the exact spawned arguments and the resulting file tree — though the two worktree-driving capabilities shipped with four of the five in practice: the argument-log facet was judged redundant given that both capabilities' verb and script forms call the identical shared library functions through the identical runner, so no second code path could construct a diverging argument list. Refuted alternative: discover verbs by module-naming convention instead of a declared registry — it cannot be scanned into a self-contained artifact and it makes the declared verb set non-static, exactly what the later invocation gate needs to read.

### 2026-08-25 — #248 — Reciprocal link from target-root-convention

Mechanical reciprocity fan-out: the target-root-convention page names every reachable verb touching project state as now parsing that same explicit-root argument before its own dispatch.

### 2026-08-26 — #249 — Reachability by name spans a second toolkit, and a declared argument channel must be the real one

The addressing rule was found to be a property of every toolkit rather than of the one executable: capabilities held out of the collapse because they need no install are still invoked by naming a toolkit and a capability, so the second toolkit was given a dispatcher built from the same kind of declared table, its usage text composed from that table and its unknown-name error rendered from it too. Building it exposed that the first dispatcher's declared per-capability argument signature was not the channel two of its capabilities actually read: the arguments really travelled through a process-global the dispatcher mutated, which any in-process caller, test, or nested invocation would have been handed wrongly and silently. The declared channel is now the real one, and the process-global is kept set only for the name it lends a capability's own usage text. Separately, the parity harness stopped seeding fixture repositories with a copy of the second toolkit and put its entry point on the path beside the platform stand-in instead — a seeded copy made every fixture unlike a real repository once the components stop being committed, and a build compared from a scratch directory has no checkout to fall back into, so source and build agree only when the toolkit is reachable by name for both. Refuted alternative: correct only the comment beside the process-global and keep it as the channel — cheaper, but it leaves a dispatcher whose declared signature cannot be trusted.

### 2026-08-26 — #251 — Cross-cutting behavior belongs in the dispatcher, and the registry became injectable

Behavior every verb must have is placed in the dispatcher, before dispatch, rather than wrapped around each capability at registration — because coverage of a verb added later is a property of where dispatch happens, not of anything that verb remembers to do. Making that demonstrable required the dispatcher to accept a verb registry as a parameter, so a verb the real registry does not contain can be dispatched; the registry type became public with it. That is a testability seam no story asked for, accepted because the property it proves is otherwise untestable. A reporting verb was also declared in both toolkits' registries, keeping the rule per-toolkit rather than per-language. Refuted: wrapping each verb's runnable at registration, which makes every future verb responsible for remembering the wrapper — precisely the coverage gap the placement exists to close.
