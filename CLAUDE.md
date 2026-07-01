# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Response style

Write for a technical user who wants clarity, not flair.
Use short, plain sentences.
Keep explanations concise.
Break complex ideas into steps.
Avoid unnecessary adjectives, metaphors, and filler.
Use common words instead of fancy words when both mean the same thing.

## Project Overview

**Nexus** is a Spec Driven Development toolkit designed to rebalance software development in the age of AI agents. It introduces intentional friction at key decision points to enforce judgment before code generation, preventing the accumulation of AI-generated technical debt.

**Core Philosophy:** Generation is cheap. Judgment is not. Nexus forces specification-first planning through a sequential pipeline with a human checkpoint at each phase, so understanding compounds rather than decays. Implementation itself is the engineer's job — Nexus plans the work, it does not write the code.

## Command Workflow

The lean planning pipeline is **`/nxs.setup` → `/nxs.epic` → `/nxs.hld` → `/nxs.analyze` → `/nxs.close`**, with `/nxs.council` available on demand. Each stage has a human checkpoint. The **story** is the unit of implementation and the unit of GitHub issue (no task layer); see [`0009`](.nexus/decisions/0009-story-as-implementation-unit.md) and [`0010`](.nexus/decisions/0010-epic-files-stories-at-approval-gate.md).

### 1. `/nxs.setup` - Bootstrap Project (System + Product Context)

One guided bootstrap that initializes both the technical and product context.

- Auto-detects the stack and generates `docs/system/stack.md` (confirm-only)
- Creates `docs/system/standards/*.md` (project-specific standards)
- Scaffolds the Nexus surfaces, including `.nexus/config/task-labels.md` and `docs/delivery/lessons/`
- Runs an interactive interview (via the `nxs-setup` skill) to build `docs/product/context.md`
- Refactors `CLAUDE.md` to link to the generated system docs

### 2. `/nxs.epic` - Generate Stories, File Epic + Story Issues

Turn direct intent into a bounded epic with sized stories, then file the GitHub issues at a single approval gate.

- **Input:** Direct feature intent (no pre-existing README required).
- **Process:**
    1. Drafts `epic.md` (description, business value, success metrics, personas, stories, assumptions, out-of-scope) into the queue entry.
    2. Generates the **stories** — the unit of implementation. Each story is sized **S/M**; a story larger than M is split here. The epic `complexity` is the **rollup** of its stories.
    3. Blocks the gate on any unresolved `[NEEDS CLARIFICATION]` — these must be answered (and `epic.md` updated) before filing.
    4. **Approval digest (the checkpoint):** presents a decision-grade summary — feature line, the epic's non-story prose, the stories as **one-liners with sizes**, then Assumptions / Out of Scope. The full `epic.md` stays in the queue as drill-down.
    5. Before the digest, runs the **`nxs-epic-gate`** agent on the drafted `epic.md` — the planning-consistency check (AC quality by `story_type`, story well-formedness, internal consistency) that story issues are filed behind. Critical/high findings block the digest.
    6. On approve: creates the epic issue, sequences the stories (`blocked_by`), and files **one issue per story as a child of the epic** — epic and story issues filed together.
    7. Writes an `## Implementation Sequence` table back into the queued `epic.md`, and writes the feature `docs/features/<feature>/README.md` linking directly to the epic issue.
- **No task layer:** no task index, no per-story LLD, no `story_ref`.
- **`/nxs.analyze` is not run here** — it is the post-implementation conformance gate (step 4 below); planning consistency is the `nxs-epic-gate` agent above.

### 3. `/nxs.hld` - Create the Decision Record

Capture the design decisions before implementation — a focused **decision record**, not a 16-section HLD.

- **Requires:** queued `epic.md` for the epic.
- **Process:** Delegates to the `nxs-architect` agent for design analysis; checks against `docs/system/standards/*.md`.
- **Output:** a decision record **tiered by complexity** — small epics get a short record, larger ones more depth. It records the decisions a reader cannot recover from the code, not an exhaustive blueprint.

### 4. `/nxs.analyze` - Validate Implementation Conformance

The standalone inline **conformance** gate: does the implemented code do what the planning promised. Run after the stories are implemented, before `/nxs.close`.

- **Checks:**
    - Acceptance-criteria conformance per story (each AC met / partial / unmet / contradicted, against the branch diff and closed story issues)
    - Invariant conformance (the decision record's constraints/invariants not violated by the diff)
    - Success-metric coverage (each epic success metric is plausibly moved and measurable from what shipped)
- **Scope:** conformance, not quality — it does not run tests (`nxs-qa`), a security audit (`security-review`), or the app. Read-only; inline findings, no `task-review.md`.
- **Not planning consistency:** story↔design coverage lives in `/nxs.hld`; AC quality by `story_type` lives in the `nxs-epic-gate` agent at `/nxs.epic`.

### 5. `/nxs.close` - Generate Close Record

Document the key decisions in human prose at the end of the epic.

- **Requires:** the epic's planning complete.
- **Output:** a human-prose **close record** — key decisions, a pointer to deferred scope, and deviation rationale. No `PIR.md`, no `ConceptDelta` block.
- **Actions:** appends deferred scope to `docs/features/<feature>/backlog.md`, appends a lesson to `docs/delivery/lessons/`, and closes the GitHub epic issue.

### `/nxs.council` - Multi-Perspective Review (on demand)

Facilitate a cross-functional decision with product and technical perspectives. Invoke at any point in the pipeline for decisions needing cross-functional alignment.

## Key Architecture Concepts

### Specialized Agents

- **`nxs-architect`** (Opus): Staff/Principal Engineer for the decision record and standards conformance.
- **`nxs-epic-gate`**: planning-consistency reviewer for a single `epic.md` — AC quality by `story_type`, story well-formedness, internal consistency. Run by `/nxs.epic` before the approval gate, or standalone against any `epic.md`.

### Reusable Skills

Located in `claude/.claude/skills/`:

- **`nxs-gh-create-epic`**: epic GitHub issue creation from frontmatter
- **`nxs-gh-create-story`**: per-story GitHub issue creation (child of the epic issue)
- **`nxs-abs-doc-path`**: relative to absolute GitHub URL conversion
- **`nxs-setup`**: interactive product-context interview for `/nxs.setup`

### Three-Store Split

Artifacts live in one of three stores (see [`0004`](.nexus/decisions/0004-implementation-plan.md)/`0005`/`0006`):

- **`docs/`** — permanent human artifacts (system docs, product context, feature READMEs, backlog, lessons).
- **`.nexus/queue/`** — committed-transient planning artifacts the distiller drains. The epic, the decision record, and the close record live in `.nexus/queue/<branch>/<local-id>/` (committed, **not** gitignored).
- **`.nexus/concepts/`** — machine knowledge.

### File Structure Conventions

```
docs/
├── features/
│   └── feature-name/
│       ├── README.md                    # Feature nav index → links to the epic issue
│       └── backlog.md                   # Deferred scope (appended by /nxs.close)
├── delivery/
│   └── lessons/                         # Lessons (appended by /nxs.close)
└── system/
    ├── stack.md                         # Technology stack
    └── standards/
        └── *.md                         # Project-specific standards

.nexus/
├── config/                              # Templates + task-labels (seeded by install/update + /nxs.setup)
├── queue/
│   └── <branch>/<local-id>/             # epic.md, decision record, close record (committed-transient)
└── concepts/                            # Machine knowledge (distiller target)
```

Per-story planning lives in the **GitHub issues**, not in files — the epic issue is the parent, story issues are its children.

## Development Workflow Principles

### Story Sizing

Stories are the unit of implementation and are sized **S/M**. A story larger than M is split inside `/nxs.epic`. The epic's `complexity` is the rollup of its stories.

### Approval Gate

`/nxs.epic` files the epic issue and all story issues together, behind a single decision-grade approval digest. Unresolved `[NEEDS CLARIFICATION]` markers block the gate. The digest is the forcing function — approve the epic and its story breakdown in one screen.

### Consistency Rule

The system must be in a valid state at each checkpoint:

- All tests pass
- Build succeeds (if applicable)
- No broken UI elements or dead endpoints
- No unhandled errors in implemented paths

## Update Process

To update Nexus commands/agents/skills from the upstream repository:

**Linux/Mac:**

```bash
chmod +x ./claude/nxs.update.claude.sh
./claude/nxs.update.claude.sh
```

**Windows (PowerShell):**

```powershell
./claude/nxs.update.claude.ps1
```

**Requirements:**

- Clean git working directory (no uncommitted changes in `.claude/`)
- Script only overwrites `nxs`-prefixed files, preserves custom additions

## Documentation References

- **User Documentation:** See [user-docs/](user-docs/) for comprehensive guides (installation, command reference, workflow best practices)
- **Documentation Index:** [DOCUMENTATION.md](DOCUMENTATION.md) provides navigation to all generated documentation
- **Quick Start Guide:** [how-to-nexus.md](how-to-nexus.md) explains the core workflow with concrete examples
- **Philosophy & Problem Statement:** [README.md](README.md) articulates why Nexus exists

## Project Context

### Path Conventions

When commands or agents reference paths under `system/`, `docs/`, or `scripts/`, treat them as relative to this repository root, not as absolute filesystem paths.

### Standards Template

Use `common/templates/standard.template.md` (the tool-agnostic master; seeded into a project at `.nexus/config/templates/standard.template.md`) as the template for creating project-specific standards. A standard is a **ledger of decisions, not a catalog of patterns** — record only what an agent cannot recover by reading the code itself, and point to the code rather than pasting it. Standards should include: Overview, Decisions (canonical choice with rationale + exemplar path + exceptions), Prohibitions, Budgets (cross-cutting NFRs), and Checklist.

### Templates & Config Home

Per the 2026-06-28 decision-log entries, templates live in `.nexus/config/templates/` (seeded by the install/update script) and `.nexus/config/task-labels.md` is seeded by `/nxs.setup`.

### Story Issue Frontmatter

Story files (consumed by the `nxs-gh-create-story` skill) use YAML frontmatter with:

```yaml
---
title: "{STORY TITLE}"
labels: [backend, performance] # From .nexus/config/task-labels.md
parent: #{EPIC_ISSUE_NUMBER}    # Links to the epic GitHub issue (story is a child)
project: "org/repo" # GitHub project for issue creation
---
```
