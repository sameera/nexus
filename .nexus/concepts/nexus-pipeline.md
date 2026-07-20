---
title: "Nexus Pipeline"
aliases: ["delivery pipeline", "pipeline stages", "System A", "spec-driven pipeline"]
touches: ["forcing-function-razor", "committed-queue", "story-as-unit", "epic-approval-gate", "scratch-capture", "pr-driven-flow"]
last_updated_by: "#101"
status: active
verification: verified
---

# Nexus Pipeline

Nexus is a lean, spec-driven delivery pipeline that assists product and project management — turning intent into validated, decision-grade specs. Its stages run setup, epic, high-level design, analyze, and close. It plans and gates the work but leaves implementation to engineers.

## How It Works

Setup bootstraps the project's ground truth and product context once. The epic stage turns a capability description directly into a right-sized epic with user stories, filing the epic and its story issues together at an approval gate. High-level design adds a focused decision record — the key decisions, refuted alternatives, invariants, and blocker-level risks — tiered by complexity. Analyze checks the implemented code against the epic's acceptance criteria and the decision record's invariants. Close emits a human-prose close record into the committed queue and closes the epic issue. Each stage keeps only what forces a human decision; the code-generation step is deliberately outside the pipeline, which is the antibody against drifting back into over-generation. The queue entry an epic accumulates becomes the knowledge store's input after the feature merges. The analyze and close stages can also run against a pull request; and high-level design can import an out-of-band design doc, so work planned outside the pipeline still becomes distillable, gating when a decision lacks its rationale rather than inventing one.

## Key Invariants

1. The pipeline assists product and project management; it does not own or gate implementation.
2. The stages are setup, epic, high-level design, analyze, and close.
3. Each stage keeps only outputs that force a human decision.
4. The user story is the terminal planning unit; the pipeline does not decompose below it.
5. An epic's planning artifacts accumulate in one committed queue entry that feeds the knowledge store.

## Integration Points

- [forcing-function-razor](forcing-function-razor.md) — the razor applied stage by stage to keep the pipeline lean.
- [committed-queue](committed-queue.md) — the handoff each epic's stages fill.
- [story-as-unit](story-as-unit.md) — the terminal planning unit the pipeline stops at.
- [epic-approval-gate](epic-approval-gate.md) — the gate where the epic and its stories are filed.
- [scratch-capture](scratch-capture.md) — the close and analyze stages read it as hints; close mines and retains it, and no stage deletes it (the distiller drains it with the entry).
- [pr-driven-flow](pr-driven-flow.md) — the pull-request post-merge variant of its analyze and close stages.

## Decision Log

### 2026-06-09 — bootstrap — 0001: assist planning, leave implementation to engineers

Scoped the pipeline to assist product and project management and to leave implementation to engineers, keeping the code-generation step outside Nexus. The considered alternative — a pipeline that also drives implementation and quality assurance — was rejected: owning the code-generation step is exactly the over-generation engine the refactor removes, and gating implementation drags the lean judgment pipeline back into heavyweight per-task artifacts.

### 2026-06-29 — bootstrap — 0010: stages settle to setup, epic, design, analyze, close

The separate task-decomposition stage was cut and story-issue filing folded into the epic stage behind an approval gate. The considered alternative — keeping a distinct stage to sequence stories and file their issues — was rejected as a consumer-less extra hop the approval gate already subsumes.

### 2026-07-04 — manual — Reciprocal link from scratch-capture

Mechanical reciprocity fan-out: the scratch-capture page names the close stage as its sole consumer.

### 2026-07-18 — #67 — Close retains scratch; analyze also reads it

The close stage stopped deleting scratch and the analyze stage began reading it as soft context, because moving scratch into the committed entry made it visible on the PR head at review time and let the distiller's entry-deletion drain it — so close owns no cleanup and analyze can explain a divergence without the rationale being machine-local. Refuted alternative: keep close as the sole scratch consumer that deletes after its checkpoint — it wastes the now-reviewable rationale at analyze time and re-imposes a bespoke deletion the committed model removes.

### 2026-07-20 — #101 — A design-doc import bridge and a pull-request execution variant

High-level design gained an import that derives the decision record from an out-of-band design doc while the queued epic still supplies the scope, so work planned outside the pipeline gains the rationale channel the drain reads — and a stated decision missing its why or a viable alternative raises a clarification rather than shipping unsupported. The analyze and close stages also gained an additive pull-request execution variant. Refuted alternative: transcribe such rationale by hand, or distill the raw session and scratch — the first is unsupported and error-prone, the second launders ungated capture into the store the drain reads only curated records for.
