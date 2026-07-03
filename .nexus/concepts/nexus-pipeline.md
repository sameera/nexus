---
title: "Nexus Pipeline"
aliases: ["delivery pipeline", "pipeline stages", "System A", "spec-driven pipeline"]
touches: ["forcing-function-razor", "committed-queue", "story-as-unit", "epic-approval-gate"]
last_updated_by: "bootstrap"
status: active
verification: unverified
---

# Nexus Pipeline

Nexus is a lean, spec-driven delivery pipeline that assists product and project management — turning intent into validated, decision-grade specs. Its stages run setup, epic, high-level design, analyze, and close. It plans and gates the work but leaves implementation to engineers.

## How It Works

Setup bootstraps the project's ground truth and product context once. The epic stage turns a capability description directly into a right-sized epic with user stories, filing the epic and its story issues together at an approval gate. High-level design adds a focused decision record — the key decisions, refuted alternatives, invariants, and blocker-level risks — tiered by complexity. Analyze checks the implemented code against the epic's acceptance criteria and the decision record's invariants. Close emits a human-prose close record into the committed queue and closes the epic issue. Each stage keeps only what forces a human decision; the code-generation step is deliberately outside the pipeline, which is the antibody against drifting back into over-generation. The queue entry an epic accumulates becomes the knowledge store's input after the feature merges.

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

## Decision Log

### 2026-06-09 — bootstrap — 0001: assist planning, leave implementation to engineers

Scoped the pipeline to assist product and project management and to leave implementation to engineers, keeping the code-generation step outside Nexus. The considered alternative — a pipeline that also drives implementation and quality assurance — was rejected: owning the code-generation step is exactly the over-generation engine the refactor removes, and gating implementation drags the lean judgment pipeline back into heavyweight per-task artifacts.

### 2026-06-29 — bootstrap — 0010: stages settle to setup, epic, design, analyze, close

The separate task-decomposition stage was cut and story-issue filing folded into the epic stage behind an approval gate. The considered alternative — keeping a distinct stage to sequence stories and file their issues — was rejected as a consumer-less extra hop the approval gate already subsumes.
