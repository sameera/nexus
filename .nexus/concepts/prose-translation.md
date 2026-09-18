---
title: "Prose Translation"
aliases: ["prose translator", "form rules", "content rules", "translator agent", "density finding", "resident prose convention", "grounding substitution", "plain-language rules"]
touches: ["prose-verification", "forcing-function-razor", "distiller", "epic-approval-gate"]
last_updated_by: "#634"
status: active
verification: verified
---

# Prose Translation

Nexus's plain-language rules split by who executes each rule. The six form rules, one idea per sentence, no em-dash asides, no idioms, the common word over the rare one, naming the noun, and the exact strength meant, sit in one short rule block placed directly above the drafting step in each of five stages: epic, decision-record, discover, distill and teach. The two content rules, write concrete and add nothing, stay with the author, who grounds an abstraction from the epic and the decision record when one is at hand.

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
6. The rule block sits directly in each of the five drafting stages, above the step that writes a human-facing artifact, capped at one hundred words. No separate skill carries it, and the five copies must match.
7. What is filed, committed or posted is the translated file or a verbatim transcription of it.

## Integration Points

- [prose-verification](prose-verification.md) — the deterministic check on every file the translator writes, run before any author edit.
- [forcing-function-razor](forcing-function-razor.md) — cut the resident rulebook these rules lived in; the split restores them at a fraction of the context cost.
- [distiller](distiller.md) — the one invoking stage granted source material, so a concept page gets grounded phrasing.
- [epic-approval-gate](epic-approval-gate.md) — translation runs before the gate, so the approved wording is the filed wording.

## Decision Log

### 2026-09-02 — #414 — Rules split by who can execute them, not by topic

The retired prose skill cost roughly a sixth of a run's tokens, because the rulebook loaded into the authoring context and stayed there for the whole run. Six rules only transform the sentence in front of them, so they moved into a cheap translator that never returns prose. Two rules need the analysis the author still holds, so they stayed resident as two sentences. Refuted alternative: hand the translator all eight rules and let it work from the text alone, which is one rulebook and one executor instead of two rule sets — it lost because the translator would either skip the two content rules silently or invent the grounding, and an invented grounding is worse than the abstraction it replaced.

### 2026-09-06 — #442 — The form rules moved into the drafting context

The six form rules left the translator and became a style guide the drafting stage loads before it writes. The epic, decision-record, discovery and distillation stages now draft plain prose the first time, so the translate-then-verify pass is gone, and with it the pre-translation copy, the check that gated a stage-authored artifact, and the ignore rule the setup stage added for those copies. The translator was retired because it re-read the artifact and its sources on every run. That exchange cost more tokens and more time than moving the six rules out of the drafting context saved. The deterministic check survives for the case this guide does not cover, which is rewriting text the pipeline did not author.

### 2026-09-17 — #634 — The style guide becomes an inline rule block

The nxs-prose-style skill that carried the six form rules as a file loaded at the top of a stage is deleted. Each of the five drafting stages now carries the same rule block, one before-and-after sentence pair, and the list of text the rules never touch, directly above the step that writes its draft. The five stage files and the razor skill were also rewritten in the plain register the rules ask for, so the largest text in the model's context stopped arguing against them. Refuted alternative: keep the skill as the single statement and put only a pointer at the drafting step. It lost because a pointer carries no rule text at the moment of writing, so the rules stayed read early and outweighed by the surrounding prose.
