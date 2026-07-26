---
title: "Nexus Pipeline"
aliases: ["delivery pipeline", "pipeline stages", "System A", "spec-driven pipeline"]
touches: ["forcing-function-razor", "committed-queue", "story-as-unit", "epic-approval-gate", "scratch-capture", "pr-driven-flow", "issue-sourced-planning", "decision-record"]
last_updated_by: "#139"
status: active
verification: verified
---

# Nexus Pipeline

Nexus is a lean, spec-driven delivery pipeline assisting product and project management — turning intent into validated, decision-grade specs. Its stages are setup, epic, high-level design, analyze, and close; it plans and gates the work but leaves implementation to engineers.

## How It Works

Setup bootstraps the project's ground truth and product context once. The epic stage turns a capability description into a right-sized epic with user stories, filing epic and story issues at one approval gate. High-level design files a focused decision record — decisions, alternatives, invariants, risks — as an approvable sub-issue of the epic issue. Analyze checks the code against the acceptance criteria and the record's invariants, refusing to run — and emitting nothing — while the record is unapproved. Close blocks on any open sub-issue, story or record alike, then emits a close record into the committed queue and closes the epic issue. Each stage keeps only what forces a human decision; code generation stays outside the pipeline. Under issue-sourced planning the epic is resolved from its issues; the queue entry is born at close and feeds the store after merge. Analyze and close can run against a pull request, and design can import an out-of-band doc, so externally planned work still distills.

## Key Invariants

1. The pipeline assists product and project management; it does not own or gate implementation.
2. The stages are setup, epic, high-level design, analyze, and close.
3. Each stage keeps only outputs that force a human decision.
4. The user story is the terminal planning unit; the pipeline does not decompose below it.
5. Under issue-sourced planning the epic lives on its issues; the queue entry is born at close.
6. An unapproved record blocks analyze and close, read from the issue graph alone.

## Integration Points

- [forcing-function-razor](forcing-function-razor.md) — applied stage by stage to keep the pipeline lean.
- [committed-queue](committed-queue.md) — the handoff each epic's stages fill.
- [story-as-unit](story-as-unit.md) — the terminal planning unit the pipeline stops at.
- [epic-approval-gate](epic-approval-gate.md) — where the epic and its stories are filed.
- [scratch-capture](scratch-capture.md) — read as hints by analyze and close; no stage deletes it (the distiller drains it with the entry).
- [pr-driven-flow](pr-driven-flow.md) — the pull-request variant of analyze and close.
- [issue-sourced-planning](issue-sourced-planning.md) — the storage model: issues, not a committed file.
- [decision-record](decision-record.md) — the design stage's artifact; analyze and close block while it is unapproved.

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

### 2026-07-26 — #139 — The design stage files an approvable record; the gates read the issue graph

The design stage now files its decision record as a sub-issue of the epic issue, and approval became the native act of closing it — so analyze refuses to run while the record is unapproved (producing nothing, since close reads a missing receipt as "analyze never ran"), and close broadened its all-stories-closed gate to any open sub-issue, which makes an unapproved record block the epic through a mechanism that already exists. The design-warrant itself is a label applied at filing and revocable by the design stage's no-design-needed outcome, so a simple epic completes the pipeline with no record and no waiver. Refuted alternative: a separate record-approval check at close — a parallel gate for what the existing open-sub-issue gate already expresses, with a bypass surface the broadened gate deliberately lacks.
