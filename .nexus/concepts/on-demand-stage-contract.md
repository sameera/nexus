---
title: "On-Demand Stage Contract"
aliases: ["contract selection table", "exceptional-path contract", "loaded-size ceiling", "residency check", "conditional contract loading"]
touches: ["distiller"]
last_updated_by: "#714"
status: active
verification: verified
---

# On-Demand Stage Contract

A stage whose behaviour varies by run shape states each exceptional path's rules in a contract of its own, and reads a contract only once the run has resolved that it needs it. A declared table maps each resolved condition to the one contract that condition selects, and the ordinary shape selects none. A recorded ceiling holds what an ordinary run loads, and a separate check names any rule that moves back into the base stage.

## How It Works

The run's shape is resolved before anything is reported, refused or written. Some conditions are knowable at the start, such as the run mode, the workspace shape and each entry's recorded kind. Registry presence is not, because it is a property of a store the run surveys later, so selection happens at two points rather than one. Hoisting the survey earlier would reorder the run, which the partitioning is not allowed to do.

A contract states its rules against the base stage's own phase numbers and overrides the base stage at those numbers. The numbering does not change, so every reference a sibling stage or a concept page already carries stays valid. At each selection point the base stage names the resolved condition and the contract, and says nothing about what the contract decides, because a summarising pointer is a second copy of the rule.

Loading a contract loads its whole body, so contract granularity is load granularity. Two paths that a single condition selects together share one contract rather than two.

## Key Invariants

1. Each exceptional path's rules are stated in exactly one contract, and the base stage states only the resolved condition and the contract's name.
2. A contract is named only where the condition that selects it is already resolved, never ahead of it.
3. The base stage's phase order and numbering are unchanged, and contracts address it by those numbers.
4. The ordinary shape selects no contract at all.
5. No rule appears in two contracts, and no contract is selected by more than one resolved condition.
6. The recorded ceiling counts the base stage's authored source, the contracts an ordinary run selects, and every contract's description, with its date and the value it replaces.
7. No contract cuts a branch, stops at a checkpoint or opens a pull request; those acts stay in the base stage.

## Integration Points

- [distiller](distiller.md) — the stage partitioned this way, and so far the only one.

## Decision Log

### 2026-09-20 — #714 — Exceptional paths are read only once the run resolves it needs them

The distillation stage stated every rule it might need in one document, and the whole document was read before the run knew which rules applied. Six exceptional paths moved out of it into separately loadable contracts, carried by the mechanism the pipeline already uses for its shared contracts. That carrier was chosen because it is the only one that defers the read to run time: a contract's description is preloaded and its body arrives only when the stage asks for it. The ordinary drain now loads roughly a third fewer authored bytes than before.

Measurement is in authored source bytes rather than tokens. A token count measures the quantity that actually matters, and a competent engineer would argue for it, but it varies by harness and by model version, so the check would pass or fail for reasons unrelated to the change under review. The count includes every contract's description, because those are preloaded in every session of every stage whatever the run does, which keeps the carrier's own always-on cost visible rather than hidden.

Two checks hold the result, because a byte ceiling cannot name a rule. A size check reports the measured value and the ceiling. A residency check asserts that each named rule sits in its contract and nowhere in the base stage, and fails naming the rule that moved back.

Refuted alternative: sections of the same document the model is told to skip. It needs no new components and no install, bundle or harness question, and it preserves the rule-once property just as well. It loses on the only thing the change buys, because a stage body is delivered whole and an instruction to skip a section reduces nothing that was loaded.
