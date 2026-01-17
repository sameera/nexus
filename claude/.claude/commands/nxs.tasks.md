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

**Task Categories** (used for phasing):

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
| `{{WORKSPACE_PATH}}`       | Git worktree path: `../<repo-name>-<epic-issue-number>` |
| `{{BRANCH}}`               | Git branch: `<feat\|bug>/<epic-issue-number>-<concise-epic-title>` |

### Git Workspace Variables

These variables are derived once per epic and remain constant across all tasks:

**`{{WORKSPACE_PATH}}`**

-   Format: `../<repo-name>-<epic-issue-number>`
-   Derive `<repo-name>` from the current repository name
-   Example: For repo `nexus` and epic `#42` → `../nexus-42`

**`{{BRANCH}}`**

-   Format: `<type>/<epic-issue-number>-<concise-epic-title>`
-   `<type>`: Check epic labels — use `bug` if the epic has a `bug` label, otherwise use `feat`
-   `<concise-epic-title>`: Kebab-case the epic title (lowercase, spaces to hyphens, remove special characters)
-   Example: Feature epic #42 "User Authentication Flow" → `feat/42-user-authentication-flow`

### Label Requirements

**MANDATORY**: Read `docs/system/delivery/task-labels.md` to get the list of valid labels. Do not assume or guess labels—the file is the single source of truth.

**Label assignment rules** (after reading the labels file):

-   Use 1-3 labels per task based on work areas involved
-   Choose the primary architectural label first (e.g. `infrastructure`, `backend`, `frontend`, `database`)
-   Add secondary labels (like `performance` or `integration`) when applicable
-   **DO NOT** use any label not defined in `docs/system/delivery/task-labels.md`

### Task Numbering

Task numbers follow the format `TASK-{EPIC}.{NN}` where:

-   `{EPIC}` is the parent epic's GitHub issue number
-   `{NN}` is a zero-padded sequential number starting from 01

For example, if the epic issue number is 23, tasks would be numbered `TASK-23.01`, `TASK-23.02`, `TASK-23.03`, etc.

**Important**: The `parent` frontmatter attribute MUST be set to the epic's issue number extracted from the `epic.md` `link` attribute in Step 1 (e.g., `parent: #42`). This links each task issue to the parent epic issue.

## 6. Run Consistency Analysis & Auto-Remediation

**MANDATORY**: After generating all task files, run consistency analysis and automatically fix what can be remediated.

### 6a. Run Analysis

Invoke `/nxs.analyze {epic-directory}` to check for:

-   Coverage gaps (epic stories or HLD components without implementing tasks)
-   Logical inconsistencies between epic intent and tasks
-   Technical inconsistencies between HLD and task LLDs
-   Inter-task inconsistencies (circular deps, conflicts, terminology drift)
-   Superfluous task breakdowns (tasks that should be consolidated)

The analysis creates `tasks/task-review.md` with findings categorized by:

-   Severity: CRITICAL / HIGH / MEDIUM / LOW
-   Remediation type: AUTO (can be fixed programmatically) / MANUAL (requires user judgment)

### 6b. Auto-Remediate Findings

After analysis completes, automatically fix all `AUTO`-classified findings:

#### Superfluous Task Consolidation

For each superfluous task identified:

1. **Barrel/Export-only tasks** (e.g., "Export tag types via index.ts"):

    - Read the superfluous task's file list and acceptance criteria
    - Append the export statements to the **Files to create/modify** section of the originating task
    - Add "Export public API via barrel file" to the originating task's acceptance criteria
    - Delete the superfluous task file

2. **Verification-only tasks** (e.g., "Run tag service tests"):

    - Read the verification task's acceptance criteria
    - Append verification steps to the source task's acceptance criteria (e.g., "All tests pass", "Lint checks pass")
    - Delete the verification task file

3. **Effort < 1 hour tasks**:
    - Identify the task it's `blocked_by` (preferred) or the first task it `blocks`
    - Merge all content (files, interfaces, acceptance criteria, implementation notes) into the target task
    - Update the target task's effort estimate accordingly
    - Delete the merged task file

#### Dependency Chain Updates

After merging tasks:

1. Update `blocked_by` references in remaining tasks to point to the merge target
2. Update `blocks` references in remaining tasks to remove deleted task IDs
3. Ensure no dangling references exist

#### Task Renumbering

After deletions, renumber remaining tasks to maintain sequential order:

1. Rename task files: `TASK-{EPIC}.01.md`, `TASK-{EPIC}.02.md`, etc.
2. Update task IDs in frontmatter
3. Update all `blocked_by` and `blocks` references to use new IDs

#### Terminology Normalization

For terminology drift findings:

1. Identify the canonical term from `HLD.md` (e.g., `userId` not `userID`, `userUUID`, `user_id`)
2. Replace all variant terms across task files with the canonical term
3. Apply to: titles, summaries, file paths, interface definitions, acceptance criteria

### 6c. Update task-review.md

After auto-remediation, update `tasks/task-review.md`:

1. Move all remediated findings to the **Auto-Remediated ✅** section
2. Mark each with `[x]` and document the action taken
3. Update the **Summary** table:
    - Decrement issue counts for remediated items
    - Update "Tasks Analyzed" count if tasks were merged/deleted
4. Update the **Superfluous Tasks** table with "✅ Auto-merged" status
5. Recalculate coverage percentages if task mappings changed
6. Update **Recommended Actions** to reflect only remaining manual issues

### 6d. Capture Metrics for Review Checkpoint

After remediation, capture:

-   Original finding counts (before remediation)
-   Auto-remediated count
-   Remaining manual issue counts (CRITICAL/HIGH/MEDIUM/LOW)
-   Tasks merged/deleted count
-   Final task count
-   Coverage percentages

## 7. Review Checkpoint

**STOP AND WAIT** for user confirmation before creating GitHub issues.

1. **Present a summary** to the user:

    - Number of tasks generated (after any merges)
    - List of task files with their titles (e.g., `TASK-23.01: Setup project scaffolding`)
    - Path to the `tasks/` folder for review
    - Reminder of the phasing/dependency structure
    - **Auto-remediation summary** (what was fixed)
    - **Remaining manual issues**

2. **Prompt the user**:

    > "I've generated **{N} task files** in `{path-to-tasks-folder}/` and performed consistency analysis.
    >
    > **Auto-Remediation Applied**:
    >
    > - {X} superfluous tasks merged (see `task-review.md` for details)
    > - {Y} terminology inconsistencies normalized
    > - Tasks renumbered to maintain sequence
    >
    > **Final Tasks**:
    > {numbered list of task files with titles}
    >
    > **Remaining Issues** (require manual review):
    >
    > - {critical} critical, {high} high, {medium} medium, {low} low
    > - User story coverage: {X}%
    > - HLD component coverage: {X}%
    >
    > See `tasks/task-review.md` for full analysis.
    >
    > {If critical > 0: "⛔ **CRITICAL ISSUES FOUND** — Strongly recommend resolving before proceeding."}
    > {If critical == 0 && high > 0: "⚠️ **HIGH priority issues found** — Review recommended."}
    > {If critical == 0 && high == 0: "✅ **No blocking issues** — Safe to proceed."}
    >
    > Please review the task files and `task-review.md`, then reply with one of:
    >
    > - **`continue`** — Create GitHub issues for all tasks
    > - **`skip 03, 05`** — Create issues excluding specified task numbers
    > - **`abort`** — Cancel issue creation to address findings (task files preserved)"

3. **Wait for explicit user input** — do NOT proceed automatically.

4. **Handle user response**:
    - **`continue`**: Proceed to Step 8 with all tasks
    - **`skip [numbers]`**: Mark specified tasks for exclusion, then proceed to Step 8 with remaining tasks
    - **`abort`**: Stop execution entirely. Inform user that:
        - Task files remain in `tasks/` folder for manual handling
        - `task-review.md` contains the findings to address (including auto-remediation log)
        - They can re-run `/nxs.analyze` after making edits to re-validate
        - They can re-run `/nxs.tasks` later or manually create issues
        - Exit without further action

## 8. Create Task Issues

After receiving user confirmation to proceed, create GitHub issues for each approved task:

1. Apply the `nxs-gh-create-task` skill by running:
    ```bash
    python ./scripts/create_gh_issues.py "<path-to-tasks-folder>"
    ```
2. This will:
    - Create a GitHub issue for each `TASK-{EPIC}.{NN}.md` file
    - Apply the labels from frontmatter
    - Link each task issue to the parent epic via the `parent` attribute
3. Generate `./tasks.md` with the following structure:

```markdown
# {Epic Title}

**Epic**: {GitHub issue link}

## Tasks

### Phase 1: Infrastructure/Setup

-   [#101](link) - TASK-{EPIC}.01: {Title}
-   [#102](link) - TASK-{EPIC}.02: {Title}

### Phase 2: Data Layer

-   [#103](link) - TASK-{EPIC}.03: {Title}

{Continue for each applicable phase...}

## Task Dependency Graph

\`\`\`mermaid
{Dependency flowchart}
\`\`\`

## Parallelization Opportunities

{Tasks that can be worked on simultaneously}

## Effort Estimate

{Total estimated effort range}
```

Group tasks into phases based on the Task Categories defined in Step 3. Only include phases that have tasks assigned to them.

## 9. Update Epic

After generating `tasks.md`, update the `epic.md` file:

1. Locate or create an `## Implementation Plan` section in `epic.md` immediately after the `## Open Questions` section.
2. Add a relative link to the generated `tasks.md` file:

    ```markdown
    ## Implementation Plan

    See [tasks.md](./tasks.md) for the detailed task breakdown and dependency graph.
    ```

## 10. Cleanup

After all GitHub issues are created, `tasks.md` is generated, and `epic.md` is updated, delete the `tasks/` subfolder and all its contents (including `task-review.md`).

# Constraints

-   **DO NOT** search for HLD files - use the provided context or arguments only
-   **DO NOT** ask clarifying questions unless the HLD is fundamentally incomplete
-   **DO NOT** use labels other than those defined in `docs/system/delivery/task-labels.md`
-   **DO NOT** proceed past the Review Checkpoint without explicit user confirmation
-   **DO NOT** skip the consistency analysis or auto-remediation steps
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
3. **Load task template** from `docs/system/delivery/task-template.md`
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
7. **Read labels** from `docs/system/delivery/task-labels.md` to load valid labels
8. **Read the HLD file** and perform decomposition analysis
9. **Create the `tasks/` directory** in the same location as the HLD file
10. **Generate all task files** using the loaded template with:
    - Task numbers in format `TASK-{EPIC}.{NN}` (e.g., `TASK-23.01`, `TASK-23.02`)
    - The `parent` attribute set to the epic issue number
    - The `project` value from the template
    - Labels from the approved set only
11. **Run consistency analysis**:
    - Invoke `/nxs.analyze {epic-directory}`
    - Wait for analysis to complete and `task-review.md` to be generated
12. **Auto-remediate findings**:
    - Parse `task-review.md` for AUTO-classified findings
    - For each superfluous task:
        - Merge content into target task (files, acceptance criteria, implementation notes)
        - Delete superfluous task file
        - Update dependency references in remaining tasks
    - For terminology drift:
        - Identify canonical terms from HLD
        - Normalize across all task files
    - Renumber remaining tasks sequentially
    - Update `task-review.md`:
        - Move remediated items to "Auto-Remediated ✅" section
        - Update summary counts
        - Recalculate coverage if task mappings changed
13. **Capture final metrics**:
    - Auto-remediated count
    - Remaining manual issues (CRITICAL/HIGH/MEDIUM/LOW)
    - Final task count
    - Coverage percentages
14. **REVIEW CHECKPOINT — STOP AND WAIT**:
    - Present the summary of tasks AND auto-remediation actions to the user
    - Present remaining manual issues
    - Display the prompt asking for `continue`, `skip [numbers]`, or `abort`
    - Include severity indicators (⛔/⚠️/✅) based on REMAINING manual issues only
    - **Do not proceed until user responds**
    - Handle the response:
        - `continue` → Proceed to step 15
        - `skip [numbers]` → Exclude specified tasks, proceed to step 15
        - `abort` → Stop execution, preserve task files and `task-review.md`, inform user they can run `/nxs.analyze` again after edits, exit
15. **Create task issues** by running:

```bash
    python ./scripts/create_gh_issues.py --project "<PROJECT>" "<path-to-tasks-folder>"
```

16. **Generate `./tasks.md`** with tasks grouped by phase (see Workflow Step 8 for format)
17. **Update `epic.md`** with an `## Implementation Plan` section linking to `tasks.md`
18. **Delete the `tasks/` subfolder** and all its contents (including `task-review.md`)
19. **Report completion** with:
    -   Epic issue URL
    -   Path to generated `tasks.md`
