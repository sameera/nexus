---
description: Analyze epic, HLD, and task files for consistency, coverage gaps, and redundancies before GitHub issue creation.
---

# Role

Act as a meticulous technical reviewer performing cross-artifact consistency analysis and quality assurance.

# User Input

```text
$ARGUMENTS
```

Consider any user-provided arguments before proceeding (e.g., path overrides, specific checks to run).

# Goal

Identify inconsistencies, coverage gaps, redundancies, and superfluous task breakdowns across `epic.md`, `HLD.md`, and task files **before** GitHub issues are created. This command ensures alignment between product intent (epic), technical design (HLD), and implementation plan (tasks).

# Operating Constraints

**Operating Modes**:
-   **Analysis-only** (default): Read-only operation. Output findings to `task-review.md`. User must manually apply remediations.
-   **Auto-remediation** (`--remediate` flag): After analysis, automatically fix all AUTO-classified findings (merge tasks, normalize terminology, renumber, update dependencies). Modify task files and update `task-review.md` with remediation log.

**Integration Modes**:
-   **Integrated**: Called automatically by `nxs.tasks` with `--remediate` before review checkpoint
-   **Standalone**: Called manually by user (with or without `--remediate`)

# Input Resolution

Resolve the analysis context in priority order:

1. **Explicit path in `$ARGUMENTS`**: Use the provided directory path
2. **File open in editor**: Infer the epic/HLD directory from the open file
3. **Otherwise**: Stop and ask the user to provide the path to the epic directory

**Required Files**:

| File       | Location                           | Required |
| ---------- | ---------------------------------- | -------- |
| `epic.md`  | `{epic-directory}/epic.md`         | Yes      |
| `HLD.md`   | `{epic-directory}/HLD.md`          | Yes      |
| Task files | `{epic-directory}/tasks/TASK-*.md` | Yes      |

Abort with a clear error if any required file is missing.

# Execution Steps

## 1. Initialize Analysis Context

1. Resolve the epic directory path (see Input Resolution)
2. Verify all required files exist:
    ```
    {epic-directory}/
    ├── epic.md
    ├── HLD.md
    └── tasks/
        ├── TASK-{EPIC}.01.md
        ├── TASK-{EPIC}.02.md
        └── ...
    ```
3. If any file is missing, report which prerequisite command needs to run:
    - Missing `epic.md` → "Run `/nxs.epic` first"
    - Missing `HLD.md` → "Run `/nxs.hld` first"
    - Missing `tasks/` → "Run `/nxs.tasks` first (or analysis was invoked too early)"

## 2. Load Artifacts (Progressive Disclosure)

Load only the sections needed for analysis:

**From `epic.md`:**

-   Frontmatter (feature, epic name, status)
-   User Stories (persona, goal, acceptance criteria)
-   Business Value
-   Success Metrics
-   Dependencies
-   Assumptions
-   Out of Scope

**From `HLD.md`:**

-   Executive Summary
-   Complexity Assessment
-   System Context & Technology Stack
-   Requirements Analysis (functional, non-functional, out of scope)
-   Architecture Overview
-   Data Model Strategy
-   API Design Strategy
-   Security Architecture
-   Implementation Phases
-   Risk Assessment
-   Testing Strategy
-   Success Criteria

**From each `TASK-*.md`:**

-   Frontmatter (title, labels, parent, blocked_by, blocks)
-   Summary
-   Files to create/modify
-   Interfaces/Types
-   Implementation Notes
-   Acceptance Criteria
-   Effort Estimate

## 3. Build Semantic Models

Create internal representations for cross-referencing:

### Epic Model

```
UserStories[] {
    id: string (derived slug, e.g., "user-can-create-tag")
    persona: string
    goal: string
    acceptanceCriteria: string[]
}
SuccessMetrics[] {
    metric: string
    target: string
}
```

### HLD Model

```
Components[] {
    name: string
    layer: "frontend" | "backend" | "data" | "integration"
    responsibilities: string[]
}
Phases[] {
    number: number
    name: string
    deliverables: string[]
}
NonFunctionalRequirements[] {
    category: "performance" | "security" | "scalability" | "reliability"
    requirement: string
}
ApiEndpoints[] {
    method: string
    path: string
    purpose: string
}
DataEntities[] {
    name: string
    fields: string[]
}
```

### Task Model

```
Tasks[] {
    id: string (e.g., "TASK-23.01")
    title: string
    labels: string[]
    blockedBy: string[]
    blocks: string[]
    files: string[]
    acceptanceCriteria: string[]
    effortEstimate: string
    effortHours: number (parsed from estimate)
}
```

## 4. Detection Passes

Execute each detection pass and collect findings. Limit to **50 findings total**; summarize overflow.

### A. Epic ↔ Task Coverage Gaps

For each user story in `epic.md`:

-   [ ] At least one task maps to this story (by keyword/acceptance criteria overlap)
-   [ ] Story acceptance criteria are reflected in task acceptance criteria

**Flag**: User stories with zero task coverage

### B. HLD ↔ Task Coverage Gaps

For each HLD component/phase:

-   [ ] At least one task addresses this component
-   [ ] Phase deliverables have corresponding tasks

For each non-functional requirement:

-   [ ] At least one task includes relevant acceptance criteria (performance benchmarks, security checks, etc.)

For each API endpoint defined:

-   [ ] A task exists to implement it

For each data entity:

-   [ ] A task exists to create the model/migration

**Flag**: HLD elements with no task coverage

### C. Epic ↔ HLD Alignment

-   [ ] HLD scope matches epic scope (no HLD components for out-of-scope epic items)
-   [ ] HLD success criteria align with epic success metrics
-   [ ] HLD phases cover all epic user stories

**Flag**: Scope drift between epic intent and technical design

### D. Task ↔ Task Logical Inconsistencies

-   [ ] Dependency chains are acyclic (no circular `blocked_by` references)
-   [ ] Tasks don't have conflicting implementations (e.g., two tasks creating the same file with different content)
-   [ ] Terminology is consistent across tasks (same entity names, same API paths)
-   [ ] No orphan tasks (tasks that aren't blocked by anything AND don't block anything, unless they're the first or last in a chain)

**Flag**: Circular dependencies, conflicting implementations, terminology drift

### E. HLD ↔ Task Technical Inconsistencies

For each task's LLD (Low-Level Design) section:

-   [ ] File paths align with HLD architecture (correct directories for layer)
-   [ ] Interfaces/types match HLD data model definitions
-   [ ] API implementations match HLD endpoint specifications
-   [ ] Technology choices match HLD stack (no React in a Vue project, etc.)

**Flag**: Technical deviations from HLD specifications

### F. Superfluous Task Detection

Apply these heuristics to identify tasks that should be consolidated:

**Heuristic 1: Effort Too Small**

-   Task effort estimate < 1 hour
-   **Recommendation**: Merge into a related task

**Heuristic 2: Export/Barrel File Tasks**

-   Task's sole purpose is creating barrel files (`index.ts`) to re-export from other tasks
-   Task acceptance criteria only mention "exports X from task Y"
-   **Recommendation**: Add barrel file creation to the originating task

**Heuristic 3: Verification-Only Tasks**

-   Task's sole purpose is running tests/linting/validation created by another task
-   Acceptance criteria only mention "tests pass" or "lint passes"
-   **Recommendation**: Merge verification into the task that creates the testable code

**Detection Patterns**:

```
Superfluous if:
  - Title contains "export", "barrel", "re-export", "index file" AND files only include index.ts/index.js
  - Title contains "run tests", "verify", "validate" AND blocked_by includes the task that created the tests
  - Effort estimate contains "30 min", "0.5 hour", "<1 hour", "15 min"
```

### G. Redundancy Detection

-   [ ] No duplicate tasks (same files, same acceptance criteria)
-   [ ] No overlapping scope (two tasks implementing the same feature differently)

**Flag**: Tasks that should be deduplicated

## 5. Severity & Remediation Classification

### Severity Levels

| Severity     | Criteria                                                                  |
| ------------ | ------------------------------------------------------------------------- |
| **CRITICAL** | Circular dependencies, conflicting implementations, missing core coverage |
| **HIGH**     | User story with zero tasks, NFR with no coverage, significant scope drift |
| **MEDIUM**   | Superfluous tasks, terminology drift, minor coverage gaps                 |
| **LOW**      | Style inconsistencies, minor redundancies, suggestion-level improvements  |

### Auto-Remediation Classification

Each finding is classified as either **AUTO** (can be fixed programmatically) or **MANUAL** (requires user judgment).

| Category                        | Classification | Auto-Remediation Action                                    |
| ------------------------------- | -------------- | ---------------------------------------------------------- |
| Superfluous: Barrel/export task | AUTO           | Merge export statements into originating task, delete task |
| Superfluous: Verification-only  | AUTO           | Merge verification steps into source task, delete task     |
| Superfluous: Effort < 1 hour    | AUTO           | Merge into blocked-by task (or first task it blocks)       |
| Task numbering gaps             | AUTO           | Renumber tasks sequentially after merges                   |
| Terminology drift               | AUTO           | Normalize to HLD canonical term across all tasks           |
| Circular dependencies           | MANUAL         | Requires understanding intent to break cycle               |
| Conflicting implementations     | MANUAL         | Requires deciding which approach is correct                |
| Coverage gaps (stories)         | MANUAL         | Requires creating new tasks with proper scope              |
| Coverage gaps (HLD components)  | MANUAL         | Requires creating new tasks with proper scope              |
| Coverage gaps (NFRs)            | MANUAL         | Requires adding criteria to existing or new tasks          |
| Epic ↔ HLD scope drift          | MANUAL         | Requires alignment decision on scope                       |
| Technical deviations from HLD   | MANUAL         | Could be intentional; requires verification                |

**Finding ID Format**: Include remediation type in ID prefix:

-   `[A-C1]` = Auto-remediable Critical
-   `[A-H1]` = Auto-remediable High
-   `[A-M1]` = Auto-remediable Medium
-   `[M-C1]` = Manual Critical
-   `[M-H1]` = Manual High
-   `[M-M1]` = Manual Medium

## 6. Generate task-review.md

Output the analysis as an actionable TODO list:

```markdown
# Task Review: {Epic Name}

**Analysis Date**: {YYYY-MM-DD HH:MM}
**Epic**: {epic.md path}
**HLD**: {HLD.md path}
**Tasks Analyzed**: {count}

---

## Summary

| Metric                 | Value                    |
| ---------------------- | ------------------------ |
| Total Findings         | {N}                      |
| Auto-Remediable        | {N}                      |
| Requires Manual Review | {N}                      |
| Critical Issues        | {N}                      |
| High Issues            | {N}                      |
| Medium Issues          | {N}                      |
| Low Issues             | {N}                      |
| User Story Coverage    | {X}% ({covered}/{total}) |
| HLD Component Coverage | {X}% ({covered}/{total}) |
| NFR Coverage           | {X}% ({covered}/{total}) |
| Superfluous Tasks      | {N}                      |

---

## Auto-Remediated ✅

_Issues that were automatically fixed by `/nxs.tasks`._

-   [x] **[A-M1]** Superfluous Task: {Summary} - **Original Location**: {task ID} - **Action Taken**: {Merged into TASK-XX.YY, deleted original}

-   [x] **[A-M2]** Terminology Drift: {Summary} - **Original Location**: {task IDs} - **Action Taken**: {Normalized "userID" → "userId" across N tasks}

---

## Critical Issues (Manual)

These MUST be resolved before creating GitHub issues.

-   [ ] **[M-C1]** {Category}: {Summary} - **Location**: {file:line or task ID} - **Details**: {Explanation} - **Remediation**: {Specific action to take}

---

## High Priority (Manual)

These SHOULD be resolved before creating GitHub issues.

-   [ ] **[M-H1]** {Category}: {Summary} - **Location**: {file:line or task ID} - **Details**: {Explanation} - **Remediation**: {Specific action to take}

---

## Medium Priority (Manual)

Consider addressing these for improved quality.

-   [ ] **[M-M1]** {Category}: {Summary} - **Location**: {file:line or task ID} - **Details**: {Explanation} - **Remediation**: {Specific action to take}

---

## Low Priority (Manual)

Optional improvements.

-   [ ] **[M-L1]** {Category}: {Summary} - **Location**: {file:line or task ID} - **Remediation**: {Specific action to take}

---

## Coverage Report

### User Stories → Tasks

| Story ID               | Story Title           | Mapped Tasks      | Status     |
| ---------------------- | --------------------- | ----------------- | ---------- |
| `user-can-create-tag`  | User can create a tag | TASK-23.03, 23.04 | ✅ Covered |
| `admin-can-delete-tag` | Admin can delete tag  | —                 | ❌ Gap     |

### HLD Components → Tasks

| Component     | Layer   | Mapped Tasks | Status     |
| ------------- | ------- | ------------ | ---------- |
| TagService    | Backend | TASK-23.02   | ✅ Covered |
| TagRepository | Data    | —            | ❌ Gap     |

### Non-Functional Requirements → Tasks

| NFR Category | Requirement          | Mapped Tasks | Status     |
| ------------ | -------------------- | ------------ | ---------- |
| Performance  | API response < 200ms | TASK-23.08   | ✅ Covered |
| Security     | Input sanitization   | —            | ❌ Gap     |

---

## Superfluous Tasks

Tasks flagged for potential consolidation:

| Task ID    | Title                 | Reason            | Merge Into | Status         |
| ---------- | --------------------- | ----------------- | ---------- | -------------- |
| TASK-23.05 | Export tag types      | Barrel file only  | TASK-23.02 | ✅ Auto-merged |
| TASK-23.09 | Run tag service tests | Verification only | TASK-23.08 | ✅ Auto-merged |

---

## Recommended Actions

1. {Prioritized action based on REMAINING findings}
2. {Next action}
3. {Next action}

---

## Next Steps

-   **If CRITICAL (Manual) issues exist**: Resolve all critical issues before proceeding with `/nxs.tasks` confirmation
-   **If only HIGH/MEDIUM/LOW (Manual)**: Review findings, address as appropriate, then proceed
-   **To apply fixes**: Edit the relevant task files manually, then re-run `/nxs.analyze` to verify
```

## 7. Write Output File

Save the analysis to:

```
{epic-directory}/tasks/task-review.md
```

## 8. Report Completion

Output a summary to the user:

```
✅ Analysis complete: {epic-directory}/tasks/task-review.md

📊 Summary:
   - {N} findings ({critical} critical, {high} high, {medium} medium, {low} low)
   - User story coverage: {X}%
   - HLD coverage: {X}%
   - Superfluous tasks identified: {N}

{If CRITICAL > 0}
⛔ CRITICAL ISSUES FOUND — Resolve before creating GitHub issues.

{If CRITICAL == 0 && HIGH > 0}
⚠️ HIGH priority issues found — Review recommended before proceeding.

{If CRITICAL == 0 && HIGH == 0}
✅ No blocking issues — Safe to proceed with issue creation.
```

# Integration with nxs.tasks

When called from `nxs.tasks` (integrated mode):

1. `nxs.tasks` generates all task files to `tasks/` folder
2. `nxs.tasks` invokes `nxs.analyze` automatically
3. `nxs.analyze` writes `task-review.md` to `tasks/` folder
4. `nxs.tasks` includes analysis summary in the review checkpoint prompt:

    > "I've generated **{N} task files** and performed consistency analysis.
    >
    > **Analysis Results**: {critical} critical, {high} high, {medium} medium issues
    > See `tasks/task-review.md` for details.
    >
    > {If CRITICAL > 0: "⛔ Critical issues must be resolved before proceeding."}
    >
    > Please review the task files and `task-review.md`, then reply with:
    >
    > - **`continue`** — Create GitHub issues for all tasks
    > - **`skip 03, 05`** — Create issues excluding specified task numbers
    > - **`abort`** — Cancel issue creation to address findings"

# Standalone Usage

When called directly by the user:

```
/nxs.analyze                           # Use open file context
/nxs.analyze path/to/epic-folder       # Explicit path
```

This mode is useful when:

-   User aborted `nxs.tasks` to make manual modifications
-   User wants to re-validate after editing task files
-   User wants to analyze without running full task generation

# Auto-Remediation (Optional)

**Trigger**: If `$ARGUMENTS` contains `--remediate`, execute after analysis completes.

**Process**:
1. Parse `task-review.md` for AUTO-classified findings
2. For each **superfluous task** finding:
   - **Barrel/Export-only**: Merge files/criteria into originating task, delete superfluous file
   - **Verification-only**: Append verification steps to source task criteria, delete file
   - **Effort <1hr**: Merge all content into `blocked_by` target (or first `blocks` task), delete file
3. **Update dependencies**: Fix `blocked_by`/`blocks` references in remaining tasks to point to merge targets
4. **Renumber tasks**: Sequential renaming (TASK-{EPIC}.01, .02, .03, etc.) + update IDs in frontmatter and dependency references
5. **Normalize terminology**: Replace variant terms across all task files with canonical terms from HLD
6. **Update task-review.md**: Move remediated items to "Auto-Remediated ✅" section, update summary counts, recalculate coverage
7. **Return metrics**: Remediated count, remaining manual issues, final task count, coverage %

# Operating Principles

## Analysis Guidelines

-   **NEVER hallucinate missing content** — report absences accurately
-   **Prioritize actionable findings** — each finding must have a clear remediation
-   **Be specific** — cite exact task IDs, file paths, line numbers where possible
-   **Avoid false positives** — only flag clear issues, not stylistic preferences
-   **Deterministic results** — same inputs should produce same findings

## Token Efficiency

-   Load artifacts incrementally, not all at once
-   Limit findings to 50; summarize overflow
-   Use tables for dense information
-   Focus on high-signal findings over exhaustive documentation

## Finding Quality

Each finding MUST include:

1. **Unique ID** (category prefix + number): C1, H2, M3, L4
2. **Category**: Coverage Gap, Inconsistency, Superfluous, Redundancy, etc.
3. **Severity**: CRITICAL, HIGH, MEDIUM, LOW
4. **Location**: Specific file and task ID
5. **Summary**: One-line description
6. **Remediation**: Concrete action to resolve

# Constraints

-   **DO NOT** search for files — use provided context or arguments only
-   **DO NOT** modify files except: creating/updating `task-review.md` (always), modifying task files (only if `--remediate`)
-   **DO NOT** create GitHub issues — this is analysis only
-   **DO** make the output actionable — every finding needs a clear fix
-   **DO** prioritize by impact — critical issues first
-   **DO** handle zero findings gracefully — report success with coverage stats
