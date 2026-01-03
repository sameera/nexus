---
description: Break down a High-Level Design into implementable GitHub issues
---

# Role

Act as an experienced senior engineer performing technical decomposition and task planning.

# Context

-   **HLD Source**: Resolved in priority order:
    1. Explicit file path provided in `$ARGUMENTS`
    2. The file currently open in the editor (passed as context)
-   **User Input**: $ARGUMENTS

# Input Resolution

**CRITICAL**: Do NOT search for HLD files. Resolve the HLD source as follows:

1. **If `$ARGUMENTS` contains a file path**: Use that path directly
2. **If a file is provided in context** (open in editor): Use that file as the HLD
3. **Otherwise**: Stop and ask the user to either:
    - Open the HLD file in their editor and re-run the command, OR
    - Provide the file path as an argument: `/nxs.tasks path/to/HLD.md`

**Never** run `find`, `ls`, or search commands to locate HLD files.

# Workflow

## 1. Create Epic Issue

Before analyzing the HLD, create a GitHub issue for the parent epic:

1. Locate the `epic.md` file in the same directory as the HLD file
2. Apply the `nxs-gh-create-epic` skill by running:
    ```bash
    python scripts/nxs_gh_create_epic.py "<path-to-epic.md>"
    ```
3. Verify the `epic.md` frontmatter now contains a `link` attribute (e.g., `link: "#42"`)
4. Extract and store the issue number from the `link` attribute for use in task generation

If no `epic.md` exists in the HLD directory, warn the user and proceed without a parent issue.

## 2. Load & Analyze HLD

Read the High-Level Design document and extract:

-   System components and their responsibilities
-   Data models and relationships
-   API contracts/interfaces
-   Integration points
-   Non-functional requirements (performance, security, etc.)
-   Technology stack and constraints

## 3. Decompose into Tasks

Apply these decomposition rules:

**Size Constraint**: Each task must be completable by one engineer in ≤2 days. If larger, decompose further.

**Consistency Rule**: After completing any task, the system must be in a valid state:

-   All tests pass
-   Build succeeds
-   No broken UI elements or dead endpoints
-   No unhandled errors in implemented paths

**Sequencing**: Identify dependencies and order tasks so each can be implemented without forward references to incomplete work.

**Task Categories**:

1. **Infrastructure/Setup** - Project scaffolding, CI/CD, environment config
2. **Data Layer** - Models, migrations, repositories
3. **Core Logic** - Services, business rules, utilities
4. **API/Interface** - Endpoints, handlers, validation
5. **Integration** - External services, cross-component wiring
6. **Polish** - Error handling improvements, logging, documentation

## 4. Generate Low-Level Design per Task

Each task MUST include a low-level design section covering:

-   **Files to create/modify** with exact paths
-   **Key interfaces/types** to implement (signatures, not full implementation)
-   **Dependencies** on other tasks (by task number)
-   **Acceptance criteria** - specific, testable conditions
-   **Implementation hints** - algorithms, patterns, or gotchas

## 5. Output Format

Create a `tasks/` subfolder in the same directory as the HLD file.

### Label Requirements

**MANDATORY**: Read `$PROJECT/docs/system/standards/task-labels.md` to get the list of valid labels. Do not assume or guess labels—the file is the single source of truth.

**Label assignment rules** (after reading the labels file):

-   Use 1-3 labels per task based on work areas involved
-   Choose the primary architectural label first (e.g. `infrastructure`, `backend`, `frontend`, `database`)
-   Add secondary labels (like `performance` or `integration`) when applicable
-   **DO NOT** use any label not defined in `$PROJECT/system/standards/task-labels.md`

### Task Numbering

Task numbers follow the format `TASK-{EPIC}.{NN}` where:

-   `{EPIC}` is the parent epic's GitHub issue number
-   `{NN}` is a zero-padded sequential number starting from 01

For example, if the epic issue number is 23, tasks would be numbered `TASK-23.01`, `TASK-23.02`, `TASK-23.03`, etc.

Generate one file per task named `TASK-{EPIC}.{NN}.md` with this structure:

````markdown
---
title: "TASK-{EPIC}.{NN}: {Concise title}"
labels: [backend, database]
parent: { epic_issue_number }
---

## Summary

{One paragraph describing what this task accomplishes}

## Dependencies

-   Blocked by: {TASK-{EPIC}.{NN}, TASK-{EPIC}.{NN} or "None"}
-   Blocks: {TASK-{EPIC}.{NN} or "None"}

## Low-Level Design

### Files

-   `path/to/file.ts` - {purpose}
-   `path/to/other.ts` - {purpose}

### Interfaces/Types

```typescript
// Key type definitions or function signatures
```

### Implementation Notes

{Specific guidance: algorithms, patterns, edge cases, integration points}

## Acceptance Criteria

-   [ ] {Specific, testable criterion}
-   [ ] {Another criterion}
-   [ ] All existing tests pass
-   [ ] New functionality has test coverage (if applicable)

## Estimated Effort

{X hours - Y hours}
````

**Important**: The `parent` frontmatter attribute MUST be set to the epic's issue number extracted from the `epic.md` `link` attribute in Step 1 (e.g., `parent: #42`). This links each task issue to the parent epic issue.

## 6. Generate Summary

Create `tasks/README.md` containing:

-   Parent epic issue reference
-   Total task count
-   Dependency graph (text-based or mermaid)
-   Suggested implementation order
-   Parallelization opportunities
-   Estimated total effort range

## 7. Create Task Issues

After generating all task files, create GitHub issues for each task:

1. Apply the `nxs-gh-create-task` skill by running:
    ```bash
    python scripts/create_gh_issues.py "<path-to-tasks-folder>"
    ```
2. This will:
    - Create a GitHub issue for each `TASK-{EPIC}.{NN}.md` file
    - Apply the labels from frontmatter
    - Link each task issue to the parent epic via the `parent` attribute
3. Report the created issue URLs

# Constraints

-   **DO NOT** search for HLD files - use the provided context or arguments only
-   **DO NOT** ask clarifying questions unless the HLD is fundamentally incomplete
-   **DO NOT** use labels other than those defined in `/system/standards/task-labels.md`
-   **DO** make reasonable assumptions and document them
-   **DO** prefer smaller tasks over larger ones when uncertain
-   **DO** ensure the first task creates a buildable/runnable skeleton
-   **DO** use the tech stack specified in the HLD; infer from context if not explicit

# Execution

1. **Resolve HLD file** (see Input Resolution above - do not search)
2. If no HLD file can be resolved, stop and ask user to specify one
3. Run `nxs-gh-create-epic` on the `epic.md` file in the HLD directory
4. Extract the epic issue number from the updated `epic.md` frontmatter
5. Read `/system/standards/task-labels.md` to load valid labels
6. Read the HLD file
7. Create the `tasks/` directory
8. Generate all task files with:
    - Task numbers in format `TASK-{EPIC}.{NN}` (e.g., `TASK-23.01`, `TASK-23.02`)
    - The `parent` attribute set to the epic issue number
    - Labels from the approved set only
9. Generate the summary README
10. Run `nxs-gh-create-task` on the `tasks/` folder to create GitHub issues
11. Report completion with:
    - Epic issue URL
    - Task count and their issue URLs
    - Suggested first tasks to parallelize
