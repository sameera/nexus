---
title: "Prose Translation"
aliases: ["prose translator", "form rules", "content rules", "translator agent", "density finding", "resident prose convention", "grounding substitution", "plain-language rules"]
touches: ["prose-verification", "forcing-function-razor", "distiller", "epic-approval-gate"]
last_updated_by: "#414"
status: active
verification: verified
---

# Prose Translation

Nexus's plain-language rules are split by who can execute each rule. The six form rules are: one idea per sentence, no em-dash asides, no idioms, prefer common words, name the noun, and say the exact strength you mean. These six rules run in a cheap translator that rewrites one drafted file in place and returns a receipt instead of the prose. Two content rules, write concrete and add nothing, stay with the author. Grounding an abstraction requires the analysis that the sentence does not carry.

## How It Works

A stage drafts an artifact, copies it aside, and hands the translator one path. That path is the only file the translator may write. Any source material the translator receives is read-only. The translator returns section names, counts and findings, never a rewritten section. The prose never crosses the invoking context in either direction.

An abstraction the translator cannot ground, or an aside whose load-bearingness the translator cannot judge, is reported as a line pointer. It is never rewritten: spotting an ungrounded abstraction needs nothing but the sentence, while grounding one needs the source. The author resolves each pointer or states why the wording stands.

Distillation is the single exception. Those runs are handed the epic and the decision record, and may replace an abstraction with a clause those files carry as a contiguous span.

## Key Invariants

1. The six form rules run in the translator. The two content rules stay with the author and are never delegated to it.
2. Each run is handed exactly one artifact path. That path is the only file the translator may write.
3. The receipt carries section names, counts and findings. The only artifact text it may carry is a bounded quotation inside one finding.
4. Density the translator cannot resolve is reported as a line pointer, never rewritten and never guessed.
5. Only a distillation run receives source material. Every grounding substitution copies a contiguous span from a named source and is listed in the receipt.
6. The prose guidance resident in any one stage is at most fifteen lines. A translation point restates no mechanics.
7. What is filed, committed or posted is the translated file or a verbatim transcription of it.

## Integration Points

- [prose-verification](prose-verification.md) — the deterministic check on every file the translator writes, run before any author edit.
- [forcing-function-razor](forcing-function-razor.md) — cut the resident rulebook these rules lived in; the split restores them at a fraction of the context cost.
- [distiller](distiller.md) — the one invoking stage granted source material, so a concept page gets grounded phrasing.
- [epic-approval-gate](epic-approval-gate.md) — translation runs before the gate, so the approved wording is the filed wording.

## Decision Log

### 2026-09-02 — #414 — Rules split by who can execute them, not by topic

The retired prose skill cost roughly a sixth of a run's tokens, because the rulebook loaded into the authoring context and stayed there for the whole run. Six rules only transform the sentence in front of them, so they moved into a cheap translator that never returns prose. Two rules need the analysis the author still holds, so they stayed resident as two sentences. Refuted alternative: hand the translator all eight rules and let it work from the text alone, which is one rulebook and one executor instead of two rule sets — it lost because the translator would either skip the two content rules silently or invent the grounding, and an invented grounding is worse than the abstraction it replaced.
