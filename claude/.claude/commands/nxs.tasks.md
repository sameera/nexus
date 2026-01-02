---
description: Break down a High-Level Design into implementable GitHub issues
---

# Role

Act as an experienced senior engineer performing technical decomposition and task planning.

# Context

-   **HLD Source**: The file open in the editor OR the file path provided in arguments
-   **User Input**: $ARGUMENTS

# Workflow

## 1. Load & Analyze HLD

Read the High-Level Design document and extract:

-   System components and their responsibilities
-   Data models and relationships
-   API contracts/interfaces
-   Integration points
-   Non-functional requirements (performance, security, etc.)
-   Technology stack and constraints

## 2. Decompose into Tasks

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

## 3. Generate Low-Level Design per Task

Each task MUST include a low-level design section covering:

-   **Files to create/modify** with exact paths
-   **Key interfaces/types** to implement (signatures, not full implementation)
-   **Dependencies** on other tasks (by task number)
-   **Acceptance criteria** - specific, testable conditions
-   **Implementation hints** - algorithms, patterns, or gotchas

## 4. Output Format

Create a `tasks/` subfolder in the same directory as the HLD file.

Generate one file per task named `TASK-{NNN}.md` with this structure:

````markdown
---
title: "TASK-{NNN}: {Concise title}"
labels: [{ category }, { component }]
---

## Summary

{One paragraph describing what this task accomplishes}

## Dependencies

-   Blocked by: {TASK-XXX, TASK-YYY or "None"}
-   Blocks: {TASK-ZZZ or "None"}

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

Additionally, generate `tasks/create-issues.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# TASK-001
gh issue create \
    --title "TASK-001: {title}" \
    --body-file "$SCRIPT_DIR/TASK-001.md" \
    --label "{labels}"

# Continue for all tasks...

echo "✅ All issues created"
```

## 5. Generate Summary

Create `tasks/README.md` containing:

-   Total task count
-   Dependency graph (text-based or mermaid)
-   Suggested implementation order
-   Parallelization opportunities
-   Estimated total effort range

# Constraints

-   **DO NOT** ask clarifying questions unless the HLD is fundamentally incomplete
-   **DO** make reasonable assumptions and document them
-   **DO** prefer smaller tasks over larger ones when uncertain
-   **DO** ensure the first task creates a buildable/runnable skeleton
-   **DO** use the tech stack specified in the HLD; infer from context if not explicit

# Execution

1. Read the HLD file
2. Create the `tasks/` directory
3. Generate all task files following the format above
4. Generate the shell script for batch issue creation
5. Generate the summary README
6. Report completion with task count and suggested first tasks to parallelize
