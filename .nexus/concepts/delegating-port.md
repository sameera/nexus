---
title: "Delegating Port"
aliases: ["delegating port", "non-flag-day port", "cross-runtime delegation", "retained entry point", "delegating registry row", "incremental language port"]
touches: ["verb-reachability", "toolkit-location", "environment-guard", "published-package"]
last_updated_by: "#351"
status: active
verification: verified
---

# Delegating Port

A delegating port moves a toolkit's implementation onto another runtime one capability at a time, with no flag day and no second name. From the first change the name resolves to the new implementation, and every capability not yet ported stays a registry row whose runnable invokes the retained entry point as a child process. The old runtime stays a declared requirement until the last delegating row is gone.

## How It Works

Porting a whole surface at once is a change set nobody can review. Porting behind a second name is worse: every body and stage addressing the toolkit gets rewritten twice, onto the interim name and back off it. Neither works where the name is the contract.

So the dispatcher moves first and the capabilities follow. The new registry is authoritative from the first commit; a row not yet ported hands the capability name and its arguments to the retained entry point, inherits its output, and forwards its exit code unchanged.

Delegation targets that entry point, never a module inside it. Running the entry preserves at no cost the program name the old half reports in its own usage and error text, its conventions for signalling failure, and its hygiene toward the repository it acts on. A retained entry that cannot be found means a broken installation, and is reported as one.

## Key Invariants

1. One name and one dispatcher hold throughout: never a second entry point, an interim name, or a flag day.
2. A capability not yet ported is an ordinary registry row whose runnable delegates, so the declared surface never shrinks mid-port.
3. Delegation runs the retained entry point itself, never a module inside it, so that entry keeps its own program name, failure signalling and repository hygiene.
4. Arguments reach a delegated capability unmodified, its output is inherited rather than captured, and its exit code is forwarded unchanged.
5. A retained entry that cannot be found is reported as an incomplete installation naming the remedy, never raised as a spawn error.
6. The old runtime's requirement stays declared, and anything the old half still calls stays unchanged, for exactly as long as one delegating row survives.
7. Behaviour preservation is the bar: a ported capability keeps its flags, output routing and exit codes, and the old half's tests are the specification carried across rather than reinvented.

## Integration Points

- [verb-reachability](verb-reachability.md) — the single registry these delegating rows live in; a runnable may cross a process boundary without changing anything the registry declares.
- [toolkit-location](toolkit-location.md) — the name that stays the contract while the implementation behind it moves, which is what spares every body and stage a rewrite.
- [environment-guard](environment-guard.md) — the old runtime it diagnoses stays a real requirement while any row delegates, and stops being one when the last retires.
- [published-package](published-package.md) — ships the new entry and the retained one together, which is what makes a delegating row resolvable at all.

## Decision Log

### 2026-08-28 — #351 — One dispatcher from the first commit, unported capabilities delegating to the retained entry

The toolkit's name resolved to the new implementation at the first story, with the two issue filers left as registry rows running the retained entry point as a child process. This is what makes the switch non-flag-day: the filers move in their own epics without the dispatcher changing again, and the name written into every component body and pipeline stage is never rewritten. Delegating through the entry point rather than its individual modules preserves three things for free — the program name the filers report in their own usage and error text, their two different ways of signalling failure, and the runtime declaration, which stays in exactly one place until it is retired. **Refuted alternative:** leave the old entry as the installed binary and add a separate new one for the ported capabilities, avoiding any cross-runtime spawn entirely; it loses because it means either two names or a flag day at the end, and every body and stage naming the toolkit would then be rewritten twice.
