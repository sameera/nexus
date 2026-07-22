---
title: "Nexus Pipeline"
aliases: ["delivery pipeline", "pipeline stages", "System A", "spec-driven pipeline"]
touches: ["forcing-function-razor", "committed-queue", "story-as-unit", "epic-approval-gate", "scratch-capture", "pr-driven-flow", "issue-sourced-planning"]
last_updated_by: "#114"
status: active
verification: verified
---

# Nexus Pipeline

Nexus is a lean, spec-driven delivery pipeline that assists product and project management — turning intent into validated, decision-grade specs. Its stages run setup, epic, high-level design, analyze, and close. It plans and gates the work but leaves implementation to engineers.

## How It Works

Setup bootstraps the project's ground truth and product context once. The epic stage turns a capability description directly into a right-sized epic with user stories, filing epic and story issues together at an approval gate. High-level design adds a focused decision record — key decisions, alternatives, invariants, and blocker risks — tiered by complexity. Analyze checks the implemented code against the epic's acceptance criteria and the decision record's invariants. Close emits a human-prose close record into the committed queue and closes the epic issue. Each stage keeps only what forces a human decision; code generation stays outside the pipeline, the antibody against over-generation. Under issue-sourced planning the epic lives on its GitHub issues, resolved on demand rather than read from a committed file; its queue entry is born at close and feeds the store after merge. Analyze and close can also run against a pull request, and high-level design can import an out-of-band design doc, so externally planned work still distills.

## Key Invariants

1. The pipeline assists product and project management; it does not own or gate implementation.
2. The stages are setup, epic, high-level design, analyze, and close.
3. Each stage keeps only outputs that force a human decision.
4. The user story is the terminal planning unit; the pipeline does not decompose below it.
5. Under issue-sourced planning the epic lives on its issues, resolved on demand; its queue entry is born at close and feeds the knowledge store.

## Integration Points

- [forcing-function-razor](forcing-function-razor.md) — the razor applied stage by stage to keep the pipeline lean.
- [committed-queue](committed-queue.md) — the handoff each epic's stages fill.
- [story-as-unit](story-as-unit.md) — the terminal planning unit the pipeline stops at.
- [epic-approval-gate](epic-approval-gate.md) — the gate where the epic and its stories are filed.
- [scratch-capture](scratch-capture.md) — the close and analyze stages read it as hints; close retains it and no stage deletes it (the distiller drains it with the entry).
- [pr-driven-flow](pr-driven-flow.md) — the pull-request post-merge variant of its analyze and close stages.
- [issue-sourced-planning](issue-sourced-planning.md) — the storage model: the epic is resolved from its issue, not a committed file.

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

### 2026-07-22 — #114 — Planning moves onto issues; the queue entry is born at close

The storage model changed pipeline-wide: the epic and its stories live on GitHub issues as the single source of truth, and every stage obtains the epic by resolving its issue number rather than reading a committed planning file. Because nothing is committed at planning, the committed queue entry is born at close, so the queue holds only closed, drainable entries. This collapses the two-copy drift between the issue and a committed file, and lets a hand-filed epic enter the pipeline through the resolver. Refuted alternative: keep the committed epic file and mirror it from issues — but the mirror is the second copy that drifts, which the whole change exists to remove.
