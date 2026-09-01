---
title: "Verb Reachability"
aliases: ["component-invoked capability", "verb registry", "one executable many verbs", "reachability rather than size", "process-boundary hoisting", "migration-axis parity"]
touches: ["component-invocation-gate", "portable-tooling", "nexus-setup-cli", "pr-worktree", "close-entry-migration", "record-digest", "distiller", "issue-sourced-planning", "target-root-convention", "toolkit-location", "release-identity", "environment-guard", "delegating-port", "additive-surface-fold"]
last_updated_by: "#354"
status: active
verification: verified
---

# Verb Reachability

A capability becomes reachable by name, a verb on one named executable, exactly when a Nexus component body invokes it. A capability that only the build or release process invokes stays source-only and never ships.

## How It Works

Every reachable capability is declared once in one registry, mapping a name to its summary, usage text, and a runnable. A second registry served another runtime's capabilities under a second name; those folded in here and it was deleted with that name, its machine listing withdrawn. The registry is imported eagerly, so one object composes the usage text and supplies the declared surface a build-time gate checks invocations against: the complete dispatch name, further names included, read from the table that dispatches them wherever one exists. No capability keeps import-time behavior of its own; the one place a process reads its arguments and exits is the dispatcher built from the registry, once per runnable artifact, because a module inlined beside others loses any private sense of which file was invoked. Parity compares un-built source against a fresh build. A capability driving an external program is compared through a hermetic, committed stand-in on both sides, covering the arguments the program received and the file tree left behind, not console output alone.

## Key Invariants

1. A capability's reachability is decided by who invokes it: a component body earns a verb; a build- or release-only invoker keeps the capability source-only.
2. Exactly one registry declares every reachable capability, whatever runtime it once ran on; the dispatcher composes its usage text from it, so an undocumented verb cannot exist.
3. No capability may execute anything at import time; the process boundary exists exactly once per runnable artifact, in the dispatcher — which hands each capability its arguments directly, never through a process-global.
4. Parity compares un-built source against a fresh build; a surviving legacy form adds a temporary axis against it, covering every reachable capability.
5. A capability driving an external program is compared through a hermetic, committed stand-in on both sides, covering the arguments it received and any file tree it left.
6. The declared surface is the complete dispatch name; further names are declared beside the verb they own, read from the table that dispatches them wherever one exists rather than hand-copied.
7. Exactly one dispatch name reports release identity, at every commit, not only once a fold ends.

## Integration Points

- [component-invocation-gate](component-invocation-gate.md) — reads this registry's declared dispatch names to decide whether a name written in a shipped body resolves.
- [portable-tooling](portable-tooling.md) — hosts this registry's built executable, under its parity and fingerprint discipline, alongside the five distiller capabilities' own standalone builds.
- [nexus-setup-cli](nexus-setup-cli.md) — the deploy and workspace verbs already reachable on this same executable, now dispatched from the shared registry alongside the newly reachable capabilities.
- [pr-worktree](pr-worktree.md) — the worktree-management capability now reachable as a verb, held to byte-identical output and matching spawned-process arguments against its script form.
- [close-entry-migration](close-entry-migration.md) — the migration capability now reachable as a verb, under the same byte-identical parity guarantee as its script form.
- [record-digest](record-digest.md) — now reachable as a verb, matched byte-for-byte against its script form by the migration-axis parity check.
- [distiller](distiller.md) — its atlas, validator, entry-diff, drift-advisory and registry-seeding steps are reachable only as verbs; their standalone forms are deleted.
- [issue-sourced-planning](issue-sourced-planning.md) — its epic resolver is now reachable as a verb, matched byte-for-byte against its script form.
- [target-root-convention](target-root-convention.md) — every reachable verb touching project state now parses this same argument before its own dispatch.
- [toolkit-location](toolkit-location.md) — how the named executable is found once a capability has earned a name on it.
- [release-identity](release-identity.md) — reported by exactly one verb declared here, under the same one-object-on-standard-output contract every verb keeps.
- [environment-guard](environment-guard.md) — cross-cutting behavior placed in the dispatcher rather than in each verb, which is what makes a later-added verb covered by it.
- [delegating-port](delegating-port.md) — a row here whose runnable delegates to a retained entry point on another runtime, so porting needs no second registry.
- [additive-surface-fold](additive-surface-fold.md) — rows added here while a second name still declared the same capabilities, which is what let the caller rewrite ship separately from the withdrawal.

## Decision Log


### 2026-08-23 — #247 — Ten more component-invoked capabilities become verbs on one shared, eagerly-dispatched registry

Ten capabilities a Nexus component body invokes — three read-only resolvers, two that drive git worktrees, and five the distiller invokes — became verbs on the executable two of them (deploy, workspace) already lived on, dispatched from a single declarative registry rather than a hand-maintained if/else, so a verb cannot exist without appearing in the composed usage text a later build-time gate reads. A measured build eagerly importing every capability came to 410 KB and started in the same order of magnitude as the executable already did, so lazy dispatch was refused: a self-contained artifact inlines a deferred import into the same bytes anyway, and only a static registry can be scanned at build time for the declared verb set the later gate needs. Hoisting the process boundary out of every capability into that one dispatcher was forced by a measured hazard, not a hypothetical one — a probe build that statically imported every capability found two capabilities executing their own main routine on import and exiting before the dispatcher ever saw its arguments, because inlining collapses every module's private sense of which file was invoked down to one shared value; the prior mitigation, a guard keyed on the artifact's filename, expires silently the moment the artifact is renamed, which is exactly what the next stage of this work does. Parity gained a second, temporary axis — comparing each legacy script or bundle against its verb — extended to capabilities already believed migrated, which is how a real divergence surfaced: one capability sent its failure diagnostic to standard output in script form and standard error in verb form, and a component body already named both forms as interchangeable. For a capability driving an external program, both sides of a comparison run against the same hermetic, committed stand-in, and the comparison was meant to cover five facets rather than three — adding the exact spawned arguments and the resulting file tree — though the two worktree-driving capabilities shipped with four of the five in practice: the argument-log facet was judged redundant given that both capabilities' verb and script forms call the identical shared library functions through the identical runner, so no second code path could construct a diverging argument list. Refuted alternative: discover verbs by module-naming convention instead of a declared registry — it cannot be scanned into a self-contained artifact and it makes the declared verb set non-static, exactly what the later invocation gate needs to read.

### 2026-08-25 — #248 — Reciprocal link from target-root-convention

Mechanical reciprocity fan-out: the target-root-convention page names every reachable verb touching project state as now parsing that same explicit-root argument before its own dispatch.

### 2026-08-26 — #249 — Reachability by name spans a second toolkit, and a declared argument channel must be the real one

The addressing rule was found to be a property of every toolkit rather than of the one executable: capabilities held out of the collapse because they need no install are still invoked by naming a toolkit and a capability, so the second toolkit was given a dispatcher built from the same kind of declared table, its usage text composed from that table and its unknown-name error rendered from it too. Building it exposed that the first dispatcher's declared per-capability argument signature was not the channel two of its capabilities actually read: the arguments really travelled through a process-global the dispatcher mutated, which any in-process caller, test, or nested invocation would have been handed wrongly and silently. The declared channel is now the real one, and the process-global is kept set only for the name it lends a capability's own usage text. Separately, the parity harness stopped seeding fixture repositories with a copy of the second toolkit and put its entry point on the path beside the platform stand-in instead — a seeded copy made every fixture unlike a real repository once the components stop being committed, and a build compared from a scratch directory has no checkout to fall back into, so source and build agree only when the toolkit is reachable by name for both. Refuted alternative: correct only the comment beside the process-global and keep it as the channel — cheaper, but it leaves a dispatcher whose declared signature cannot be trusted.

### 2026-08-26 — #251 — Cross-cutting behavior belongs in the dispatcher, and the registry became injectable

Behavior every verb must have is placed in the dispatcher, before dispatch, rather than wrapped around each capability at registration — because coverage of a verb added later is a property of where dispatch happens, not of anything that verb remembers to do. Making that demonstrable required the dispatcher to accept a verb registry as a parameter, so a verb the real registry does not contain can be dispatched; the registry type became public with it. That is a testability seam no story asked for, accepted because the property it proves is otherwise untestable. A reporting verb was also declared in both toolkits' registries, keeping the rule per-toolkit rather than per-language. Refuted: wrapping each verb's runnable at registration, which makes every future verb responsible for remembering the wrapper — precisely the coverage gap the placement exists to close.

### 2026-08-27 — #252 — The duplication window closes and the dispatcher becomes the only entry

The five distiller capabilities' standalone forms are deleted rather than left unbuilt, which retires their temporary migration axis exactly as the rule intended: parity now runs the dispatcher with the matching verb, and a dead file that still looks like a process boundary no longer sits in the tree for the next entry point to be copied from. The second toolkit's last module-level self-run guard went with them, so each toolkit has exactly one process boundary — which is what lets cross-cutting setup, byte-code suppression included, be placed once rather than remembered per capability. Refuted: keeping the launcher sources as unbuilt files, which carries zero deletion risk but leaves the dispatcher's one-boundary claim untrue on the page and in the tree.

### 2026-08-27 — #250 — A further dispatch name is part of the declared surface, and a machine listing is a flag rather than a name

The names a component body may write are the complete dispatch names, so a verb that dispatches further names declares them beside itself and the gate composes the two-token names from that same array: checking only the leading name would have left the commonest realistic typo ungated, since most high-traffic invocations in the bodies are two-token. Each dispatcher was given one membership guard reading that array, which makes "the dispatcher and the gate read one list" literally true and leaves no unreachable unknown-name tail, without touching any existing message or exit code. The second toolkit's machine surface became a flag emitting sorted structured output rather than a declared capability of its own: a flag cannot collide with a capability name, whereas a declared capability would appear in its own listing and in the human usage as though it were a delivery capability. Structured output also means rewording the human diagnostic can never break the gate. Refuted: restructuring each dispatcher into a name-to-handler table mirroring the registry — cleaner symmetry, but it rewrites five working bodies for a story about the gate; and checking leading names only, the literal reading of the epic, which leaves the busiest sites unchecked.

### 2026-08-28 — #351 — Reciprocal link from delegating-port

A delegating port leaves its not-yet-ported capabilities as ordinary rows in this registry, their runnables crossing a process boundary to a retained entry point. The registry's own contract is untouched by that: what a row declares is unchanged, so the declared surface stays complete throughout a port.

### 2026-08-31 — #354 — One registry, subverbs read from the table that dispatches them, and one release-identity name

The three capabilities that ran on the other runtime were folded in as flat top-level verbs under the names they already answered to, and the second registry was deleted with its name. Grouping them under one forge-facing verb reads better and would have signalled that these three talk to a forge while the rest do not — refuted because the gate resolves at most a verb plus one further name, and the configuration resolver already carries a command layer, so a grouping token would push its commands to three tokens and widen the gate in the epic that exists to narrow it. The folded resolver's further names are read from the table that dispatches them rather than hand-listed beside the three existing literal lists, because this was the one place the epic was adding surface and a hand-maintained copy is what invariant 7 forbids. Release identity resolved the same way it was deferred to be resolved: the narrower capability was never folded, so the registry never gained a second candidate and exactly one name reports identity at the fold rather than only after the withdrawal.
