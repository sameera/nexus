---
title: "Delegating Port"
aliases: ["delegating port", "non-flag-day port", "cross-runtime delegation", "retained entry point", "delegating registry row", "incremental language port"]
touches: ["verb-reachability", "toolkit-location", "environment-guard", "published-package", "resumable-batch-filing", "inert-declaration-removal", "additive-surface-fold"]
last_updated_by: "#354"
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
7. Behaviour preservation is the bar — flags, output routing, exit codes and the old half's tests as specification — save for a line the port would leave misleading, corrected only by design-gate ratification.

## Integration Points

- [verb-reachability](verb-reachability.md) — the single registry these delegating rows live in; a runnable may cross a process boundary without changing anything the registry declares.
- [toolkit-location](toolkit-location.md) — the name that stays the contract while the implementation behind it moves, which is what spares every body and stage a rewrite.
- [environment-guard](environment-guard.md) — the old runtime it diagnoses stays a real requirement while any row delegates, and stops being one when the last retires.
- [published-package](published-package.md) — ships the new entry and the retained one together, which is what makes a delegating row resolvable at all.
- [resumable-batch-filing](resumable-batch-filing.md) — the contract this port had to keep intact, and the source of the one line it corrected instead of preserving.
- [inert-declaration-removal](inert-declaration-removal.md) — the closing pass that ends this port, deleting the scaffolding the last flipped row leaves standing rather than emptying it.
- [additive-surface-fold](additive-surface-fold.md) — the complement: this pattern holds the name fixed and moves the implementation, that one holds the implementation fixed and moves the name.

## Decision Log


### 2026-08-28 — #351 — One dispatcher from the first commit, unported capabilities delegating to the retained entry

The toolkit's name resolved to the new implementation at the first story, with the two issue filers left as registry rows running the retained entry point as a child process. This is what makes the switch non-flag-day: the filers move in their own epics without the dispatcher changing again, and the name written into every component body and pipeline stage is never rewritten. Delegating through the entry point rather than its individual modules preserves three things for free — the program name the filers report in their own usage and error text, their two different ways of signalling failure, and the runtime declaration, which stays in exactly one place until it is retired. **Refuted alternative:** leave the old entry as the installed binary and add a separate new one for the ported capabilities, avoiding any cross-runtime spawn entirely; it loses because it means either two names or a flag day at the end, and every body and stage naming the toolkit would then be rewritten twice.

### 2026-08-29 — #353 — The preservation bar admits a ratified exception, and a row flips last in one binding

Porting the batch issue filer forced the bar to be stated more exactly than "keep everything". One line could not be kept: the message a half-finished run prints telling the operator how to resume it named the runtime being retired and reconstructed only two of the seven flags the run was given, so preserving it would have sent a resumed batch to a different root or filed it under the wrong classification. It is emitted in the new spelling instead, carrying every flag the run actually received — and the correction was ratified at the design gate, recorded as the single deliberate deviation, rather than taken quietly during the port. The blast radius is human readers only: the stages that consume this capability branch on its incomplete marker and its exit code and re-run the identical command themselves. The sequencing rule that made the switch safe is the second half: the capability was built and fully tested behind its handler while the registry row still delegated, and the row flipped last in one binding, so no intermediate state served part of a batch correctly. **Refuted alternative:** freeze the line verbatim, keeping the bar absolute and leaving no judgement call in the port — refused because the preserved text is not merely stale but misleading in the one situation it exists to serve, which would leave the story requiring an accurate resume command asserted by nothing.

### 2026-08-30 — #352 — The last delegating row flips, and the ratified-exception pattern gets two more instances

The epic filer was the final registry row still delegating to the retained runtime; both toolkit capabilities now name an in-process handler, and the toolkit's dispatcher declares zero delegating rows. This does not retire the older runtime's declared requirement by itself — the interpreter stays on disk and stays required until a separate, later step removes it, held open by a golden corpus of real output the port committed while the interpreter could still generate it, so that removal's evidence survives long after the comparison target is gone. The port's own behaviour-preservation bar admitted two more ratified exceptions beside the one already recorded: a confirmation this capability cannot get an answer to stays a hang in the retained runtime and becomes a same-invocation refusal here, and colour that printed unconditionally becomes conditional on the receiving stream actually being a terminal — both chosen because nothing that matters depends on the old behaviour, and both decided at the design gate rather than discovered mid-port. **Refuted alternative:** treat the last row flipping as reason enough to also retire the runtime requirement in the same change — rejected because the byte-identity evidence this port's own corpus provides is exactly what the later removal needs, and generating it and removing the requirement are safer as two separate, ordered steps.

### 2026-08-31 — #354 — The port terminates in a closing pass, which is its own rule

Three port epics emptied the other half and left its scaffolding standing: a shipped tree nothing executed, a declared runtime floor nothing enforced, an environment defect for a runtime nothing used, and an unimported locator and child-process call. This page's invariant 6 already binds the old runtime's declared requirement to the last surviving delegating row, so what the closing pass owes is the rest of the scaffolding — and the rules it follows generalise past this pattern, so they are recorded as their own concept rather than grown onto this one. The viable alternative was to state the teardown here and treat it as part of the port's definition; it was refuted because the same rules govern removals that no port produced, and this page is at its capacity for the concept it already carries.
