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
    python ./scripts/nxs_gh_create_epic.py "<path-to-epic.md>"
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

### Template Location

Task files are generated using the template at `docs/system/delivery/task-template.md`.

**Before generating tasks**, read this template file to understand the output format. Users may customize this template — always use the current version, never a cached or assumed structure.

### Template Variables

The template uses `{{VARIABLE}}` placeholders. Replace each with:

| Variable                   | Description                                        |
| -------------------------- | -------------------------------------------------- |
| `{{EPIC}}`                 | Parent epic's GitHub issue number                  |
| `{{SEQ}}`                  | Zero-padded sequence number (01, 02, etc.)         |
| `{{TITLE}}`                | Concise task title                                 |
| `{{LABELS}}`               | Comma-separated labels from approved set           |
| `{{PARENT}}`               | Epic issue reference (e.g., `#42`)                 |
| `{{SUMMARY}}`              | One paragraph describing the task                  |
| `{{BLOCKED_BY}}`           | Task dependencies or "None"                        |
| `{{BLOCKS}}`               | Tasks this unblocks or "None"                      |
| `{{FILES}}`                | Bulleted list of files with purposes               |
| `{{INTERFACES}}`           | Key type definitions or signatures                 |
| `{{IMPLEMENTATION_NOTES}}` | Algorithms, patterns, edge cases                   |
| `{{ACCEPTANCE_CRITERIA}}`  | Bulleted checklist items                           |
| `{{EFFORT_ESTIMATE}}`      | Time range (e.g., "2-4 hours")                     |
| `{{PROJECT}}`              | GitHub project name (auto-configured on first run) |

### Label Requirements

**MANDATORY**: Read `docs/system/standards/task-labels.md` to get the list of valid labels. Do not assume or guess labels—the file is the single source of truth.

**Label assignment rules** (after reading the labels file):

-   Use 1-3 labels per task based on work areas involved
-   Choose the primary architectural label first (e.g. `infrastructure`, `backend`, `frontend`, `database`)
-   Add secondary labels (like `performance` or `integration`) when applicable
-   **DO NOT** use any label not defined in `docs/system/standards/task-labels.md`

### Task Numbering

Task numbers follow the format `TASK-{EPIC}.{NN}` where:

-   `{EPIC}` is the parent epic's GitHub issue number
-   `{NN}` is a zero-padded sequential number starting from 01

For example, if the epic issue number is 23, tasks would be numbered `TASK-23.01`, `TASK-23.02`, `TASK-23.03`, etc.

**Important**: The `parent` frontmatter attribute MUST be set to the epic's issue number extracted from the `epic.md` `link` attribute in Step 1 (e.g., `parent: #42`). This links each task issue to the parent epic issue.

## 6. Generate Summary

Create `./tasks/README.md` containing:

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
    python ./scripts/create_gh_issues.py "<path-to-tasks-folder>"
    ```
2. This will:
    - Create a GitHub issue for each `TASK-{EPIC}.{NN}.md` file
    - Apply the labels from frontmatter
    - Link each task issue to the parent epic via the `parent` attribute
3. Report the created issue URLs

# Constraints

-   **DO NOT** search for HLD files - use the provided context or arguments only
-   **DO NOT** ask clarifying questions unless the HLD is fundamentally incomplete
-   **DO NOT** use labels other than those defined in `docs/system/standards/task-labels.md`
-   **DO** make reasonable assumptions and document them
-   **DO** prefer smaller tasks over larger ones when uncertain
-   **DO** ensure the first task creates a buildable/runnable skeleton
-   **DO** use the tech stack specified in the HLD; infer from context if not explicit

### Project Configuration (One-Time Setup)

The `{{PROJECT}}` variable is handled differently from other template variables:

1. **On first run**: When the template contains the literal string `{{PROJECT}}`:

    - Stop and prompt the user:
        > "This appears to be the first time running task generation for this project.
        > Which GitHub project should issues be created under?
        > (e.g., `my-org/my-repo` or just `my-repo` if using default org)"
    - After receiving the project name, **update the template file directly**, replacing `{{PROJECT}}` with the provided value
    - Confirm the update to the user before proceeding

2. **On subsequent runs**: The template already contains the actual project name—use it directly without prompting.

**Example transformation:**

Before (first run):

```yaml
project: "{{PROJECT}}"
```

After user provides "acme-corp/backend-api":

```yaml
project: "acme-corp/backend-api"
```

This ensures the project name is configured once and persists across all future task generations.

# Execution

1. **Resolve HLD file** (see Input Resolution above - do not search)
2. If no HLD file can be resolved, stop and ask user to specify one
3. **Load task template** from `.claude/templates/task-template.md`
    - If missing, warn user and use default structure
4. **Resolve PROJECT configuration**:
    - If template contains literal `{{PROJECT}}`:
        - Prompt user: "Which GitHub project should issues be created under? (e.g., `my-org/my-repo`)"
        - Update the template file, replacing `{{PROJECT}}` with the provided value
        - Confirm the configuration update to the user
    - Extract the configured project name from the template for use in subsequent steps
5. **Create Epic issue**:
    - Locate the `epic.md` file in the same directory as the HLD file
    - Run the `nxs-gh-create-epic` skill, passing the project name:

```bash
     python ./scripts/nxs_gh_create_epic.py --project "<PROJECT>" "<path-to-epic.md>"
```

-   If no `epic.md` exists, warn the user and proceed without a parent issue

6. **Extract epic issue number** from the updated `epic.md` frontmatter `link` attribute
7. **Read labels** from `docs/system/standards/task-labels.md` to load valid labels
8. **Read the HLD file** and perform decomposition analysis
9. **Create the `tasks/` directory** in the same location as the HLD file
10. **Generate all task files** using the loaded template with:
    - Task numbers in format `TASK-{EPIC}.{NN}` (e.g., `TASK-23.01`, `TASK-23.02`)
    - The `parent` attribute set to the epic issue number
    - The `project` value from the template
    - Labels from the approved set only
11. **Generate the summary README** at `./tasks/README.md`
12. **Create task issues** by running:

```bash
    python ./scripts/create_gh_issues.py --project "<PROJECT>" "<path-to-tasks-folder>"
```

13. **Report completion** with:
    -   Epic issue URL
    -   Task count and their issue URLs
    -   Suggested first tasks to parallelize
