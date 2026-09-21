---
title: "Close Record: Load the distillation stage's exceptional paths only when they apply"
epic: #714
feature: "Pipeline Command Surface"
date: 2026-09-20
nexus_version: 0.66.0
analyze: ran 2026-09-20 @ aa846d5da9fc58d97bd2d9f1f95ea1b1684bb267
record: #733
record_hash: 030e6e9cf836cd4c38f012ae74159406ef5eddd40f0b5e473bd530437706a91e
range:
  - repo: github.com/sameera/nexus
    base: d63728a1bbaeb4a878b7eff4305ba512ed1bdbc1
    head: b74a97736ebc340d427f50c946a53594a2124c90
---

# Close Record: Load the distillation stage's exceptional paths only when they apply

## Key Decisions

- **Phase 0's step 3 became a back-reference instead of disappearing.** Run mode and workspace shape moved to a new run-shape resolution section at the front of Input Resolution, and Phase 0 kept six numbered steps by turning step 3 into a two-line pointer at the values already resolved. Record #733's invariant 4 forbids changing the base stage's phase numbering, and deleting step 3 would have renumbered steps 4 through 6, invalidating the Phase 0.4 and Phase 0.6 references that later phases and the concept store carry. Refuted alternative: delete step 3 and renumber the rest of Phase 0.
- **The contract selection table grew one row per story rather than landing complete.** The first story introduced the table with its two rows, and each later extraction added its own. A row naming a contract that did not exist yet would have failed that same story's assertion that every named contract exists as an installed skill. Refuted alternative: land all five rows in the first story with the unbuilt contracts marked pending.
- **The hub contract is named inside run-shape resolution's own workspace-shape bullet, not at a later gate sentence.** Recovery and continuation each get a separate gate sentence at the point they are first needed. Hub rules are scattered across six phases with no single first use, so the only point at which the condition is resolved and no hub rule has yet been needed is the resolution itself. Refuted alternative: gate it at the first phase whose behaviour varies.
- **The fix and intake lane suites read the base stage concatenated with the non-epic contract.** Both suites assert what a run draining an entry of that kind reads, and such a run reads both documents. Concatenating the two sources keeps every existing assertion verbatim, which is what record #733's invariant 12 asks for. Refuted alternative: repoint each of the roughly thirty assertions at whichever of the two documents now owns its rule.
- **Phases 6.1 and 6.2 exist only when the taxonomy contract is read.** The base stage jumps from Phase 6 straight to Phase 6.3, and the taxonomy contract supplies 6.1 and 6.2 at their existing numbers. Invariant 4 pins numbering, not contiguity: 6.3 keeps its number either way, and a placeholder heading naming what the contract decides would be the summarizing pointer invariant 1 forbids. Refuted alternative: leave 6.1 and 6.2 in the base stage as one-line pointers.
- **The ceiling is a committed record with fields, not a constant in the checker.** A small JSON file beside the checker holds the byte count, the date it was measured and the value it replaces; the checker reads it. Invariant 11 requires the ceiling to carry its date and the value it replaces, which is a record rather than a number, and keeping it out of the checker makes a re-recording a one-file review. Refuted alternative: an exported constant in the checker module.

## Deviation Rationale

The shipped code matched decision record #733 in full. Every key decision, every constraint and all twelve invariants are implemented as approved, so no deviation was detected and none is recorded here.

## Deferred Scope

none

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-09-20-contract-granularity-is-load-granularity.md`
