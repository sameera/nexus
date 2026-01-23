# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Nexus** is a Spec Driven Development toolkit designed to rebalance software development in the age of AI agents. It introduces intentional friction at key decision points to enforce judgment before code generation, preventing the accumulation of AI-generated technical debt.

**Core Philosophy:** Generation is cheap. Judgment is not. Nexus forces specification-first development through a sequential 4-command workflow that ensures understanding compounds rather than decays.

**Multi-Agent Support:** Supports both Claude Code and Google Gemini with identical command structures in `claude/.claude/` and `gemini/.gemini/` directories.

## Command Workflow

Nexus enforces a sequential workflow with human checkpoints at each phase:

### 1. `/nxs.init` - Bootstrap Project Documentation
Initialize project-specific documentation and standards.
- Generates `docs/system/stack.md` (technology stack)
- Creates `docs/system/standards/*.md` (project-specific standards)
- Sets up documentation structure

### 2. `/nxs.epic` - Generate User Stories and Epics
Transform fuzzy capability descriptions into clear, bounded epics.
- **Requires:** Feature README.md with `feature` frontmatter attribute
- **Process:** Invokes `nxs-council-architect` for complexity assessment (S/M/L/XL)
- **Right-sizing gate:** Epics > 10 days force decomposition or scope reduction
- **Output:** `epic.md` with user stories, acceptance criteria, complexity rating
- **Naming:** Sequential directories (`01-epic-name/`, `02-epic-name/`, etc.)

### 3. `/nxs.hld` - Create High-Level Design
Generate architectural blueprint before implementation.
- **Requires:** `epic.md` in current or selected directory
- **Process:** Delegates to `nxs-architect` agent (Opus model) for comprehensive design analysis
- **Output:** `HLD.md` with 16 sections (Executive Summary, Complexity Assessment, System Context, Architecture Overview, Requirements Analysis, Data Model, API Design Strategy, Security, Technical Debt, Risk Assessment, Implementation Phases, Testing Strategy, Success Criteria, etc.)
- **Standards conformance:** Automatically checks against `docs/system/standards/*.md`

### 4. `/nxs.tasks` - Decompose into GitHub Issues
Break HLD into independently reviewable 1-2 day tasks.
- **Requires:** `HLD.md` in current epic directory
- **Process:**
  1. Parses HLD and decomposes into logical tasks
  2. Invokes `nxs-architect` for per-task Low-Level Design (LLD)
  3. Creates parent epic GitHub issue via `nxs-gh-create-epic` skill
  4. Runs `/nxs.analyze` for consistency validation
  5. Auto-remediates findings (merges superfluous tasks, normalizes terminology)
  6. **Review checkpoint:** Presents task breakdown for user approval
  7. Creates GitHub issues for all approved tasks
- **Output:** `tasks/TASK-{EPIC}.{SEQ}.md` files with LLDs, `tasks.md` summary with dependency graph
- **Task numbering:** `TASK-42.01`, `TASK-42.02`, etc. (Epic #42, Task 1, Task 2, ...)

### 5. `/nxs.dev` - Implement Individual Task
Implement one GitHub issue at a time with test-first development.
- **Requires:** GitHub issue number as input
- **Process:** Delegates to `nxs-dev` agent (Sonnet model)
- **Workflow:**
  1. Sets up git worktree (or in-place branch): `feat/{epic-number}-{concise-title}`
  2. Syncs environment files via `nxs-env-sync` skill
  3. Implements task following LLD with human checkpoints before commits
  4. Posts implementation summary and closes issue on success
- **Worktree mode (recommended):** Creates isolated workspace at `../{repo-name}-{epic-number}`
- **In-place mode (alternative):** Branches off current worktree

### 6. `/nxs.analyze` - Validate Consistency
Catch inconsistencies between epic intent, HLD design, and task decomposition.
- **Checks:**
  - Coverage gaps (user stories without tasks, HLD components without tasks)
  - Logical inconsistencies (design mismatch with stories)
  - Technical inconsistencies (HLD vs task LLDs)
  - Superfluous/redundant tasks
  - Terminology drift
- **Auto-remediation:** Merges barrel-only tasks, normalizes canonical terms, renumbers after deletions
- **Output:** `tasks/task-review.md` with findings summary and remediation log

### 7. `/nxs.close` - Generate Post-Implementation Report
Document key decisions and archive task files.
- **Requires:** Completed epic with implemented tasks
- **Output:** `PIR.md` (Post-Implementation Report) consolidating task decisions and lessons learned
- **Actions:** Closes GitHub epic issue, archives task files

### 8. `/nxs.council` - Multi-Perspective Review
Facilitate cross-functional decision-making with PM and Architecture perspectives.
- **Modes:**
  - Quick Council: Single-agent analysis for simple decisions
  - Full Council: Multi-agent analysis for decisions requiring 1+ weeks
- **Agents:** `nxs-council-pm` (product perspective), `nxs-council-architect` (technical perspective)

## Key Architecture Concepts

### Specialized Agents
- **`nxs-architect`** (Opus): Staff/Principal Engineer for HLD/LLD generation and standards conformance
- **`nxs-dev`** (Sonnet): Senior Implementation Engineer for test-first development
- **`nxs-council-pm`** (Inherit): Product Manager for business perspective
- **`nxs-council-architect`** (Inherit): Technical Architect for complexity assessment

### Reusable Skills
Located in `claude/.claude/skills/`:
- **`nxs-gh-create-task`** / **`nxs-gh-create-epic`**: GitHub issue creation from frontmatter
- **`nxs-sq-name-generator`**: Sequential kebab-case directory naming
- **`nxs-env-sync`**: Environment file syncing to worktrees
- **`nxs-abs-doc-path`**: Relative to absolute GitHub URL conversion

### File Structure Conventions

```
docs/
├── features/
│   └── feature-name/
│       ├── README.md                    # Feature brief (frontmatter: feature: "Name")
│       ├── 01-epic-name/
│       │   ├── epic.md                  # User stories, acceptance criteria
│       │   ├── HLD.md                   # 16-section design document
│       │   ├── tasks/
│       │   │   ├── TASK-42.01.md       # Task with LLD
│       │   │   ├── TASK-42.02.md
│       │   │   └── task-review.md       # Consistency analysis
│       │   ├── tasks.md                 # Task summary with dependency graph
│       │   └── PIR.md                   # Post-Implementation Report
│       └── 02-next-epic/
│           └── [same structure]
└── system/
    ├── stack.md                         # Technology stack
    └── standards/
        ├── _template.md                 # Template for creating standards
        └── *.md                         # Project-specific standards
```

## Development Workflow Principles

### Right-Sizing Gate
Epics assessed as Large (L) or Extra Large (XL) trigger decomposition:
- **Option 1:** Generate reduced scope (first sub-epic only, defer remainder)
- **Option 2:** Generate multiple right-sized epics (all sub-epics)
- **Option 3:** Proceed with warning (not recommended)

### Consistency Rule
After completing any task, the system must be in a valid state:
- All tests pass
- Build succeeds (if applicable)
- No broken UI elements or dead endpoints
- No unhandled errors in implemented paths

### Auto-Remediation
After task generation, `/nxs.analyze` automatically:
- **Merges superfluous tasks:** Barrel/export-only tasks → merged into source task
- **Normalizes terminology:** Identifies canonical terms from HLD and updates all task files
- **Updates dependencies:** Fixes `blocked_by` and `blocks` references after merges
- **Renumbers tasks:** Sequential numbering after deletions

### Worktree vs In-Place Branching
- **Worktree mode (recommended):** Isolated workspace, cleaner environment syncing
- **In-place mode:** Faster setup, shares environment with main worktree
- **Branch naming:** `feat/{epic-number}-{concise-epic-title}`

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
Use `common/docs/system/standards/_template.md` as the template for creating project-specific standards. Standards should include: Overview, Principles, Standards (rules with rationale/examples/exceptions), Patterns, Checklist, Anti-Patterns, References, and Changelog.

### Task Frontmatter
Task files use YAML frontmatter with:
```yaml
---
title: "TASK-{EPIC}.{SEQ}: {TITLE}"
labels: [backend, performance]  # From docs/system/delivery/task-labels.md
parent: #{EPIC_ISSUE_NUMBER}    # Links to epic GitHub issue
project: "org/repo"             # GitHub project for issue creation
---
```
